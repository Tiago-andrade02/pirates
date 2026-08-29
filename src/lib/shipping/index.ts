import type { ShippingProvider, ShippingProviderId } from "./types";
import { correoArgentinoProvider, hasCredentials } from "./correo-argentino";
import { flatRateProvider } from "./flat-rate";

export const FREE_SHIPPING_MIN = Number(process.env.SHIPPING_FREE_MIN ?? 80000);

// Factory: el proveedor activo se elige por configuración (SHIPPING_PROVIDER),
// de modo que cambiar de servicio logístico no requiere tocar el checkout.
// Si Correo Argentino no está configurado, se usa un provider de tarifa plana
// para que el checkout (y el pago) puedan probarse.
export function getShippingProvider(): ShippingProvider {
  const id = (process.env.SHIPPING_PROVIDER ?? "correo_argentino") as ShippingProviderId;
  switch (id) {
    case "correo_argentino":
      return hasCredentials() ? correoArgentinoProvider : flatRateProvider;
    case "flat_rate":
      return flatRateProvider;
    default:
      throw new Error(`Proveedor de envío no soportado: ${id}`);
  }
}

export function applyFreeShipping(subtotal: number, shippingCost: number): number {
  return subtotal >= FREE_SHIPPING_MIN ? 0 : shippingCost;
}
