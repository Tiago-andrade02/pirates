// Webhook entrante de WhatsApp Business (Cloud API de Meta).
//
// Modulo PURO: sin process.env, sin fetch y sin base de datos. Todo lo que se
// puede testear vive aca y la ruta solo aporta lo que necesita I/O (leer el
// cuerpo crudo, consultar el token de env y escribir en Turso).
//
// Meta usa el MISMO endpoint para dos operaciones distintas: un GET de
// verificacion (suscripcion del webhook) y un POST con los eventos. Por eso la
// ruta exporta los dos handlers.

import crypto from "node:crypto";

// Header con el que Meta firma los POST. El prefijo "sha256=" va incluido en el
// valor del header.
export const WHATSAPP_SIGNATURE_HEADER = "x-hub-signature-256";

// Texto maximo que se guarda. El limite de WhatsApp para un mensaje de texto es
// 4096 caracteres; se guarda igual para no perder el final de un mensaje largo.
export const MAX_BODY_CHARS = 4096;

// Etiquetas de nuestros numeros. Se guardan ademas del ID crudo para poder
// distinguir en la base cual de los dos numeros recibio el mensaje, sin tener que
// volver a consultar las variables de entorno cada vez que se lee una fila.
export const NUMBER_LABEL_PRIMARY = "numero-1";
export const NUMBER_LABEL_SECONDARY = "numero-2";
export const NUMBER_LABEL_UNKNOWN = "desconocido";

// ---------------------------------------------------------------------------
// Verificacion de la suscripcion (GET)
// ---------------------------------------------------------------------------

export interface SubscriptionParams {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}

// Compara en tiempo constante. crypto.timingSafeEqual exige buffers del MISMO
// largo y tira si no lo son, asi que se hashea cada lado: el hash siempre mide lo
// mismo y la comparacion no se puede acortar por longitud.
function constantTimeEquals(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Responde true SOLO si es un pedido de suscripcion con el token exacto.
//
// Falla cerrado en los tres casos que importan: modo distinto de "subscribe",
// token ausente o vacio, o challenge ausente. Comparar con `===` filtraria el
// token caracter por caracter, por eso va por constantTimeEquals.
export function isValidSubscription(
  params: SubscriptionParams,
  expectedToken: string
): boolean {
  if (!expectedToken) return false;
  if (params.mode !== "subscribe") return false;
  if (!params.verifyToken || !params.challenge) return false;
  return constantTimeEquals(params.verifyToken, expectedToken);
}

// ---------------------------------------------------------------------------
// Verificacion de la firma (POST)
// ---------------------------------------------------------------------------

export function computeSignature(rawBody: string, appSecret: string): string {
  return (
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  );
}

// La firma se calcula sobre el CUERPO CRUDO, byte a byte. Por eso la ruta lee
// `await request.text()` y recien despues parsea el JSON: si se parseara primero
// y se reserializara, el HMAC no coincidiria nunca.
//
// Devuelve false (y nunca lanza) si falta el header, el secreto o el prefijo:
// un POST sin firma verificable es un POST no autenticado.
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!appSecret || !signatureHeader) return false;
  if (!signatureHeader.startsWith("sha256=")) return false;

  const provided = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const expected = computeSignature(rawBody, appSecret);
  return constantTimeEquals(provided, expected.slice("sha256=".length));
}

// ---------------------------------------------------------------------------
// Identificacion de nuestros numeros
// ---------------------------------------------------------------------------

export interface OurNumberConfig {
  primaryId: string;
  secondaryId: string;
}

export function ourNumberLabel(
  phoneNumberId: string,
  config: OurNumberConfig
): string {
  if (config.primaryId && phoneNumberId === config.primaryId) {
    return NUMBER_LABEL_PRIMARY;
  }
  if (config.secondaryId && phoneNumberId === config.secondaryId) {
    return NUMBER_LABEL_SECONDARY;
  }
  return NUMBER_LABEL_UNKNOWN;
}

// ---------------------------------------------------------------------------
// Parsing del payload de Meta
// ---------------------------------------------------------------------------

export const EVENT_MESSAGE = "messages";
export const EVENT_STATUS = "message_status";

export interface IncomingWhatsAppEvent {
  // Identificador del mensaje (wamid.Id). Es el ID que usa Meta.
  wamid: string;
  // Clave de deduplicacion. Ver messageDedupeKey.
  dedupeKey: string;
  // "messages" (un mensaje entrante) o "message_status" (cambio de estado).
  eventType: string;
  // A cual de nuestros numeros llego. "" si Meta no lo mando.
  ourPhoneNumberId: string;
  ourNumberLabel: string;
  // Quien escribe (wa_id del contacto) y a quien le escribimos.
  fromNumber: string;
  toNumber: string;
  // "text", "image", "interactive", ... o "" para un evento de estado.
  messageType: string;
  // Texto del mensaje o una descripcion legible si no es texto.
  body: string;
  // "sent", "delivered", "read", "failed"... vacio para un mensaje entrante.
  status: string;
  // ISO 8601. Sale del timestamp del evento; si falta, el nowIso de entrada.
  createdAt: string;
}

function text(value: unknown, max = MAX_BODY_CHARS): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max - 3) + "..." : trimmed;
}

function unixSecondsToIso(seconds: unknown, fallbackIso: string): string {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return fallbackIso;
  try {
    return new Date(n * 1000).toISOString();
  } catch {
    return fallbackIso;
  }
}

// Traduce un mensaje entrante a texto legible.
//
// Un mensaje de WhatsApp NO siempre trae texto: puede ser una foto, un audio, una
// ubicacion o un boton de un menu. Para esos se guarda una descripcion corta en
// vez del contenido binario, que no se puede recuperar igual desde la API sin
// descargar el archivo.
export function describeIncomingMessage(value: Record<string, unknown>): string {
  const type = text(value["type"], 40);

  if (type === "text") {
    const body = (value["text"] as Record<string, unknown> | undefined)?.["body"];
    return text(body);
  }

  if (type === "interactive") {
    const interactive = (value["interactive"] ?? {}) as Record<string, unknown>;
    const reply =
      (interactive["button_reply"] as Record<string, unknown> | undefined) ??
      (interactive["list_reply"] as Record<string, unknown> | undefined);
    if (reply) {
      const title = text(reply["title"] ?? reply["id"], 300);
      return title ? `[boton] ${title}` : "[boton]";
    }
    return "[respuesta interactiva]";
  }

  if (type === "button") {
    const button = (value["button"] as Record<string, unknown> | undefined) ?? {};
    const title = text(button["text"] ?? button["payload"], 300);
    return title ? `[boton] ${title}` : "[boton]";
  }

  if (type === "reaction") {
    const reaction = (value["reaction"] as Record<string, unknown> | undefined) ?? {};
    return `[reaccion] ${text(reaction["emoji"], 32) || "sin emoji"}`;
  }

  if (type === "location") {
    const location = (value["location"] as Record<string, unknown> | undefined) ?? {};
    const name = text(location["name"] ?? location["address"], 300);
    const lat = text(location["latitude"], 32);
    const lng = text(location["longitude"], 32);
    const coords = lat && lng ? ` (${lat}, ${lng})` : "";
    return `[ubicacion] ${name}${coords}`.trim();
  }

  if (type === "contacts") {
    return "[contactos compartidos]";
  }

  if (type === "order") {
    return "[pedido de WhatsApp]";
  }

  if (type === "image") {
    const image = (value["image"] as Record<string, unknown> | undefined) ?? {};
    return text(image["caption"]) || "[imagen]";
  }
  if (type === "audio") {
    const audio = (value["audio"] as Record<string, unknown> | undefined) ?? {};
    return audio["voice"] ? "[nota de voz]" : "[audio]";
  }
  if (type === "video") {
    const video = (value["video"] as Record<string, unknown> | undefined) ?? {};
    return text(video["caption"]) || "[video]";
  }
  if (type === "document") {
    const doc = (value["document"] as Record<string, unknown> | undefined) ?? {};
    const name = text(doc["filename"], 200);
    return name ? `[documento] ${name}` : "[documento]";
  }
  if (type === "sticker") {
    return "[sticker]";
  }

  // "system" y "unknown" llegan sin cuerpo utilizable. Se marca como no
  // soportado en vez de inventar un texto.
  return type ? `[${type}]` : "[sin contenido]";
}

// Clave de deduplicacion.
//
// Un wamid identifica UN mensaje, pero Meta reenvia el mismo evento si no
// recebe 200, y ademas manda un evento NUEVO por cada cambio de estado del mismo
// mensaje (sent -> delivered -> read). Si la clave fuera solo el wamid, el
// reenvio se descartaria bien pero "delivered" y "read" se perderian como
// duplicados del "sent". Por eso los estados suman su status a la clave: un
// reenvio exacto cae en la misma clave, y cada transicion real trae una nueva.
export function messageDedupeKey(wamid: string, eventType: string, status: string): string {
  return eventType === EVENT_STATUS ? `${wamid}:${status}` : wamid;
}

export interface ParseOptions {
  // IDs de nuestros numeros, para etiquetar cada mensaje.
  numbers: OurNumberConfig;
  // ISO de respaldo para eventos sin timestamp.
  nowIso: string;
}

// Cuerpo que no es JSON, o que no es ni un objeto ni un array. Es distinto de
// "un JSON valido sin eventos que nos interesen": lo primero es un problema que
// hay que hacer visible, lo segundo es normal (un campo al que no estamos
// suscritos, un status sin transiciones, etc.).
export class MalformedWebhookPayloadError extends Error {
  constructor(reason: string) {
    super(`Payload de WhatsApp mal formado: ${reason}`);
    this.name = "MalformedWebhookPayloadError";
  }
}

// Recorre el payload de Meta y devuelve una lista plana de eventos.
//
// Estructura real de un POST (un mismo `value` puede traer `messages` Y
// `statuses` juntos, que es el caso mas comun y el que se suele romper):
//   object -> entry[] -> changes[] -> value{ metadata, messages[], statuses[] }
//
// Devuelve [] cuando el JSON es valido pero no trae eventos guardables. Lanza
// MalformedWebhookPayloadError si el cuerpo no se puede interpretar, para que la
// ruta lo distinga de "no hay nada que hacer" y no responda 200 en silencio.
export function parseWebhookPayload(
  rawBody: string,
  options: ParseOptions
): IncomingWhatsAppEvent[] {
  if (!rawBody.trim()) {
    throw new MalformedWebhookPayloadError("cuerpo vacio");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new MalformedWebhookPayloadError("no es JSON valido");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new MalformedWebhookPayloadError(`raiz ${typeof parsed}, se esperaba un objeto`);
  }

  const root = parsed as Record<string, unknown>;
  const entries = Array.isArray(root["entry"]) ? (root["entry"] as unknown[]) : [];
  const events: IncomingWhatsAppEvent[] = [];

  for (const entry of entries) {
    const changes = (entry as Record<string, unknown>)?.["changes"];
    if (!Array.isArray(changes)) continue;

    for (const change of changes as Record<string, unknown>[]) {
      const value = change?.["value"] as Record<string, unknown> | undefined;
      if (!value) continue;

      // `metadata.phone_number_id` es el ID del numero que RECIBIO el mensaje:
      // es lo unico que dice a cual de los dos ours fue.
      const metadata = (value["metadata"] ?? {}) as Record<string, unknown>;
      const ourId = text(metadata["phone_number_id"], 64);
      const ourLabel = ourNumberLabel(ourId, options.numbers);
      const ourPhone = text(metadata["display_phone_number"], 32);

      const messages = Array.isArray(value["messages"]) ? (value["messages"] as unknown[]) : [];
      for (const raw of messages) {
        const message = raw as Record<string, unknown>;
        const wamid = text(message["id"], 128);
        if (!wamid) continue;
        events.push({
          wamid,
          dedupeKey: messageDedupeKey(wamid, EVENT_MESSAGE, ""),
          eventType: EVENT_MESSAGE,
          ourPhoneNumberId: ourId,
          ourNumberLabel: ourLabel,
          fromNumber: text(message["from"], 32),
          // El destinatario es nuestro numero. Se usa el que manda Meta y, si
          // viniera vacio, el display_phone_number como respaldo.
          toNumber: text(message["to"], 32) || ourPhone,
          messageType: text(message["type"], 40),
          body: describeIncomingMessage(message),
          status: "",
          createdAt: unixSecondsToIso(message["timestamp"], options.nowIso),
        });
      }

      const statuses = Array.isArray(value["statuses"]) ? (value["statuses"] as unknown[]) : [];
      for (const raw of statuses) {
        const status = raw as Record<string, unknown>;
        const wamid = text(status["id"], 128);
        if (!wamid) continue;
        const state = text(status["status"], 32);
        events.push({
          wamid,
          dedupeKey: messageDedupeKey(wamid, EVENT_STATUS, state),
          eventType: EVENT_STATUS,
          ourPhoneNumberId: ourId,
          ourNumberLabel: ourLabel,
          // En un evento de estado los papeles estan invertidos: nosotros
          // escribimos y el status va dirigido al que recibio el mensaje.
          fromNumber: ourPhone,
          toNumber: text(status["recipient_id"], 32),
          messageType: "",
          body: "",
          status: state,
          createdAt: unixSecondsToIso(status["timestamp"], options.nowIso),
        });
      }
    }
  }

  return events;
}