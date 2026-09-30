import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { createClient, type Client } from "@libsql/client";

import { ATTACH_PAYMENT_SQL } from "../src/lib/order-payment-link.ts";

// Integración contra un SQLite real. Comprueba que el SQL compartido por
// webhook / confirm / Brick sea realmente idempotente, que es la garantía que
// evita que un pago duplicado descuente stock dos veces o pise el payment_id
// original.
//
// Corre contra una base EN MEMORIA: no toca data/pirates.db ni ninguna base
// real, y no deja archivos temporales (en Windows, libsql mantiene el handle del
// archivo abierto y un rmSync en el teardown falla con EPERM).
const CODE = "PIR-3D9AD13CD672EF3";

let db: Client;

async function readOrder() {
  const result = await db.execute({
    sql: "SELECT mp_payment_id, paid_at FROM orders WHERE code = ?",
    args: [CODE],
  });
  return result.rows[0] as unknown as
    | { mp_payment_id: string; paid_at: string | null }
    | undefined;
}

before(async () => {
  db = createClient({ url: ":memory:" });

  // mp_payment_id con DEFAULT '' replica una base ya creada: el NULLIF del SQL
  // existe justamente para que un COALESCE sobre '' no deje la columna vacía.
  await db.execute(
    "CREATE TABLE orders (code TEXT PRIMARY KEY, mp_payment_id TEXT DEFAULT '', paid_at TEXT)"
  );
  await db.execute({
    sql: "INSERT INTO orders (code) VALUES (?)",
    args: [CODE],
  });
});

describe("ATTACH_PAYMENT_SQL — idempotencia contra SQLite real", () => {
  test("asocia el payment_id y fija paid_at", async () => {
    const when = "2026-09-28T12:00:00.000Z";
    await db.execute({ sql: ATTACH_PAYMENT_SQL, args: ["1001", when, CODE] });

    const order = await readOrder();
    assert.equal(order?.mp_payment_id, "1001");
    assert.equal(order?.paid_at, when);
  });

  test("un webhook duplicado NO pisa el payment_id original", async () => {
    // Es el caso "pago duplicado": llega la misma notificación otra vez con el
    // mismo id, y un segundo pago distinto. El primer id que ganó, gana.
    await db.execute({
      sql: ATTACH_PAYMENT_SQL,
      args: ["1001", "2026-09-28T12:05:00.000Z", CODE],
    });
    await db.execute({
      sql: ATTACH_PAYMENT_SQL,
      args: ["9999", "2026-09-28T13:00:00.000Z", CODE],
    });

    const order = await readOrder();
    assert.equal(order?.mp_payment_id, "1001", "el primer payment_id debe sobrevivir");
  });

  test("paid_at no se mueve en una reentrega", async () => {
    const order = await readOrder();
    assert.equal(
      order?.paid_at,
      "2026-09-28T12:00:00.000Z",
      "paid_at debe quedar en la primera fecha"
    );
  });

  test("un code inexistente no crea ni modifica filas", async () => {
    const before = await db.execute("SELECT COUNT(*) AS n FROM orders");
    await db.execute({
      sql: ATTACH_PAYMENT_SQL,
      args: ["5555", "2026-09-28T14:00:00.000Z", "PIR-NO-EXISTE"],
    });
    const after = await db.execute("SELECT COUNT(*) AS n FROM orders");

    const n = (r: typeof before) => Number(r.rows[0]?.n);
    assert.equal(n(after), n(before));
  });

  test("el SQL es un UPDATE con WHERE por code (no toca otros pedidos)", async () => {
    await db.execute("INSERT INTO orders (code, mp_payment_id) VALUES ('PIR-OTRO', 'x')");
    await db.execute({ sql: ATTACH_PAYMENT_SQL, args: ["7777", "2026-09-28T15:00:00.000Z", CODE] });

    const other = await db.execute({
      sql: "SELECT mp_payment_id FROM orders WHERE code = 'PIR-OTRO'",
    });
    assert.equal(other.rows[0]?.mp_payment_id, "x", "otro pedido no debe verse afectado");
  });
});
