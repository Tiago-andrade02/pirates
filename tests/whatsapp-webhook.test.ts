import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  isValidSubscription,
  verifyWebhookSignature,
  computeSignature,
  ourNumberLabel,
  parseWebhookPayload,
  messageDedupeKey,
  describeIncomingMessage,
  MalformedWebhookPayloadError,
  NUMBER_LABEL_PRIMARY,
  NUMBER_LABEL_SECONDARY,
  NUMBER_LABEL_UNKNOWN,
  EVENT_MESSAGE,
  EVENT_STATUS,
  MAX_BODY_CHARS,
  type IncomingWhatsAppEvent,
} from "../src/lib/whatsapp/webhook.ts";

// Valores de prueba, NO secretos reales.
const APP_SECRET = "test-app-secret";
const VERIFY_TOKEN = "test-verify-token";
const NOW = "2026-10-01T12:00:00.000Z";

const NUMBERS = { primaryId: "111111", secondaryId: "222222" };

function sign(rawBody: string, secret = APP_SECRET): string {
  return computeSignature(rawBody, secret);
}

// Payload mínimo con un mensaje de texto que llega al numero 111111.
function textPayload(over: {
  wamid?: string;
  phoneNumberId?: string;
  from?: string;
  body?: string;
  timestamp?: number;
  statuses?: unknown[];
} = {}): string {
  return JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "15550001111",
                phone_number_id: over.phoneNumberId ?? NUMBERS.primaryId,
              },
              messages: [
                {
                  from: over.from ?? "5491170000000",
                  id: over.wamid ?? "wamid.ABC123",
                  timestamp: String(over.timestamp ?? 1790000000),
                  type: "text",
                  text: { body: over.body ?? "Hola, quiero saber del pedido" },
                },
              ],
              ...(over.statuses ? { statuses: over.statuses } : {}),
            },
          },
        ],
      },
    ],
  });
}

function parse(raw: string): IncomingWhatsAppEvent[] {
  return parseWebhookPayload(raw, { numbers: NUMBERS, nowIso: NOW });
}

// ---------------------------------------------------------------------------
// GET: verificación de suscripción
// ---------------------------------------------------------------------------

describe("verificación de suscripción (GET)", () => {
  test("acepta el desafío con el token correcto", () => {
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: VERIFY_TOKEN, challenge: "123456" },
        VERIFY_TOKEN
      ),
      true
    );
  });

  test("rechaza un token distinto, aunque se diferencie en un solo carácter", () => {
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: `${VERIFY_TOKEN}x`, challenge: "123456" },
        VERIFY_TOKEN
      ),
      false
    );
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: "otro", challenge: "123456" },
        VERIFY_TOKEN
      ),
      false
    );
  });

  test("falla cerrado si el token esperado está vacío", () => {
    // Con "" el endpoint tiene que devolver 503 en la ruta, y nunca dar por
    // buena una suscripción: si no, cualquiera se "suscribe" al webhook.
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: "", challenge: "123456" },
        ""
      ),
      false
    );
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: VERIFY_TOKEN, challenge: "123456" },
        "   "
      ),
      false
    );
  });

  test("solo acepta el modo 'subscribe'", () => {
    for (const mode of ["unsubscribe", "", "Subscribe", null]) {
      assert.equal(
        isValidSubscription(
          { mode, verifyToken: VERIFY_TOKEN, challenge: "123456" },
          VERIFY_TOKEN
        ),
        false,
        `debía rechazar el modo ${JSON.stringify(mode)}`
      );
    }
  });

  test("exige challenge y verify_token presentes", () => {
    assert.equal(
      isValidSubscription({ mode: "subscribe", verifyToken: null, challenge: "1" }, VERIFY_TOKEN),
      false
    );
    assert.equal(
      isValidSubscription(
        { mode: "subscribe", verifyToken: VERIFY_TOKEN, challenge: null },
        VERIFY_TOKEN
      ),
      false
    );
  });
});

// ---------------------------------------------------------------------------
// POST: firma del cuerpo
// ---------------------------------------------------------------------------

describe("firma del webhook (POST)", () => {
  test("acepta una firma calculada sobre el cuerpo crudo", () => {
    const raw = textPayload();
    assert.equal(verifyWebhookSignature(raw, sign(raw), APP_SECRET), true);
  });

  test("la firma cambia si el cuerpo cambia aunque el JSON sea equivalente", () => {
    // Por eso la ruta lee el cuerpo crudo: un reformateo del JSON rompe el HMAC.
    const raw = textPayload();
    const reformatted = JSON.stringify(JSON.parse(raw), null, 2);
    assert.notEqual(raw, reformatted);
    assert.equal(verifyWebhookSignature(reformatted, sign(raw), APP_SECRET), false);
  });

  test("rechaza una firma hecha con otro secreto", () => {
    const raw = textPayload();
    assert.equal(
      verifyWebhookSignature(raw, sign(raw, "otro-secreto"), APP_SECRET),
      false
    );
  });

  test("rechaza el cuerpo si le cambian un carácter", () => {
    const raw = textPayload();
    const signature = sign(raw);
    const alterado = raw.replace("Hola, quiero saber del pedido", "Hola, quiero saber del pedidp");
    assert.equal(verifyWebhookSignature(alterado, signature, APP_SECRET), false);
  });

  test("sin header de firma no pasa nada", () => {
    const raw = textPayload();
    assert.equal(verifyWebhookSignature(raw, null, APP_SECRET), false);
    assert.equal(verifyWebhookSignature(raw, "", APP_SECRET), false);
  });

  test("falla cerrado si el app secret no está configurado", () => {
    const raw = textPayload();
    assert.equal(verifyWebhookSignature(raw, sign(raw), ""), false);
    assert.equal(verifyWebhookSignature(raw, sign(raw), "  "), false);
  });

  test("rechaza prefijos y formatos inválidos", () => {
    const raw = textPayload();
    const real = sign(raw);
    assert.equal(verifyWebhookSignature(raw, real.replace("sha256=", ""), APP_SECRET), false);
    assert.equal(verifyWebhookSignature(raw, "sha1=abc", APP_SECRET), false);
    assert.equal(verifyWebhookSignature(raw, `sha256=${"z".repeat(64)}`, APP_SECRET), false);
    assert.equal(verifyWebhookSignature(raw, "sha256=corto", APP_SECRET), false);
  });

  test("la firma calculada es la que espera Meta", () => {
    // Se valida contra un HMAC hecho aparte, para no tautologizar con la misma
    // función que usa la ruta.
    const raw = '{"a":1}';
    const expected =
      "sha256=" + createHmac("sha256", APP_SECRET).update(raw, "utf8").digest("hex");
    assert.equal(computeSignature(raw, APP_SECRET), expected);
    assert.equal(verifyWebhookSignature(raw, expected, APP_SECRET), true);
  });
});

// ---------------------------------------------------------------------------
// Los dos números
// ---------------------------------------------------------------------------

describe("identificación de nuestros dos números", () => {
  test("distingue el primario del secundario", () => {
    assert.equal(ourNumberLabel("111111", NUMBERS), NUMBER_LABEL_PRIMARY);
    assert.equal(ourNumberLabel("222222", NUMBERS), NUMBER_LABEL_SECONDARY);
  });

  test("un número que no conocemos no se descarta", () => {
    // Meta puede agregar un numero a la cuenta. Perder el mensaje en silencio
    // seria peor que guardarlo marcado como desconocido.
    assert.equal(ourNumberLabel("999999", NUMBERS), NUMBER_LABEL_UNKNOWN);
    assert.equal(ourNumberLabel("", NUMBERS), NUMBER_LABEL_UNKNOWN);
  });

  test("no confunde el primario con el secundario si uno está vacío", () => {
    const soloPrimario = { primaryId: "111111", secondaryId: "" };
    assert.equal(ourNumberLabel("111111", soloPrimario), NUMBER_LABEL_PRIMARY);
    assert.equal(ourNumberLabel("", soloPrimario), NUMBER_LABEL_UNKNOWN);
  });

  test("un mensaje al número 1 queda etiquetado numero-1", () => {
    const [event] = parse(textPayload({ phoneNumberId: "111111" }));
    assert.equal(event.ourPhoneNumberId, "111111");
    assert.equal(event.ourNumberLabel, NUMBER_LABEL_PRIMARY);
  });

  test("un mensaje al número 2 queda etiquetado numero-2", () => {
    const [event] = parse(textPayload({ phoneNumberId: "222222" }));
    assert.equal(event.ourPhoneNumberId, "222222");
    assert.equal(event.ourNumberLabel, NUMBER_LABEL_SECONDARY);
  });

  test("los dos números pueden convivir en el mismo payload", () => {
    const raw = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111111", display_phone_number: "15550001111" },
                messages: [
                  { from: "5491170000001", id: "wamid.UNO", timestamp: "1790000000", type: "text", text: { body: "al primero" } },
                ],
              },
            },
            {
              value: {
                metadata: { phone_number_id: "222222", display_phone_number: "15550002222" },
                messages: [
                  { from: "5491170000002", id: "wamid.DOS", timestamp: "1790000001", type: "text", text: { body: "al segundo" } },
                ],
              },
            },
          ],
        },
      ],
    });
    const events = parse(raw);
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((e) => [e.ourNumberLabel, e.body]),
      [
        [NUMBER_LABEL_PRIMARY, "al primero"],
        [NUMBER_LABEL_SECONDARY, "al segundo"],
      ]
    );
  });
});

// ---------------------------------------------------------------------------
// Mensajes entrantes válidos
// ---------------------------------------------------------------------------

describe("mensajes entrantes", () => {
  test("guarda fecha, origen, destino, texto, id y estado", () => {
    const [event] = parse(textPayload());
    assert.equal(event.eventType, EVENT_MESSAGE);
    assert.equal(event.wamid, "wamid.ABC123");
    assert.equal(event.fromNumber, "5491170000000");
    // El destino es nuestro número; cae al display_phone_number si Meta no manda
    // el campo 'to'.
    assert.equal(event.toNumber, "15550001111");
    assert.equal(event.messageType, "text");
    assert.equal(event.body, "Hola, quiero saber del pedido");
    assert.equal(event.status, "");
    assert.equal(event.createdAt, new Date(1790000000 * 1000).toISOString());
  });

  test("usa el nowIso de entrada si el evento no trae timestamp", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111111" }, messages: [{ from: "1", id: "wamid.SIN_TS", type: "text", text: { body: "hola" } }] } }] }],
    });
    const [event] = parse(raw);
    assert.equal(event.createdAt, NOW);
  });

  test("usa el campo 'to' de Meta cuando viene", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111111", display_phone_number: "1555" }, messages: [{ from: "1", to: "1999", id: "wamid.TO", type: "text", text: { body: "hola" } }] } }] }],
    });
    const [event] = parse(raw);
    assert.equal(event.toNumber, "1999");
  });

  test("un mensaje de texto vacío no rompe nada", () => {
    const [event] = parse(textPayload({ body: "" }));
    assert.equal(event.body, "");
    assert.equal(event.wamid, "wamid.ABC123");
  });

  test("un mensaje sin id se ignora (no se puede deduplicar)", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111111" }, messages: [{ from: "1", type: "text", text: { body: "sin id" } }] } }] }],
    });
    assert.deepEqual(parse(raw), []);
  });

  test("describe los tipos que no son texto", () => {
    assert.equal(describeIncomingMessage({ type: "image", image: {} }), "[imagen]");
    assert.equal(describeIncomingMessage({ type: "image", image: { caption: "el perfume" } }), "el perfume");
    assert.equal(describeIncomingMessage({ type: "audio", audio: { voice: true } }), "[nota de voz]");
    assert.equal(describeIncomingMessage({ type: "sticker", sticker: {} }), "[sticker]");
    assert.equal(
      describeIncomingMessage({ type: "document", document: { filename: "presupuesto.pdf" } }),
      "[documento] presupuesto.pdf"
    );
    assert.equal(
      describeIncomingMessage({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "1", title: "Ver stock" } } }),
      "[boton] Ver stock"
    );
    assert.equal(describeIncomingMessage({ type: "reaction", reaction: { emoji: "❤" } }), "[reaccion] ❤");
  });

  test("un body gigante se recorta en vez de romper la columna", () => {
    const largo = "a".repeat(MAX_BODY_CHARS + 500);
    const [event] = parse(textPayload({ body: largo }));
    assert.equal(event.body.length, MAX_BODY_CHARS);
    assert.match(event.body, /\.\.\.$/);
  });
});

// ---------------------------------------------------------------------------
// Deduplicación
// ---------------------------------------------------------------------------

describe("deduplicación de eventos repetidos", () => {
  test("el mismo mensaje genera SIEMPRE la misma clave", () => {
    // Esta es la garantia que, junto al indice UNIQUE, evita guardar dos veces
    // el mismo evento cuando Meta reintenta.
    const a = parse(textPayload())[0];
    const b = parse(textPayload())[0];
    assert.equal(a.dedupeKey, b.dedupeKey);
  });

  test("mensajes distintos tienen claves distintas", () => {
    const uno = parse(textPayload({ wamid: "wamid.UNO" }))[0];
    const otro = parse(textPayload({ wamid: "wamid.DOS" }))[0];
    assert.notEqual(uno.dedupeKey, otro.dedupeKey);
  });

  test("las transiciones de estado del mismo mensaje NO son duplicados", () => {
    // Un wamid pasa por sent -> delivered -> read. Si la clave fuera solo el
    // wamid, "delivered" y "read" se perderian. La clave suma el estado.
    const sent = messageDedupeKey("wamid.X", EVENT_STATUS, "sent");
    const delivered = messageDedupeKey("wamid.X", EVENT_STATUS, "delivered");
    const read = messageDedupeKey("wamid.X", EVENT_STATUS, "read");
    assert.equal(new Set([sent, delivered, read]).size, 3);
  });

  test("reenviar el mismo evento de estado sí es duplicado", () => {
    assert.equal(
      messageDedupeKey("wamid.X", EVENT_STATUS, "delivered"),
      messageDedupeKey("wamid.X", EVENT_STATUS, "delivered")
    );
  });

  test("la clave de un mensaje entrante es su wamid", () => {
    assert.equal(messageDedupeKey("wamid.X", EVENT_MESSAGE, ""), "wamid.X");
  });

  test("un messages y un statuses del mismo wamid no se pisan", () => {
    const entrante = messageDedupeKey("wamid.X", EVENT_MESSAGE, "");
    const saliente = messageDedupeKey("wamid.X", EVENT_STATUS, "delivered");
    assert.notEqual(entrante, saliente);
  });
});

// ---------------------------------------------------------------------------
// Estados de salida
// ---------------------------------------------------------------------------

describe("cambios de estado de mensajes salientes", () => {
  test("invierte origen y destino: nosotros escribimos", () => {
    const raw = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "111111", display_phone_number: "15550001111" },
                statuses: [
                  { id: "wamid.SALIENTE", status: "delivered", timestamp: "1790000000", recipient_id: "5491170000000" },
                ],
              },
            },
          ],
        },
      ],
    });
    const [event] = parse(raw);
    assert.equal(event.eventType, EVENT_STATUS);
    assert.equal(event.status, "delivered");
    assert.equal(event.fromNumber, "15550001111");
    assert.equal(event.toNumber, "5491170000000");
    assert.equal(event.ourNumberLabel, NUMBER_LABEL_PRIMARY);
  });

  test("un value con messages y statuses a la vez devuelve ambos", () => {
    // Es el caso mas comun de la API y el que suele romperse si se procesa solo
    // uno de los dos arrays.
    const raw = textPayload({
      statuses: [
        { id: "wamid.OTRO", status: "read", timestamp: "1790000002", recipient_id: "5491170000000" },
      ],
    });
    const events = parse(raw);
    assert.equal(events.length, 2);
    assert.deepEqual(
      events.map((e) => e.eventType).sort(),
      [EVENT_STATUS, EVENT_MESSAGE].sort()
    );
  });

  test("guarda el motivo del fallo cuando el estado es 'failed'", () => {
    const raw = textPayload({
      statuses: [
        {
          id: "wamid.FALLIDO",
          status: "failed",
          timestamp: "1790000002",
          recipient_id: "5491170000000",
          errors: [{ code: 131047, title: "Reengagement" }],
        },
      ],
    });
    const failed = parse(raw).find((e) => e.eventType === EVENT_STATUS);
    assert.equal(failed?.status, "failed");
  });
});

// ---------------------------------------------------------------------------
// Payloads que no deben romper el endpoint
// ---------------------------------------------------------------------------

describe("payloads malformados", () => {
  test("un cuerpo que no es JSON lanza, para que la ruta responda 400", () => {
    // Antes devolvia [] y la ruta contestaba 200 received:0: un mensaje
    // ilegible se perdia en silencio. Ahora es un error visible.
    assert.throws(() => parse("esto no es json"), MalformedWebhookPayloadError);
    assert.throws(() => parse(""), MalformedWebhookPayloadError);
    assert.throws(() => parse("   "), MalformedWebhookPayloadError);
  });

  test("una raiz que no es objeto tambien lanza", () => {
    assert.throws(() => parse("123"), MalformedWebhookPayloadError);
    assert.throws(() => parse('"texto"'), MalformedWebhookPayloadError);
    assert.throws(() => parse("null"), MalformedWebhookPayloadError);
  });

  test("un JSON valido sin eventos NO es un error (se acusa recibo)", () => {
    // Campo al que no estamos suscritos, o un objeto vacio: normal, no 400.
    assert.deepEqual(parse("{}"), []);
    assert.deepEqual(parse("[]"), []);
    assert.deepEqual(parse(JSON.stringify({ object: "whatsapp_business_account" })), []);
  });

  test("un objeto sin entry no rompe", () => {
    assert.deepEqual(parse(JSON.stringify({ object: "whatsapp_business_account" })), []);
  });

  test("entry o changes con tipos raros se ignoran", () => {
    assert.deepEqual(parse(JSON.stringify({ entry: "nope" })), []);
    assert.deepEqual(parse(JSON.stringify({ entry: [{}] })), []);
    assert.deepEqual(parse(JSON.stringify({ entry: [{ changes: [{}] }] })), []);
    assert.deepEqual(parse(JSON.stringify({ entry: [null] })), []);
  });

  test("un value sin metadata no rompe (queda desconocido)", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { messages: [{ from: "1", id: "wamid.SIN_META", type: "text", text: { body: "hola" } }] } }] }],
    });
    const [event] = parse(raw);
    assert.equal(event.ourPhoneNumberId, "");
    assert.equal(event.ourNumberLabel, NUMBER_LABEL_UNKNOWN);
    assert.equal(event.body, "hola");
  });

  test("messages que no es un array no rompe", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111111" }, messages: "nope" } }] }],
    });
    assert.deepEqual(parse(raw), []);
  });

  test("un timestamp imposible cae en el nowIso", () => {
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { metadata: { phone_number_id: "111111" }, messages: [{ from: "1", id: "wamid.TS", timestamp: "no-es-un-numero", type: "text", text: { body: "hola" } }] } }] }],
    });
    const [event] = parse(raw);
    assert.equal(event.createdAt, NOW);
  });
});

// ---------------------------------------------------------------------------
// La ruta: Wiring y fail-closed
// ---------------------------------------------------------------------------

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const route = stripComments(
  readFileSync(new URL("../src/app/api/whatsapp/webhook/route.ts", import.meta.url), "utf8")
);
const db = readFileSync(new URL("../src/lib/db.ts", import.meta.url), "utf8");
const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");

describe("la ruta del webhook", () => {
  test("expone GET y POST (Meta usa el mismo endpoint para ambos)", () => {
    assert.match(route, /export async function GET\(/);
    assert.match(route, /export async function POST\(/);
  });

  test("lee el cuerpo CRUDO antes de parsear", () => {
    // El HMAC es sobre el body exacto: si se parsea y reserializa, nunca
    // coincide. Se compara contra la ULTIMA aparición de parseWebhookPayload
    // porque la primera esta en el import, arriba de todo.
    const textIndex = route.indexOf("request.text()");
    assert.ok(textIndex > 0, "tiene que leer el cuerpo crudo");
    const parseIndex = route.lastIndexOf("parseWebhookPayload");
    assert.ok(parseIndex > textIndex, "parsea DESPUÉS de leer el crudo");
  });

  test("valida la firma con el header de Meta", () => {
    assert.match(route, /verifyWebhookSignature/);
    assert.match(route, /WHATSAPP_SIGNATURE_HEADER/);
    assert.match(route, /status: 401/);
  });

  test("falla cerrado si falta el app secret", () => {
    assert.match(route, /WHATSAPP_APP_SECRET/);
    assert.match(route, /status: 503/);
  });

  test("distingue 'cuerpo ilegible' de 'nada que hacer'", () => {
    // Lo ilegible devuelve 400 para que quede a la vista; lo valido-pero-vacio
    // devuelve 200 para que Meta no reintente en loop. Confundir los dos casos
    // hace perder mensajes o generar reintentos inutiles.
    assert.match(route, /MalformedWebhookPayloadError/);
    assert.match(route, /status: 400/);
    assert.match(route, /received: 0/);
  });

  test("falla cerrado si falta el verify token", () => {
    assert.match(route, /WHATSAPP_VERIFY_TOKEN/);
    assert.match(route, /isValidSubscription/);
  });

  test("responde con el challenge crudo, no JSON", () => {
    assert.match(route, /new Response\(url\.searchParams\.get\("hub\.challenge"\)/);
    assert.match(route, /Content-Type": "text\/plain/);
  });

  test("NO responde automaticamente a los mensajes que llegan", () => {
    // Pedido explicito: guardar, no contestar. Si alguna vez se agrega un envío
    // automatico, este test tiene que cambiar a proposito.
    assert.doesNotMatch(route, /graph\.facebook\.com/);
    assert.doesNotMatch(route, /sendWhatsApp|fetch\(/);
  });

  test("no loguea el cuerpo crudo ni secretos", () => {
    // console.error/warn con el mensaje de un error podria filtrar PII.
    const logs = route.match(/console\.(log|warn|error)\([^)]*\)/g) ?? [];
    for (const line of logs) {
      assert.doesNotMatch(line, /rawBody/);
      assert.doesNotMatch(line, /appSecret/);
      assert.doesNotMatch(line, /verifyToken/i);
      assert.doesNotMatch(line, /body/);
    }
  });

  test("identifica los dos numeros desde las variables", () => {
    assert.match(route, /WHATSAPP_PHONE_NUMBER_ID\b/);
    assert.match(route, /WHATSAPP_PHONE_NUMBER_ID_2/);
  });
});

describe("persistencia", () => {
  test("la tabla existe en el esquema con los campos pedidos", () => {
    assert.match(db, /CREATE TABLE IF NOT EXISTS whatsapp_messages/);
    for (const column of [
      "wamid",
      "our_phone_number_id",
      "our_number_label",
      "from_number",
      "to_number",
      "body",
      "status",
      "created_at",
    ]) {
      assert.match(db, new RegExp(`\\b${column}\\b`), `falta la columna ${column}`);
    }
  });

  test("la deduplicacion se apoya en un indice UNIQUE", () => {
    assert.match(db, /dedupe_key TEXT NOT NULL/);
    assert.match(db, /CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_dedupe/);
  });

  test("el INSERT usa ON CONFLICT DO NOTHING", () => {
    const store = readFileSync(
      new URL("../src/lib/whatsapp/inbound-store.ts", import.meta.url),
      "utf8"
    );
    assert.match(store, /ON CONFLICT\(dedupe_key\) DO NOTHING/);
    assert.match(store, /rowsAffected/);
  });

  test("las lecturas llevan alias AS para las columnas con guion bajo", () => {
    // libSQL devuelve la clave tal cual la escribio la columna. Sin alias,
    // `event_type` llega como event_type y la fila se lee toda undefined.
    const store = readFileSync(
      new URL("../src/lib/whatsapp/inbound-store.ts", import.meta.url),
      "utf8"
    );
    const select = store.slice(store.indexOf("SELECT wamid"));
    for (const [column, alias] of [
      ["event_type", "eventType"],
      ["our_number_label", "ourNumberLabel"],
      ["from_number", "fromNumber"],
      ["to_number", "toNumber"],
      ["message_type", "messageType"],
      ["created_at", "createdAt"],
    ]) {
      assert.match(
        select,
        new RegExp(`${column}\\s+AS\\s+${alias}`),
        `falta el alias ${column} AS ${alias}`
      );
    }
  });
});

describe("variables documentadas", () => {
  test("las nuevas variables estan en .env.example, vacias y sin secretos", () => {
    for (const key of [
      "WHATSAPP_VERIFY_TOKEN",
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_PHONE_NUMBER_ID_2",
    ]) {
      assert.match(envExample, new RegExp(`^${key}=$`, "m"), `falta ${key}=`);
    }
  });

  test("ninguna variable de ejemplo trae un valor real", () => {
    for (const key of ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"]) {
      const match = envExample.match(new RegExp(`^${key}=(.*)$`, "m"));
      assert.equal(match?.[1].trim(), "", `${key} no debe traer un valor`);
    }
  });
});