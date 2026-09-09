import { getDb } from "@/lib/db";
import { getPayment, verifyWebhookSignature } from "@/lib/mercadopago";
import { finalizePaidOrderByCode } from "@/lib/checkout-finalize";

interface WebhookBody {
  type?: string;
  data?: { id?: string | number };
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

  if (payment.status !== "approved" || !payment.external_reference) {
    return Response.json({ ok: true });
  }

  const reference = payment.external_reference;

  // Verificar que el pago aprobado corresponde EXACTAMENTE a la orden:
  // mismo código, moneda ARS y monto = total de la orden. Si algo no
  // coincide, NO se finaliza: se responde 409 para que quede visible en
  // logs/monitoreo (MP reintenta unas pocas veces, lo cual es útil para
  // observabilidad, pero no vuelve a crear stock ni a notificar).
  if (payment.currency_id !== "ARS") {
    console.error(
      `[webhook] Pago ${payment.id} aprobado con currency_id ${payment.currency_id} para pedido ${reference}`
    );
    return Response.json({ ok: false, error: "Moneda incorrecta" }, { status: 409 });
  }

  const db = await getDb();
  let orderTotal: number | undefined;
  try {
    const result = await db.execute({
      sql: "SELECT total FROM orders WHERE code = ?",
      args: [reference],
    });
    const row = result.rows[0] as unknown as { total: number } | undefined;
    orderTotal = row?.total != null ? Number(row.total) : undefined;
  } catch (error) {
    console.error("[webhook] Error leyendo la orden", error instanceof Error ? error.message : error);
    return Response.json({ ok: false, error: "Error interno" }, { status: 500 });
  }

  if (orderTotal === undefined) {
    console.error(
      `[webhook] Pago ${payment.id} aprobado pero el pedido ${reference} no existe en la base`
    );
    return Response.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
  }

  const paidAmount = Number(payment.transaction_amount);
  if (!Number.isFinite(paidAmount) || Math.abs(paidAmount - orderTotal) > 0.01) {
    console.error(
      `[webhook] Pago ${payment.id} aprobado: monto ${paidAmount} no coincide con el total del pedido ${reference} (${orderTotal})`
    );
    return Response.json(
      { ok: false, error: "Monto del pago no coincide con la orden" },
      { status: 409 }
    );
  }

  // Finalización idempotente (marca 'pagado' o 'sin_stock', descuenta stock si
  // alcanza, envía email si es necesario). Devuelve true solo cuando se finalizó
  // correctamente. Si el pago ya fue procesado (doble webhook) devuelve false.
  // Si hay error transitorio lanza y respondemos 502 para que MP reintente.
  try {
    await finalizePaidOrderByCode(reference);
  } catch (error) {
    console.error("[webhook] Error finalizando", error instanceof Error ? error.message : error);
    return Response.json(
      { ok: false, error: "No se pudo finalizar el pedido" },
      { status: 502 }
    );
  }

  // Asocia el pago de MP a la orden (idempotente con COALESCE: el primer id
  // gana, y paid_at se fija una sola vez). Es seguro que esto corra también
  // en un webhook duplicado. Si el UPDATE falla, respondemos 502 para que MP
  // reintente: finalize es idempotente, así que NO vuelve a descontar stock.
  try {
    await db.execute({
      sql: "UPDATE orders SET mp_payment_id = COALESCE(mp_payment_id, ?), paid_at = COALESCE(paid_at, ?) WHERE code = ?",
      args: [String(payment.id), new Date().toISOString(), reference],
    });
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
