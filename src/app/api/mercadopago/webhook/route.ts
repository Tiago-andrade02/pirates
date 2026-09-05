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

  let payment;
  try {
    payment = await getPayment(notificationId);
  } catch {
    return Response.json({ ok: true });
  }

  if (payment.status !== "approved" || !payment.external_reference) {
    return Response.json({ ok: true });
  }

  // Finalización idempotente (marca 'pagado', descuenta stock, envía email).
  await finalizePaidOrderByCode(payment.external_reference);

  return Response.json({ ok: true });
}
