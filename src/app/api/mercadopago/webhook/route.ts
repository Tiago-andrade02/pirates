import { getDb } from "@/lib/db";
import { getPayment, verifyWebhookSignature } from "@/lib/mercadopago";
import { attachPaymentToOrder, finalizePaidOrderByCode } from "@/lib/checkout-finalize";
import { recordPaymentDiagnostic } from "@/lib/payment-diagnostics";
import { resolvePaymentState, type ResolveReason } from "@/lib/payment-verify";
import type { OrderStatus } from "@/lib/types";

interface WebhookBody {
  type?: string;
  data?: { id?: string | number };
}

// Código HTTP con el que se responde cuando el pago está aprobado pero alguna
// validación no pasa. No es un error transitorio: el mismo webhook volverá a
// fallar igual, pero el código hace que el rechazo quede visible en el monitor
// de MP y en los logs en vez de pasar inadvertido.
const REASON_STATUS: Record<ResolveReason, number> = {
  approved: 200,
  pending: 200,
  rejected: 200,
  no_payment_info: 400,
  order_not_found: 404,
  reference_mismatch: 409,
  currency_mismatch: 409,
  amount_mismatch: 409,
  amount_invalid: 409,
};

// Sin texto libre ni datos del pagador: solo el código del motivo y los campos
// técnicos del pago. mpError queda acotado a la enum de ResolveReason.
function recordRejection(
  externalReference: string,
  payment: { payment_type_id?: string | null; payment_method_id?: string | null; installments?: number | null; status_detail?: string | null },
  status: string,
  reason: ResolveReason
): Promise<void> {
  return recordPaymentDiagnostic({
    externalReference,
    paymentTypeId: String(payment.payment_type_id ?? ""),
    paymentMethodId: String(payment.payment_method_id ?? ""),
    installments: String(payment.installments ?? ""),
    // status_detail de MP se guarda para poder saber por qué no se aprobó.
    mpResult: `webhook:${status}${payment.status_detail ? `:${payment.status_detail}` : ""}`,
    mpError: reason,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id");
  const body = (await request.json().catch(() => ({}))) as WebhookBody;
  const notificationId = body?.data?.id ? String(body.data.id) : dataId;
  if (!notificationId) return Response.json({ ok: true });

  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "";
  if (!secret) {
    // Sin secret configurado el webhook no puede autenticarse: fallar de forma
    // visible (503) en lugar de aceptar peticiones sin firmar.
    return Response.json(
      { ok: false, error: "WEBHOOK_SECRET no configurado" },
      { status: 503 }
    );
  }

  const valid = verifyWebhookSignature({
    signature: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId: notificationId,
  });
  if (!valid) {
    // Se registra que hubo un intento sin firma válida, sin copiar la firma
    // recibida ni el cuerpo del request: un atacante podría mandar cualquiera de
    // los dos y acabaríamos guardando contenido arbitrario en los logs.
    console.warn(
      "[webhook] Firma inválida: notificación rechazada (data.id omitido a propósito)"
    );
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let payment;
  try {
    payment = await getPayment(notificationId);
  } catch (error) {
    // NO responder ok:true ante un error real de consulta: así Mercado Pago
    // reintenta el envío.
    const message =
      error instanceof Error ? error.message : "Error al consultar el pago";
    console.error("[webhook] No se pudo consultar el pago", message);
    return Response.json(
      { ok: false, error: "No se pudo consultar el pago" },
      { status: 502 }
    );
  }

  const reference = (payment.external_reference ?? "").trim();

  // Pagos NO aprobados (rejected, cancelled, pending, in_process, authorized…):
  // antes se respondía 200 sin registrar nada, así que un pago rechazado
  // dejaba cero rastro. Ahora queda en payment_diagnostics con su status_detail,
  // que es lo que permite distinguir "se cayó la tarjeta" de "el usuario
  // canceló" sin guardar datos personales.
  //
  // Se responde 200 igual: reintentar no va a cambiar el resultado de un pago
  // que Mercado Pago ya resolvió.
  const statusNow = String(payment.status ?? "");
  if (statusNow !== "approved") {
    try {
      await recordRejection(
        reference,
        payment,
        statusNow,
        statusNow === "rejected" || statusNow === "cancelled" || statusNow === "failed"
          ? "rejected"
          : "pending"
      );
    } catch (error) {
      // Un fallo al diagnosticar no debe hacer fallar la notificación: el pago
      // no está aprobado y no hay nada que finalizar.
      console.error(
        "[webhook] No se pudo registrar el diagnóstico del pago no aprobado",
        error instanceof Error ? error.message : error
      );
    }
    return Response.json({ ok: true });
  }

  if (!reference) {
    console.error(
      `[webhook] Pago ${payment.id} aprobado sin external_reference: no se puede relacionar con un pedido`
    );
    return Response.json({ ok: false, error: "Referencia ausente" }, { status: 400 });
  }

  // Cruce con la base y validación por MISMAS reglas que la página de resultado
  // (resolvePaymentState): el pago debe corresponder exactamente al pedido, con
  // misma referencia, moneda ARS e importe igual al total (tolerancia 1 centavo).
  // Si algo no coincide NO se finaliza.
  const db = await getDb();
  let orderStatus: OrderStatus | null = null;
  let orderTotal: number | null = null;
  try {
    const result = await db.execute({
      sql: "SELECT status, total FROM orders WHERE code = ?",
      args: [reference],
    });
    const row = result.rows[0] as unknown as
      | { status: OrderStatus; total: number }
      | undefined;
    orderStatus = row?.status ?? null;
    orderTotal = row?.total != null ? Number(row.total) : null;
  } catch (error) {
    console.error("[webhook] Error leyendo la orden", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }

  const decision = resolvePaymentState({
    orderCode: reference,
    orderStatus,
    orderTotal,
    mpStatus: payment.status,
    mpAmount: payment.transaction_amount ?? null,
    mpCurrency: payment.currency_id ?? null,
    mpReference: payment.external_reference ?? null,
  });

  if (decision.reason !== "approved") {
    const status = REASON_STATUS[decision.reason] ?? 409;
    console.error(
      `[webhook] Pago ${payment.id} no finalizable para el pedido ${reference}: ${decision.reason}`
    );
    try {
      await recordRejection(reference, payment, statusNow, decision.reason);
    } catch {
      /* el código de estado es lo importante; no se enmascara por el log */
    }
    return Response.json(
      { ok: false, error: `Pago rechazado por validación: ${decision.reason}` },
      { status }
    );
  }

  // Finalización idempotente (marca 'pagado' o 'sin_stock', descuenta stock si
  // alcanza, envía email si es necesario). Si el pago ya fue procesado (doble
  // webhook) es un no-op. Si hay error transitorio lanzamos y respondemos 502
  // para que MP reintente.
  try {
    await finalizePaidOrderByCode(reference);
  } catch (error) {
    console.error("[webhook] Error finalizando", error instanceof Error ? error.message : error);
    return Response.json(
      { ok: false, error: "No se pudo finalizar el pedido" },
      { status: 502 }
    );
  }

  // Asocia el pago de MP a la orden (idempotente: el primer id gana y paid_at
  // se fija una sola vez). Es seguro que corra también en un webhook duplicado.
  // Si el UPDATE falla respondemos 502 para que MP reintente: finalize es
  // idempotente, así que NO vuelve a descontar stock.
  try {
    await attachPaymentToOrder(reference, String(payment.id));
  } catch (error) {
    console.error(
      "[webhook] Error persistiendo mp_payment_id/paid_at",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { ok: false, error: "No se pudo registrar el pago" },
      { status: 502 }
    );
  }

  return Response.json({ ok: true });
}
