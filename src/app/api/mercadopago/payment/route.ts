import { getDb } from "@/lib/db";
import { createPayment } from "@/lib/mercadopago";
import { recordPaymentDiagnostic } from "@/lib/payment-diagnostics";

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

  const externalReference = (body.externalReference ?? "").trim();
  const formData = body.formData ?? {};
  const token = (formData.token ?? "").trim();
  const paymentMethodId = (formData.payment_method_id ?? "").trim();
  const paymentTypeId = (body.paymentTypeId ?? "").trim();

  // LOG TEMPORAL (debugging): confirmar la estructura del formData del Brick.
  // No se loguean datos sensibles (token, CVV, email del comprador).
  console.log("[mercadopago/payment] payload recibido:", {
    externalReference,
    paymentTypeId,
    payment_method_id: paymentMethodId,
    installments: body.formData?.installments,
    issuer_id: body.formData?.issuer_id,
  });

  if (!externalReference) {
    return Response.json({ error: "Falta la referencia externa del pedido" }, { status: 400 });
  }
  if (!token || !paymentMethodId) {
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
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const transactionAmount = Number(order.total);
  if (!Number.isFinite(transactionAmount) || transactionAmount <= 0) {
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
    console.error("[mercadopago/payment]", message);
    await recordPaymentDiagnostic({
      externalReference,
      paymentTypeId,
      paymentMethodId,
      installments: String(formData.installments ?? ""),
      mpResult: "error",
      mpError: message,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}
