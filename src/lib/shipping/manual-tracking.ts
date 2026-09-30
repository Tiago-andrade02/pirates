// SEGUIMIENTO MANUAL DE CORREO ARGENTINO.
//
// PIRATES no integra la API de Correo Argentino: el tracking se carga a mano en
// el panel de admin. Este módulo es la lógica PURA de esa carga (normalizar la
// entrada, decidir qué cambia, qué estado queda y qué evento se agrega) para que
// se pueda testear sin base de datos, sin SMTP y sin red.
//
// Reglas que se respetan acá:
//  - El envío es siempre gratis: esto no toca precio ni pagos.
//  - No se inventan eventos: el único evento que se crea es "Despachado", que es
//    exactamente lo que el administrador acaba de afirmar al cargar el código.
//  - No se afirma entrega: no hay ningún evento ni estado "entregado" aqui.
//  - Reintentar con el mismo código no duplica el aviso ni reescribe el pedido.
import type { OrderStatus, TrackingEvent } from "../types.ts";

/** Enlace oficial de seguimiento de Correo Argentino. */
export const OFFICIAL_CORREO_ARGENTINO_TRACKING_URL =
  "https://www.correoargentino.com.ar/formularios/seguimiento";

/**
 * Proveedor y servicio con los que queda registrado un envío manual.
 *
 * El transporte ES Correo Argentino (lo afirma el administrador al cargar el
 * código), asi que se guardan sus identificadores en vez de dejar el
 * `flat_rate` del checkout, que el panel mostraria como "Tarifa fija".
 */
export const MANUAL_SHIPPING_PROVIDER = "correo_argentino";
export const MANUAL_SHIPPING_SERVICE = "CP";

export const MANUAL_DISPATCH_EVENT_LABEL = "Despachado por Correo Argentino";
export const MANUAL_DISPATCH_EVENT_STATUS = "enviado";

const MAX_TRACKING_NUMBER_LENGTH = 40;
const MAX_TRACKING_URL_LENGTH = 500;

// Estados desde los que SÍ se puede cargar un seguimiento manual.
//
// Un pedido sólo puede salir cuando el pago está confirmado. Si todavía está
// `pendiente` (o el pedido se canceló o quedó sin stock) NO se marca como
// despachado ni se le avisa al cliente: la acción tiene que rechazarse y dejar
// el pedido intacto. `entregado` se permite para poder corregir el código de un
// envío ya cerrado, pero nunca se retrocede el estado.
export const MANUAL_TRACKING_ALLOWED_STATUSES: OrderStatus[] = [
  "pagado",
  "preparando",
  "enviado",
  "entregado",
];

// Subconjunto desde el que tiene sentido decirle al cliente "tu pedido salió".
// Un pedido ya entregado (o cancelado / sin stock) no recibe el aviso de
// despacho.
export const DISPATCH_NOTIFIABLE_STATUSES: OrderStatus[] = [
  "pagado",
  "preparando",
  "enviado",
];

export const MANUAL_TRACKING_BLOCKED_MESSAGE =
  "Solo se puede cargar el seguimiento cuando el pedido está pagado, en preparación o enviado.";

/** True si el pedido admite cargar/corregir un seguimiento manual. */
export function canManualTrack(status: OrderStatus): boolean {
  return MANUAL_TRACKING_ALLOWED_STATUSES.includes(status);
}

/** True si corresponde enviarle al cliente el aviso de despacho. */
export function canNotifyDispatch(status: OrderStatus): boolean {
  return DISPATCH_NOTIFIABLE_STATUSES.includes(status);
}

/**
 * Código de error (para la URL del panel) que explica por qué se rechazó la
 * carga. No expone datos: solo el motivo, para que la pantalla muestre un
 * mensaje claro.
 */
export function manualTrackingBlockedReason(status: OrderStatus): string {
  switch (status) {
    case "pendiente":
      return "tracking-no-pagado";
    case "cancelado":
      return "tracking-cancelado";
    case "sin_stock":
      return "tracking-sin-stock";
    default:
      return "tracking-estado-invalido";
  }
}

/**
 * Normaliza el código de seguimiento.
 *
 * Se quitan todos los espacios (los códigos de Correo Argentino son alfanuméricos
 * y a veces se pegan con separadores) y se pasa a mayúsculas para que " 1234 ab "
 * y "1234AB" sean reconocidos como el MISMO envío y no disparen dos avisos.
 */
export function normalizeTrackingNumber(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Solo letras, números y guiones, con largo acotado. */
export function isValidTrackingNumber(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_TRACKING_NUMBER_LENGTH &&
    /^[A-Z0-9-]+$/.test(value)
  );
}

export function maxTrackingNumberLength(): number {
  return MAX_TRACKING_NUMBER_LENGTH;
}

function parseTrackingUrl(raw: string): string {
  if (raw.length > MAX_TRACKING_URL_LENGTH) return "";
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return "";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
  return parsed.toString();
}

/** Normaliza una URL de seguimiento. Vacío o inválida devuelve "". */
export function normalizeTrackingUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return parseTrackingUrl(raw.trim());
}

export type TrackingUrlResolution =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Valida la URL opcional que manda el administrador.
 *
 * Vacía es válido (se usa el enlace oficial). Pero una URL que se escribe y no es
 * usable tiene que dar error, no guardarse en silencio: el cliente vería un
 * enlace roto.
 */
export function resolveTrackingUrlInput(raw: unknown): TrackingUrlResolution {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: true, value: "" };
  }
  const value = parseTrackingUrl(raw.trim());
  if (!value) {
    return {
      ok: false,
      error: "La URL de seguimiento no es válida. Usá un enlace http/https o dejalo vacío.",
    };
  }
  return { ok: true, value };
}

/**
 * Enlace oficial de seguimiento, con override por entorno.
 * Si el override no es una URL utilizable se ignora: es preferible el enlace
 * oficial conocido a un valor roto.
 */
export function officialTrackingUrl(): string {
  const raw = (process.env.CORREO_ARGENTINO_TRACKING_URL ?? "").trim();
  if (raw) {
    const normalized = parseTrackingUrl(raw);
    if (normalized) return normalized;
  }
  return OFFICIAL_CORREO_ARGENTINO_TRACKING_URL;
}

/**
 * URL que se persiste y se muestra. Prioridad: la que carga el admin, la que ya
 * tenia el pedido, y por ultimo el enlace oficial. Nunca queda vacia, para que
 * el cliente siempre tenga como consultar el estado.
 */
export function effectiveTrackingUrl(stored: string, submitted: string): string {
  const fromSubmitted = parseTrackingUrl((submitted ?? "").trim());
  if (fromSubmitted) return fromSubmitted;
  const fromStored = parseTrackingUrl((stored ?? "").trim());
  if (fromStored) return fromStored;
  return officialTrackingUrl();
}

/**
 * Enlace clickeable para mostrar el seguimiento en la web.
 *
 * - Sin URL guardada: devuelve el enlace oficial (siempre http/https).
 * - Con una URL guardada válida (http/https): la devuelve normalizada.
 * - Con una URL guardada NO válida (p. ej. `javascript:alert(1)`): devuelve
 *   `null` para que la pantalla no genere un enlace con un destino inseguro.
 *
 * Se revalida al renderizar a propósito: aunque hoy sólo se guardan URLs
 * http/https, una fila histórica o importada podría traer otro esquema y no se
 * debe convertir en un link clickeable.
 */
export function safeTrackingHref(stored: string): string | null {
  const raw = (stored ?? "").trim();
  if (!raw) return officialTrackingUrl();
  return normalizeTrackingUrl(raw) || null;
}

/** Agrega el evento de despacho sin duplicarlo si ya esta (misma etiqueta y fecha). */
export function appendDispatchEvent(
  existing: TrackingEvent[],
  date: string
): TrackingEvent[] {
  const list = Array.isArray(existing) ? existing : [];
  const already = list.some(
    (e) => e?.event === MANUAL_DISPATCH_EVENT_LABEL && e?.date === date
  );
  if (already) return list;
  return [
    ...list,
    {
      event: MANUAL_DISPATCH_EVENT_LABEL,
      date,
      branch: null,
      status: MANUAL_DISPATCH_EVENT_STATUS,
      sign: "+",
    },
  ];
}

/**
 * Estado del pedido tras cargar el seguimiento.
 *
 * Nunca retrocede ni "inventa" un despacho: un pedido entregado sigue entregado
 * y un estado no autorizado (pendiente/cancelado/sin_stock) no se toca. Como
 * `applyManualTracking` los rechaza antes, aquí solo queda decidir entre
 * `enviado` y dejar el estado como está.
 */
export function resolveManualStatus(
  currentStatus: OrderStatus,
  numberChanged: boolean
): OrderStatus {
  if (!numberChanged) return currentStatus;
  if (!canManualTrack(currentStatus)) return currentStatus;
  if (currentStatus === "entregado") return currentStatus;
  return "enviado";
}

export interface ManualTrackingInput {
  /** Codigo ya normalizado por el admin. */
  trackingNumber: string;
  /** URL ya normalizada. Vacia = usar la guardada o la oficial. */
  trackingUrl: string;
  currentNumber: string;
  currentUrl: string;
  currentShippedAt: string | null;
  currentEvents: TrackingEvent[];
  currentStatus: OrderStatus;
  now: string;
}

export interface ManualTrackingApplied {
  ok: true;
  /** Hay algo que escribir en la base. False = no se toca el pedido. */
  changed: boolean;
  /** El codigo de seguimiento es distinto al que tenia el pedido. */
  numberChanged: boolean;
  urlChanged: boolean;
  /** Hay que avisarle al cliente. Solo cuando el codigo cambio de verdad. */
  notifyCustomer: boolean;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string;
  status: OrderStatus;
  events: TrackingEvent[];
  provider: string;
  service: string;
}

/** El pedido no admite seguimiento (pago no confirmado o estado terminal). */
export interface ManualTrackingBlocked {
  ok: false;
  error: string;
}

export type ManualTrackingOutcome = ManualTrackingApplied | ManualTrackingBlocked;

export function applyManualTracking(
  input: ManualTrackingInput
): ManualTrackingOutcome {
  // Barrera principal: si el pedido no se puede despachar, no se calcula ni se
  // escribe nada. El llamador debe dejar el pedido intacto y mostrar el motivo.
  if (!canManualTrack(input.currentStatus)) {
    return { ok: false, error: MANUAL_TRACKING_BLOCKED_MESSAGE };
  }

  const trackingNumber = normalizeTrackingNumber(input.trackingNumber);
  const trackingUrl = effectiveTrackingUrl(input.currentUrl, input.trackingUrl);
  const currentNumber = normalizeTrackingNumber(input.currentNumber);

  const numberChanged = trackingNumber !== currentNumber;
  const urlChanged = trackingUrl !== (input.currentUrl ?? "");
  const shippedAt = input.currentShippedAt ?? input.now;
  const status = resolveManualStatus(input.currentStatus, numberChanged);
  const events = numberChanged
    ? appendDispatchEvent(input.currentEvents, input.now)
    : input.currentEvents;

  const changed =
    numberChanged ||
    urlChanged ||
    status !== input.currentStatus ||
    shippedAt !== input.currentShippedAt;

  return {
    ok: true,
    changed,
    numberChanged,
    urlChanged,
    // El aviso al cliente se manda solo si el codigo cambio y el pedido esta en
    // un estado del que tenga sentido decir "salio". Reintentar con el mismo
    // codigo no vuelve a notificar.
    notifyCustomer: numberChanged && canNotifyDispatch(input.currentStatus),
    trackingNumber,
    trackingUrl,
    shippedAt,
    status,
    events,
    provider: MANUAL_SHIPPING_PROVIDER,
    service: MANUAL_SHIPPING_SERVICE,
  };
}
