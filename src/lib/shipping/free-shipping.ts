// POLITICA DE ENVIO: GRATIS SIEMPRE.
//
// Este archivo existe (separado de ./index.ts) para que la política se pueda
// testear sin cargar los providers de envío ni sus dependencias. `index.ts` lo
// re-exporta, así que `import { CUSTOMER_SHIPPING_COST } from "@/lib/shipping"`
// sigue funcionando igual.
//
// El envío es gratis en TODAS las compras, sin mínimo. No hay ninguna variable
// de entorno que cambie esto: para volver a cobrar hay que editar ESTE archivo.

/** Costo de envío que se cobra al cliente. Siempre 0. */
export const CUSTOMER_SHIPPING_COST = 0;

/** True mientras el envío sea gratis para todos los pedidos. */
export function isFreeShipping(): boolean {
  return CUSTOMER_SHIPPING_COST === 0;
}

/** Precio de envío que se persiste/expone para una orden. */
export function shippingCostFor(): number {
  return CUSTOMER_SHIPPING_COST;
}
