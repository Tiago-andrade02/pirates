import { getDb } from "@/lib/db";
import { getOrderById } from "@/lib/admin-data";
import { getPayment, verifyWebhookSignature } from "@/lib/mercadopago";
import { sendOrderEmail } from "@/lib/notify";

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

  const secretConfigured = Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  if (secretConfigured) {
    const valid = verifyWebhookSignature({
      signature: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId: notificationId,
    });
    if (!valid) {
      return Response.json({ error: "Firma inválida" }, { status: 401 });
    }
  }

  const db = getDb();
  let payment;
  try {
    payment = await getPayment(notificationId);
  } catch {
    return Response.json({ ok: true });
  }

  if (payment.status !== "approved" || !payment.external_reference) {
    return Response.json({ ok: true });
  }

  const order = db
    .prepare("SELECT id, status FROM orders WHERE code = ?")
    .get(payment.external_reference) as { id: number; status: string } | undefined;
  if (!order || order.status === "pagado") {
    return Response.json({ ok: true });
  }

  db.exec("BEGIN");
  try {
    db.prepare("UPDATE orders SET status = 'pagado' WHERE id = ?").run(order.id);

    const items = db
      .prepare("SELECT perfume_id, qty, size FROM order_items WHERE order_id = ?")
      .all(order.id) as { perfume_id: number; qty: number; size: number }[];
    for (const item of items) {
      const size = [30, 50, 100].includes(item.size) ? item.size : 100;
      db.prepare(
        `UPDATE perfumes SET stock_${size} = MAX(0, stock_${size} - ?), stock = MAX(0, stock - ?) WHERE id = ?`
      ).run(item.qty, item.qty, item.perfume_id);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  // Notificación con el detalle del pedido (email SMTP). Fire-and-forget:
  // si falla el envío, no debe romper la respuesta del webhook.
  const fullOrder = getOrderById(order.id);
  if (fullOrder) {
    sendOrderEmail(fullOrder).catch((error) => {
      console.error("[notify] No se pudo enviar el email del pedido", error);
    });
  }

  return Response.json({ ok: true });
}
