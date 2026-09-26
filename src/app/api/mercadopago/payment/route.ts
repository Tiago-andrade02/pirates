import { getDb } from "@/lib/db";
import { createPayment } from "@/lib/mercadopago";
import { recordPaymentDiagnostic } from "@/lib/payment-diagnostics";
import { finalizePaidOrderByCode } from "@/lib/checkout-finalize";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";

const PAYMENT_MAX_ATTEMPTS = 60;
const PAYMENT_WINDOW_MS = 10 * 60 * 1000;

// Logs detallados de diagnóstico (sin datos sensibles) habilitados solo si se
// pide explícitamente y fuera de producción.
const PAYMENT_DIAG = process.env.ENABLE_PAYMENT_DIAGNOSTICS === "true" && process.env.NODE_ENV !== "production";

interface PaymentRequestBody {
  externalReference?: string;
  paymentTypeId?: string;
  formData?: {
    token?: string;
    payment_method_id?: string;
    installments?: number;
    issuer_id?: string | null;
    payer?: {
      email?: string;
      identification?: { type?: string; number?: string };
    };
  };
}

// Recibe el formData del Payment Brick (token de tarjeta, medio de pago,
// cuotas y payer) y crea el pago en Mercado Pago desde el backend con el
// access_token. El transaction_amount se toma SIEMPRE del pedido guardado
// (nunca del cliente) para evitar montos manipulados.
export async function POST(request: Request) {
  let body: PaymentRequestBody;
  try {
    body = (await request.json()) as PaymentRequestBody;
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  if (
    !(await rateLimitConsume(
      `payment:${clientIp(request.headers)}`,
      PAYMENT_MAX_ATTEMPTS,
      PAYMENT_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiados intentos de pago. Intentalo más tarde." },
      { status: 429 }
    );
  }

  const externalReference = (body.externalReference ?? "").trim();
  const formData = body.formData ?? {};
  const token = (formData.token ?? "").trim();
  const paymentMethodId = (formData.payment_method_id ?? "").trim();
  const paymentTypeId = (body.paymentTypeId ?? "").trim();

  if (PAYMENT_DIAG) {
    console.log("[mercadopago/payment] payload recibido:", {
      externalReference,
      paymentTypeId,
      payment_method_id: paymentMethodId,
      installments: body.formData?.installments,
      issuer_id: body.formData?.issuer_id,
    });
  }

  // Si algún dato mínimo falta o el pedido es inválido, lo registramos como
  // diagnóstico (sin datos sensibles) para poder diagnosticar fallos reales.
  const recordDiag = (result: string, err = "") =>
    recordPaymentDiagnostic({
      externalReference,
      paymentTypeId,
      paymentMethodId,
      installments: String(body.formData?.installments ?? ""),
      mpResult: result,
      mpError: err,
    });

  if (!externalReference) {
    await recordDiag("error", "Falta la referencia externa del pedido");
    return Response.json({ error: "Falta la referencia externa del pedido" }, { status: 400 });
  }
  if (!token || !paymentMethodId) {
    await recordDiag("error", "Faltan los datos de la tarjeta (token o medio de pago)");
    return Response.json(
      { error: "Faltan los datos de la tarjeta (token o medio de pago)" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const orderResult = await db.execute({
    sql: "SELECT total FROM orders WHERE code = ?",
    args: [externalReference],
  });
  const order = orderResult.rows[0] as unknown as { total: number } | undefined;
  if (!order) {
    await recordDiag("error", "Pedido no encontrado");
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const transactionAmount = Number(order.total);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
    await recordDiag("error", "Monto del pedido inválido");
    return Response.json({ error: "Monto del pedido inválido" }, { status: 400 });
  }

  try {
    const payment = await createPayment({
      transactionAmount,
      description: `PIRATES pedido ${externalReference}`,
      externalReference,
      token,
      paymentMethodId,
      paymentTypeId,
      installments: formData.installments,
      issuerId: formData.issuer_id,
      payerEmail: formData.payer?.email,
      payerIdentification: formData.payer?.identification,
    });

    // Si el pago ya quedó aprobado, finalizamos la orden acá mismo (marca
    // 'pagado', descuenta stock y envía el email). Así la orden se genera
    // aunque el webhook de Mercado Pago nunca llegue. Y asociamos el id del
    // pago + la fecha de pago (idempotente; el webhook también lo hace si
    // llega después).
    if (payment.status === "approved") {
      await finalizePaidOrderByCode(externalReference);
      try {
        await db.execute({
          sql: "UPDATE orders SET mp_payment_id = COALESCE(NULLIF(mp_payment_id, ''), ?), paid_at = COALESCE(paid_at, ?) WHERE code = ?",
          args: [String(payment.id), new Date().toISOString(), externalReference],
        });
      } catch (error) {
        console.error(
          "[mercadopago/payment] Error persistiendo mp_payment_id/paid_at",
          error instanceof Error ? error.message : error
        );
      }
    }

    await recordPaymentDiagnostic({
      externalReference,
      paymentTypeId,
      paymentMethodId,
      installments: String(formData.installments ?? ""),
      mpResult: `ok:${String(payment.status)}`,
      mpError: "",
    });

    return Response.json({
      id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      transaction_amount: payment.transaction_amount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al procesar el pago en Mercado Pago";
    // Se registra un codigo generico del status HTTP, no el mensaje de MP: el
    // texto libre puede incluir ultimos 4 de tarjeta, DNI o nombre del titular.
    const mpStatus =
      error instanceof Error && typeof (error as Error & { mpStatus?: number }).mpStatus === "number"
        ? (error as Error & { mpStatus?: number }).mpStatus!
        : undefined;
    console.error("[mercadopago/payment] fallo:", {
      externalReference,
      http_status: mpStatus ?? null,
    });
    await recordPaymentDiagnostic({
      externalReference,
      paymentTypeId,
      paymentMethodId,
      installments: String(formData.installments ?? ""),
      mpResult: "error",
      mpError: mpStatus ? `http_${mpStatus}` : "http_unknown",
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
