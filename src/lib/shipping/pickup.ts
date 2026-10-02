// MODALIDADES DE ENTREGA.
//
// Este módulo es la ÚNICA fuente de verdad de qué modalidades existen, para que
// el checkout, la API de cotización y el admin no puedan quedar en desacuerdo
// (el caso anterior: el formulario ofrecía retiro, la lista de sucursales venía
// vacía y el checkout rechazaba el pedido con 400).
//
// Hay exactamente DOS modalidades y las dos son gratuitas:
//   - "D" → envío a domicilio.
//   - "S" → envío a sucursal de Correo Argentino, a COORDINAR POR WHATSAPP.
//
// La modalidad "S" NO tiene lista de sucursales ni selector con desplegable: no
// hay integración con el padrón de Correo Argentino, así que no se puede saber
// qué sucursales existen, si atienden un CP o si tienen stock. El cliente puede
// escribir libremente qué sucursal prefiere (dato opcional, texto libre) y la
// coordinación se hace por WhatsApp. No se valida contra ninguna agencia ni se
// guarda ningún código interno en `agency_code`.
//
// Para apagar la modalidad "S" de golpe hay que cambiar ESTE archivo
// (PICKUP_ENABLED = false), no cada pantalla: el checkout vuelve a mostrar solo
// domicilio y la API vuelve a rechazar "S" con 400.
import type { DeliveryType } from "../types.ts";

/** Interruptor maestro de la modalidad sucursal. `false` = solo domicilio. */
export const PICKUP_ENABLED = true;

export const PICKUP_DISABLED_MESSAGE =
  "El envío a sucursal no está disponible por el momento. Todos los pedidos se envían a domicilio.";

/** Etiqueta de la modalidad sucursal, para el cliente, el admin y los avisos. */
export const BRANCH_DELIVERY_LABEL = "Envío a sucursal de Correo Argentino";

/** Modalidad del envío a sucursal. */
export const PICKUP_DELIVERY_TYPE: DeliveryType = "S";

/** Modalidad del envío a domicilio. */
export const HOME_DELIVERY_TYPE: DeliveryType = "D";

export function pickupEnabled(): boolean {
  return PICKUP_ENABLED;
}

function isBranchRequest(raw: unknown): boolean {
  return typeof raw === "string" && raw.trim().toUpperCase() === "S";
}

export type DeliveryTypeResolution =
  | { ok: true; deliveryType: DeliveryType }
  | { ok: false; error: string };

/**
 * Resuelve la modalidad de un pedido a partir de lo que manda el cliente.
 *
 * Solo el literal "S" (en cualquier casing, con espacios) elige sucursal.
 * Ausente, vacío, "D" o cualquier valor desconocido se normaliza a "D": un
 * cliente guardado no puede inventarse una modalidad.
 *
 * Si el interruptor maestro está apagado, "S" se rechaza en el backend con un
 * mensaje claro, en vez de crear un pedido que después no se puede despachar.
 */
export function resolveDeliveryType(raw: unknown): DeliveryTypeResolution {
  if (isBranchRequest(raw)) {
    if (!PICKUP_ENABLED) {
      return { ok: false, error: PICKUP_DISABLED_MESSAGE };
    }
    return { ok: true, deliveryType: PICKUP_DELIVERY_TYPE };
  }
  return { ok: true, deliveryType: HOME_DELIVERY_TYPE };
}

/** Modalidades que el checkout puede ofrecer, en el orden en que se muestran. */
export function allowedDeliveryTypes(): DeliveryType[] {
  return PICKUP_ENABLED ? [HOME_DELIVERY_TYPE, PICKUP_DELIVERY_TYPE] : [HOME_DELIVERY_TYPE];
}

/**
 * Descarta de una cotización cualquier modalidad que no esté habilitada.
 * Última barrera: aunque un provider devuelva algo raro, solo pasa lo que el
 * interruptor maestro permite.
 */
export function filterAllowedOptions<T extends { deliveryType: DeliveryType }>(
  options: T[]
): T[] {
  const allowed = allowedDeliveryTypes();
  return options.filter((o) => allowed.includes(o.deliveryType));
}

/**
 * Etiqueta de modalidad para mostrar al cliente, en los correos y en los avisos.
 * Nunca incluye el código interno de agencia: un código de sucursal no es un
 * nombre de punto de retiro y mostrarlo confunde.
 */
export function deliveryModalityLabel(deliveryType: string): string {
  return deliveryType === "S" ? BRANCH_DELIVERY_LABEL : "Envío a domicilio";
}