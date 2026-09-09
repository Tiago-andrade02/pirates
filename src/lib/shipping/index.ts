import type { ShippingProvider, ShippingProviderId } from "./types";
import { correoArgentinoProvider, hasCredentials } from "./correo-argentino";
import { flatRateProvider } from "./flat-rate";

export const FREE_SHIPPING_MIN = Number(process.env.SHIPPING_FREE_MIN ?? 80000);

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

// Factory: el proveedor activo se elige por configuración (SHIPPING_PROVIDER),
// de modo que cambiar de servicio logístico no requiere tocar el checkout.
//
// POLÍTICA DE FALLBACK: el provider de tarifa plana SOLO se usa fuera de
// producción (o si se pide explícitamente con SHIPPING_PROVIDER=flat_rate).
// En producción, si Correo Argentino no está configurado, getShippingProvider()
// lanza un error visible: NUNCA se cobra una tarifa alternativa
// silenciosamente, porque el precio de la tarifa plana no refleja el costo
// real del correo.
export function getShippingProvider(): ShippingProvider {
  const id = (process.env.SHIPPING_PROVIDER ?? "correo_argentino") as ShippingProviderId;
  switch (id) {
    case "correo_argentino":
      if (!hasCredentials()) {
        if (isProduction()) {
          throw new Error(
            "Correo Argentino no configurado: faltan CORREO_ARGENTINO_API_USER/PASSWORD/CUSTOMER_ID/ORIGIN_POSTAL_CODE. No se aplica tarifa plana en producción."
          );
        }
        return flatRateProvider;
      }
      return correoArgentinoProvider;
    case "flat_rate":
      return flatRateProvider;
    default:
      throw new Error(`Proveedor de envío no soportado: ${id}`);
  }
}

export function applyFreeShipping(subtotal: number, shippingCost: number): number {
  return subtotal >= FREE_SHIPPING_MIN ? 0 : shippingCost;
}
