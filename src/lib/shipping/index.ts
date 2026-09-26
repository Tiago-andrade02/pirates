import type { ShippingProvider, ShippingProviderId } from "./types";
import { correoArgentinoProvider, hasCredentials } from "./correo-argentino";
import { paqArProvider, hasPaqArCredentials } from "./paqar";
import { flatRateProvider } from "./flat-rate";

export const FREE_SHIPPING_MIN = Number(
  process.env.NEXT_PUBLIC_SHIPPING_FREE_MIN ??
    process.env.SHIPPING_FREE_MIN ??
    80000
);

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

const CORREO_ERROR =
  "Correo Argentino no configurado: faltan CORREO_ARGENTINO_API_USER/PASSWORD/CUSTOMER_ID/ORIGIN_POSTAL_CODE. No se aplica tarifa plana en producción.";

const PAQAR_ERROR =
  "PAQ.AR no configurado: faltan PAQAR_API_KEY / PAQAR_AGREEMENT. No se aplica tarifa plana en producción.";

// Resuelve UN provider puntual por su id, sin importar la configuración activa.
// Se usa para operar sobre un pedido ya despachado (rótulo/tracking) aunque la
// configuración actual haya cambiado.
export function getShippingProviderById(id: ShippingProviderId): ShippingProvider {
  switch (id) {
    case "correo_argentino":
      if (!hasCredentials()) {
        if (isProduction()) {
          throw new Error(CORREO_ERROR);
        }
        return flatRateProvider;
      }
      return correoArgentinoProvider;
    case "paq_ar":
      // Sin credenciales, en producción se corta con un error controlado (el
      // checkout devuelve 503, nunca 500) para no cobrar una tarifa plana que
      // no se va a poder despachar con PAQ.AR.
      if (!hasPaqArCredentials() && isProduction()) {
        throw new Error(PAQAR_ERROR);
      }
      return paqArProvider;
    case "flat_rate":
      return flatRateProvider;
    default:
      throw new Error(`Proveedor de envío no soportado: ${id}`);
  }
}

// Factory: el proveedor activo se elige por configuración (SHIPPING_PROVIDER).
// Valores soportados: flat_rate (default), correo_argentino y paq_ar.
//
// POLÍTICA DE FALLBACK: los providers sin cotizador real (PAQ.AR API 2.0) o
// sin credenciales devuelven la tarifa fija SOLO fuera de producción.
// En producción, si el provider elegido no está configurado, getShippingProvider()
// lanza un error visible: NUNCA se cobra una tarifa alternativa
// silenciosamente, porque el precio de la tarifa plana no refleja el costo
// real del envío.
export function getShippingProvider(): ShippingProvider {
  const id = (process.env.SHIPPING_PROVIDER ?? "flat_rate") as ShippingProviderId;
  return getShippingProviderById(id);
}

export function applyFreeShipping(subtotal: number, shippingCost: number): number {
  return subtotal >= FREE_SHIPPING_MIN ? 0 : shippingCost;
}

export function shippingProviderLabel(id: string): string {
  switch (id) {
    case "paq_ar":
      return "PAQ.AR";
    case "correo_argentino":
      return "Correo Argentino";
    case "flat_rate":
      return "Tarifa fija";
    default:
      return id;
  }
}