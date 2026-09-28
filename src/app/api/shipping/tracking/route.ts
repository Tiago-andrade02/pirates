import { getDb } from "@/lib/db";
import { getShippingProvider, getShippingProviderById } from "@/lib/shipping";
import type { ShippingProviderId } from "@/lib/shipping/types";
import type { TrackingEvent } from "@/lib/types";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";

const TRACKING_MAX_ATTEMPTS = 30;
const TRACKING_WINDOW_MS = 60_000;

function parseEvents(json: string): TrackingEvent[] {
  try {
    const parsed = JSON.parse(json) as TrackingEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  if (
    !(await rateLimitConsume(
      `tracking:${clientIp(request.headers)}`,
      TRACKING_MAX_ATTEMPTS,
      TRACKING_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiadas solicitudes. Inténtalo en un minuto." },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) {
    return Response.json({ error: "Falta el código de pedido" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT code, status, created_at, shipping_provider, shipping_service,
              tracking_number, tracking_url, tracking_events, shipped_at,
              delivery_type, postal_code, locality
       FROM orders WHERE code = ?`,
    args: [code],
  });
  const order = result.rows[0] as unknown as
    | {
        code: string;
        status: string;
        created_at: string;
        shipping_provider: string;
        shipping_service: string;
        tracking_number: string;
        tracking_url: string;
        tracking_events: string;
        shipped_at: string | null;
        delivery_type: string;
        postal_code: string;
        locality: string;
      }
    | undefined;

  if (!order) {
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  let events: TrackingEvent[] = parseEvents(order.tracking_events);

  // Consulta el estado REAL del envío en el proveedor cuando hay tracking.
  // Usa el provider con el que se despachó el pedido (no el configurado hoy).
  if (order.tracking_number) {
    try {
      const provider = order.shipping_provider
        ? getShippingProviderById(order.shipping_provider as ShippingProviderId)
        : getShippingProvider();
      const result = await provider.getTracking(order.tracking_number);
      if (result.events.length > 0) {
        events = result.events;
      }
    } catch (error) {
      console.error("[shipping/tracking]", error instanceof Error ? error.message : error);
    }
  }

  return Response.json({
    code: order.code,
    status: order.status,
    createdAt: order.created_at,
    shippedAt: order.shipped_at,
    deliveryType: order.delivery_type,
    postalCode: order.postal_code,
    locality: order.locality,
    shippingProvider: order.shipping_provider,
    shippingService: order.shipping_service,
    trackingNumber: order.tracking_number,
    trackingUrl: order.tracking_url,
    events,
  });
}
