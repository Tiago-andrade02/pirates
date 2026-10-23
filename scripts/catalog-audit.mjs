// Auditoría de SOLO LECTURA del catálogo PIRATES (migración 002, sin aplicar).
//
// Qué hace:
//   1. Se conecta a Turso y ejecuta ÚNICAMENTE `SELECT` (más `PRAGMA query_only`
//      como defensa en profundidad). No hay INSERT/UPDATE/DELETE/ALTER.
//   2. Deriva las precondiciones y los valores finales del spec compartido
//      (src/lib/catalog-migration.ts): la auditoría NO mantiene una copia que
//      pueda divergir de la migración.
//   3. Muestra los 7 productos (precios, stock por talla, stock total e
//      invariante) y clasifica cada cambio: pending / applied / mismatch.
//
// Qué NO hace:
//   - No escribe en la base (ni Producción ni Preview).
//   - No usa seed.json como si fuera el estado real de Producción.
//   - No imprime la URL de conexión ni el token, ni mensajes de error crudos.
//
// IMPORTANTE sobre el token: este script NO puede verificar que el token sea de
// solo lectura. El nombre de la variable NO garantiza permisos. Usá un token
// creado explícitamente con permiso de LECTURA; la garantía depende de eso.
//
// Configuración (variables de entorno; nunca pegar secretos en el repo):
//   TURSO_AUDIT_AUTH_TOKEN    token con permiso de SOLO LECTURA (obligatorio)
//   TURSO_AUDIT_DATABASE_URL  URL de la base (o, si falta, TURSO_DATABASE_URL)
//
// Uso:
//   node scripts/catalog-audit.mjs
//
// Códigos de salida:
//   0 = todas "pending": listo para aplicar
//   3 = todas "applied": la migración ya estaba aplicada (no hay nada que hacer)
//   2 = estado inesperado / invariante roto: NO aplicar
//   4 = falta configuración (no se conectó a nada)
//   5 = BLOQUEADA: falta verificar una precondición estricta (jpg-le-beau.stock_30)

import { createClient } from "@libsql/client";
import {
  DEFAULT_CONFIG,
  MIGRATION_SLUGS,
  UNCHANGED_SLUGS,
  classifyRow,
  invariantDelta,
  finalStockTotal,
  toPerfumeRow,
  unverifiedPreconditions,
  withRequiredPreconditions,
} from "../src/lib/catalog-migration.ts";

const EXIT = { READY: 0, MISMATCH: 2, ALREADY_APPLIED: 3, CONFIG: 4, BLOCKED: 5 };
const CHANGES = withRequiredPreconditions(DEFAULT_CONFIG);

const ars = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const show = (v) => {
  if (v === null || v === undefined) return "—";
  return typeof v === "number" && v >= 1000 ? ars.format(v) : String(v);
};

function readConfig() {
  const token = process.env.TURSO_AUDIT_AUTH_TOKEN;
  const url = process.env.TURSO_AUDIT_DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!token || !url) {
    console.error(
      "Falta configuración de auditoría.\n" +
        "Definí en el entorno:\n" +
        "  TURSO_AUDIT_AUTH_TOKEN    (token con permiso de SOLO LECTURA)\n" +
        "  TURSO_AUDIT_DATABASE_URL  (o TURSO_DATABASE_URL)\n" +
        "El script NO puede verificar que el token sea de solo lectura; depende de cómo lo creaste.\n" +
        "No se ejecutó ninguna consulta."
    );
    process.exit(EXIT.CONFIG);
  }
  return { url, token };
}

async function main() {
  const { url, token } = readConfig();
  const client = createClient({ url, authToken: token });

  // Defensa en profundidad; si el backend no lo soporta, se ignora.
  try {
    await client.execute("PRAGMA query_only = 1");
  } catch {
    // ignorar
  }

  const placeholders = MIGRATION_SLUGS.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `SELECT slug, price_30, price_50, price_100,
                 stock, stock_30, stock_50, stock_100
          FROM perfumes
          WHERE slug IN (${placeholders})`,
    args: MIGRATION_SLUGS,
  });

  const rows = new Map();
  for (const raw of result.rows) {
    const row = toPerfumeRow(raw);
    rows.set(row.slug, row);
  }

  const missing = MIGRATION_SLUGS.filter((s) => !rows.has(s));
  if (missing.length > 0) {
    console.error(`STOP: no existen en la base: ${missing.join(", ")}`);
    process.exit(EXIT.MISMATCH);
  }

  const problems = [];

  console.log("\n=== ESTADO ACTUAL (solo lectura) ===");
  for (const slug of MIGRATION_SLUGS) {
    const r = rows.get(slug);
    const delta = invariantDelta(r);
    const tag = UNCHANGED_SLUGS.includes(slug) ? " [sin cambios]" : "";
    console.log(
      `\n${slug}${tag}\n` +
        `  precio: 30=${show(r.price_30)}  50=${show(r.price_50)}  100=${show(r.price_100)}\n` +
        `  stock : total=${r.stock}  30=${r.stock_30}  50=${r.stock_50}  100=${r.stock_100}\n` +
        `  invariante: ${delta === 0 ? "OK" : `ROTO (delta=${delta})`}`
    );
    if (delta !== 0) problems.push(`Invariante roto en ${slug}: delta=${delta}`);
  }

  const unverified = unverifiedPreconditions(DEFAULT_CONFIG);

  console.log("\n=== PRECONDICIONES ESTRICTAS ===");
  if (unverified.length === 0) {
    console.log("Todas verificadas.");
  } else {
    for (const p of unverified) {
      console.log(
        `PENDIENTE: ${p.slug}.${p.field} — valor previo SIN VERIFICAR. ` +
          `Mirá el estado real arriba y configurá LE_BEAU_STOCK_30_BEFORE en src/lib/catalog-migration.ts.`
      );
    }
    console.log("Mientras falte verificarlo, la migración queda BLOQUEADA (no se aplica).");
  }

  console.log("\n=== PRECONDICIONES Y RESULTADO PROPUESTO ===");
  const states = CHANGES.map((change) => {
    const r = rows.get(change.slug);
    const state = classifyRow(change, r);
    console.log(`\n${change.slug}: ${change.summary}`);
    console.log(`  veredicto: ${state.toUpperCase()}`);
    for (const [field, expected] of Object.entries(change.before)) {
      const actual = r[field] ?? null;
      const ok = actual === expected;
      console.log(
        `  before ${field}: esperado ${show(expected)}, real ${show(actual)} ${ok ? "OK" : "STOP"}`
      );
    }
    console.log(`  stock total propuesto: ${show(finalStockTotal(change, r))} (actual ${show(r.stock)})`);
    return state;
  });

  console.log("\n=== RESULTADO ===");
  const allApplied = states.every((s) => s === "applied");
  const allPending = states.every((s) => s === "pending");

  if (problems.length > 0) {
    console.log("STOP: hay problemas. NO aplicar:\n- " + problems.join("\n- "));
    process.exit(EXIT.MISMATCH);
  }
  if (allApplied) {
    console.log("La migración YA estaba aplicada. No hay nada que hacer.");
    process.exit(EXIT.ALREADY_APPLIED);
  }
  if (unverified.length > 0) {
    console.log("BLOQUEADA: falta verificar una precondición estricta. NO aplicar.");
    process.exit(EXIT.BLOCKED);
  }
  if (allPending) {
    console.log("LISTO: todas las precondiciones se cumplen y el invariante está OK.");
    console.log("No se escribió nada. Se puede aplicar con el runner transaccional.");
    process.exit(EXIT.READY);
  }
  console.log("STOP: estado MIXTO (parte aplicada, parte pendiente). NO aplicar.");
  process.exit(EXIT.MISMATCH);
}

main().catch(() => {
  // No se imprime el mensaje crudo: los errores de conexión pueden contener la URL.
  console.error("Error inesperado durante la auditoría (detalle omitido por seguridad). No se escribió nada.");
  process.exit(EXIT.MISMATCH);
});
