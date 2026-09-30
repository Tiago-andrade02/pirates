// RETIRO EN PERSONA: DESACTIVADO.
//
// El retiro en persona queda deshabilitado por completo: el checkout solo ofrece
// envío a domicilio y no se pide ninguna sucursal ni agencia. Este módulo es la
// ÚNICA fuente de verdad del interruptor, para que el frontend, las APIs y el
// admin no puedan quedar en desacuerdo entre sí (el caso anterior: el formulario
// ofrecía retiro, la lista de sucursales venía vacía y el checkout rechazaba el
// pedido con 400).
//
// Para volver a habilitarlo hay que cambiar ESTE archivo, no cada pantalla.
//
// Compatibilidad: `delivery_type = 'S'` sigue existiendo en la base para los
// pedidos históricos que se hicieron con esa modalidad. Nada nuevo lo escribe y
// no se muestra ninguna sucursal ni direccion de retiro: solo se etiqueta la
// modalidad.
import type { DeliveryType } from "../types.ts";

/** Interruptor maestro. `false` = no se ofrece retiro en persona. */
export const PICKUP_ENABLED = false;

export const PICKUP_DISABLED_MESSAGE =
  "El retiro en persona no está disponible. Todos los pedidos se envían a domicilio.";

/** Un pedido con `delivery_type = 'S'` en la base (histórico). */
export const PICKUP_DELIVERY_TYPE: DeliveryType = "S";

export function pickupEnabled(): boolean {
  return PICKUP_ENABLED;
}

function isPickupRequest(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toUpperCase() === "S";
}

export type DeliveryTypeResolution =
  | { ok: true; deliveryType: DeliveryType }
  | { ok: false; error: string };

/**
 * Resuelve la modalidad de un pedido a partir de lo que manda el cliente.
 *
 * Con el retiro desactivado, cualquier intento de pedirlo se rechaza en el
 * backend con un mensaje claro. Vacío o ausente significa "a domicilio", que es
 * la única modalidad disponible.
 */
export function resolveDeliveryType(raw: unknown): DeliveryTypeResolution {
  if (isPickupRequest(raw)) {
    return { ok: false, error: PICKUP_DISABLED_MESSAGE };
  }
  return { ok: true, deliveryType: "D" };
}

/** Filtra las opciones de una cotización para dejar solo las permitidas. */
export function allowedDeliveryTypes(): DeliveryType[] {
  return PICKUP_ENABLED ? ["D", "S"] : ["D"];
}

/**
 * Descarta de una cotización cualquier modalidad que no esté habilitada.
 * Es la barrera final: aunque un provider devuelva retiro en persona, mientras
 * PICKUP_ENABLED sea false nunca llega al checkout.
 */
export function filterAllowedOptions<T extends { deliveryType: DeliveryType }>(
  options: T[]
): T[] {
  const allowed = allowedDeliveryTypes();
  return options.filter((o) => allowed.includes(o.deliveryType));
}

/**
 * Etiqueta de modalidad para mostrar al cliente y en los correos.
 * Nunca incluye el código interno de agencia: un código de sucursal no es un
 * nombre de punto de retiro y mostrárlo confunde.
 */
export function deliveryModalityLabel(deliveryType: string): string {
  return deliveryType === "S" ? "Retirada en persona" : "Envío a domicilio";
}
