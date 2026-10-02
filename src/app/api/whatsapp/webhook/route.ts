// Webhook de WhatsApp Business (Cloud API de Meta).
//
// Un solo endpoint para las dos cosas que Meta hace contra el:
//   GET  -> verificacion de suscripcion (hub.mode / hub.verify_token /
//           hub.challenge).
//   POST -> los eventos: mensajes entrantes y cambios de estado.
//
// Configuracion en Meta: WhatsApp Manager > Configuration > Webhooks > Callback
// URL = https://<dominio>/api/whatsapp/webhook, Verify token =
// WHATSAPP_VERIFY_TOKEN, y suscribirse al campo "messages".
//
// Decisiones de diseno que conviene conocer antes de tocarla:
//
// 1. El cuerpo se lee CRUDO. La firma de Meta es un HMAC del body exacto: si se
//    parseara el JSON y se reserializara, el hash nunca coincidiria. Por eso
//    `await request.text()` va primero y recien despues se parsea.
//
// 2. Se responde 200 recien guardado el mensaje. Meta reintenta si no recibe 200
//    dentro de ~20s, y como la escritura va protegida por un indice UNIQUE,
//    reintentar es inofensivo. Esto se prefirio a responder 200 y persistir
//    despues: si el guardado fallara con la respuesta ya enviada, el mensaje se
//    perderia sin reintento. Un INSERT unico es de milisegundos.
//
// 3. Falla cerrado. Sin WHATSAPP_VERIFY_TOKEN el GET devuelve 503 y sin
//    WHATSAPP_APP_SECRET el POST devuelve 503: es preferible que Meta vea un
//    error visible a que quede "suscrito" contra un endpoint que no valida nada.
//
// 4. Nada de esto responde automaticamente a los clientes. Solo se guarda.
import {
  isValidSubscription,
  verifyWebhookSignature,
  parseWebhookPayload,
  MalformedWebhookPayloadError,
  NUMBER_LABEL_UNKNOWN,
  WHATSAPP_SIGNATURE_HEADER,
  type OurNumberConfig,
} from "@/lib/whatsapp/webhook.ts";
import { storeIncomingMessages } from "@/lib/whatsapp/inbound-store.ts";

// Meta espera una respuesta rapida: sin esto el handler se cachea como estatico.
export const dynamic = "force-dynamic";

function ourNumbers(): OurNumberConfig {
  return {
    primaryId: (process.env.WHATSAPP_PHONE_NUMBER_ID ?? "").trim(),
    secondaryId: (process.env.WHATSAPP_PHONE_NUMBER_ID_2 ?? "").trim(),
  };
}

// Verificacion de suscripcion de Meta.
export async function GET(request: Request) {
  const token = (process.env.WHATSAPP_VERIFY_TOKEN ?? "").trim();
  if (!token) {
    // Sin token no se puede autenticar a Meta. 503 para que quede visible en el
    // panel en vez de devolver un 403 que parece un problema de configuracion.
    return new Response("WHATSAPP_VERIFY_TOKEN no configurado", { status: 503 });
  }

  const url = new URL(request.url);
  const ok = isValidSubscription(
    {
      mode: url.searchParams.get("hub.mode"),
      verifyToken: url.searchParams.get("hub.verify_token"),
      challenge: url.searchParams.get("hub.challenge"),
    },
    token
  );

  if (!ok) {
    // Respuesta generica: no se distingue token incorrecto de challenge
    // faltante, para no darle informacion a quien pruebe el endpoint.
    return new Response("Verificación fallida", { status: 403 });
  }

  // Meta espera el challenge crudo, no JSON.
  return new Response(url.searchParams.get("hub.challenge") ?? "", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const appSecret = (process.env.WHATSAPP_APP_SECRET ?? "").trim();
  if (!appSecret) {
    return new Response("WHATSAPP_APP_SECRET no configurado", { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get(WHATSAPP_SIGNATURE_HEADER);

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    // 401 y nada mas: no se registra el cuerpo ni se distingue si fallo la
    // firma o simplemente no vino.
    return new Response("Firma inválida", { status: 401 });
  }

  let events;
  try {
    events = parseWebhookPayload(rawBody, {
      numbers: ourNumbers(),
      nowIso: new Date().toISOString(),
    });
  } catch (error) {
    // Firma valida pero cuerpo ilegible: o Meta mando algo que no entendemos, o
    // el parser cambio y ya no matchea el formato. Un 200 en silencio haria perder
    // el mensaje sin que nadie se entere, asi que se corta con 400. No se loguea
    // el cuerpo porque puede traer datos de clientes.
    const reason = error instanceof MalformedWebhookPayloadError ? error.message : "error inesperado";
    console.error(`[whatsapp] ${reason}`);
    return new Response("Payload inválido", { status: 400 });
  }

  if (events.length === 0) {
    // JSON valido sin eventos guardables (campo al que no estamos suscritos, o
    // un mensaje sin wamid). No es un error: se acusa recibo para que Meta no
    // reintente.
    return Response.json({ ok: true, received: 0, stored: 0, duplicates: 0 });
  }

  try {
    const result = await storeIncomingMessages(events);
    if (result.duplicates > 0) {
      // Solo conteos: el body puede contener mensajes de clientes.
      console.warn(
        `[whatsapp] ${result.duplicates} evento(s) repetido(s) ignorado(s) por ${events.length}`
      );
    }
    if (events.some((e) => e.ourNumberLabel === NUMBER_LABEL_UNKNOWN)) {
      // Meta agrego un numero a la cuenta que no esta en las variables.
      console.warn(
        "[whatsapp] Llego un mensaje a un phone_number_id no configurado: revisá WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_PHONE_NUMBER_ID_2"
      );
    }
    return Response.json({ ok: true, received: events.length, ...result });
  } catch (error) {
    // Se devuelve 500 a proposito: Meta va a reintentar y el indice UNIQUE hace
    // que el reintento no duplique nada. Perder el mensaje en silencio seria peor.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[whatsapp] No se pudieron guardar los mensajes: ${message}`);
    return new Response("Error al guardar", { status: 500 });
  }
}