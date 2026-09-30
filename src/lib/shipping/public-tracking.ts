import type { TrackingEvent } from "@/lib/types";

// Campos que la ruta pública puede leer de la orden.
export interface PublicTrackingSource {
  code: string;
  status: string;
  createdAt: string;
  shippedAt: string | null;
  deliveryType: string;
  shippingProvider: string;
  shippingService: string;
  trackingNumber: string;
  trackingUrl: string;
}

export interface PublicTrackingResponse {
  code: string;
  status: string;
  createdAt: string;
  shippedAt: string | null;
  deliveryType: string;
  shippingProvider: string;
  shippingService: string;
  trackingNumber: string;
  trackingUrl: string;
  events: TrackingEvent[];
}

// Construye la respuesta PÚBLICA de /api/shipping/tracking.
//
// A propósito NO incluye `postalCode` ni `locality`: quien conoce (o adivina) el
// código del pedido no tiene por qué poder leer la dirección del comprador. El
// resto de los campos no son sensibles y se mantienen para no romper a ningún
// consumidor. Es una función pura para poder testear el contrato sin base ni
// red.
export function buildPublicTrackingResponse(
  order: PublicTrackingSource,
  events: TrackingEvent[]
): PublicTrackingResponse {
  return {
    code: order.code,
    status: order.status,
    createdAt: order.createdAt,
    shippedAt: order.shippedAt,
    deliveryType: order.deliveryType,
    shippingProvider: order.shippingProvider,
    shippingService: order.shippingService,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
    events,
  };
}
