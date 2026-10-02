// Escritura de los mensajes entrantes del webhook de WhatsApp en Turso.
//
// Aparte del modulo puro (whatsapp/webhook.ts), esta es la UNICA parte que
// toca la base. La deduplicacion no se resuelve en memoria: se apoya en el
// indice UNIQUE de whatsapp_messages.dedupe_key con "ON CONFLICT DO NOTHING".
// Asi el mismo evento puede llegar N veces --Meta reintenta si no recibe 200, y
// su propio retry puede solaparse con uno nuestro-- y solo se guarda una fila.
import { getDb } from "@/lib/db";
import type { IncomingWhatsAppEvent } from "./webhook.ts";

export interface StoreResult {
  // Filas realmente insertadas.
  stored: number;
  // Eventos que ya estaban (reenvío de Meta).
  duplicates: number;
}

export async function storeIncomingMessages(
  events: IncomingWhatsAppEvent[]
): Promise<StoreResult> {
  if (events.length === 0) return { stored: 0, duplicates: 0 };

  const db = await getDb();

  let stored = 0;
  let duplicates = 0;

  // Uno por uno y no un INSERT multiple: con "ON CONFLICT DO NOTHING" cada
  // statement reporta rowsAffected y asi se puede contar cuantos fueron
  // duplicados. Ademas, un lote fallido entero no tira los eventos validos.
  for (const event of events) {
    const result = await db.execute({
      sql: `INSERT INTO whatsapp_messages (
              wamid, dedupe_key, event_type, our_phone_number_id, our_number_label,
              from_number, to_number, message_type, body, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(dedupe_key) DO NOTHING`,
      args: [
        event.wamid,
        event.dedupeKey,
        event.eventType,
        event.ourPhoneNumberId,
        event.ourNumberLabel,
        event.fromNumber,
        event.toNumber,
        event.messageType,
        event.body,
        event.status,
        event.createdAt,
      ],
    });
    if ((result.rowsAffected ?? 0) > 0) stored += 1;
    else duplicates += 1;
  }

  return { stored, duplicates };
}

// Lectura mínima para verificar desde el panel o un script que el webhook está
// guardando de verdad. No hay todavia una bandeja en el admin: la idea es poder
// consultar sin exponer la base.
export interface IncomingWhatsAppRow {
  wamid: string;
  eventType: string;
  ourPhoneNumberId: string;
  ourNumberLabel: string;
  fromNumber: string;
  toNumber: string;
  messageType: string;
  body: string;
  status: string;
  createdAt: string;
}

export async function listIncomingMessages(limit = 50): Promise<IncomingWhatsAppRow[]> {
  const db = await getDb();
  // Los alias AS son obligatorios: libSQL devuelve las claves tal cual estan en
  // la columna, asi que sin esto `event_type` vendria como eventType undefined y
  // la fila se leeria toda vacia. Es el mismo criterio que usa el resto del
  // proyecto en sus queries.
  const result = await db.execute({
    sql: `SELECT wamid,
                 event_type      AS eventType,
                 our_phone_number_id AS ourPhoneNumberId,
                 our_number_label    AS ourNumberLabel,
                 from_number     AS fromNumber,
                 to_number       AS toNumber,
                 message_type    AS messageType,
                 body,
                 status,
                 created_at      AS createdAt
          FROM whatsapp_messages
          ORDER BY id DESC
          LIMIT ?`,
    args: [Math.max(1, Math.min(limit, 200))],
  });
  return result.rows as unknown as IncomingWhatsAppRow[];
}