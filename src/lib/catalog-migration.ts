// Migración 002 del catálogo PIRATES: FUENTE ÚNICA DE VERDAD del cambio
// aprobado y runner de aplicación seguro y transaccional.
//
// Lo consumen:
//   - scripts/catalog-audit.mjs           (solo lectura: estado + diff + veredicto)
//   - scripts/apply-catalog-migration.mjs (aplicación real en una transacción)
//   - tests/catalog-migration.test.ts      (pruebas con cliente simulado)
//
// Al centralizar el spec acá evitamos el bug que tuvimos antes: la auditoría y
// la migración mantenían listas de precondiciones distintas y podían divergir.
//
// Lógica del runner (runCatalogMigration):
//   1. Abre UNA transacción real y persistente con la API del cliente.
//   2. Lee las 7 filas DENTRO de la transacción (snapshot consistente).
//   3. Comprueba: existencia de filas, invariante de cada fila y precondiciones
//      completas (precios Y stock) de cada cambio.
//   4. Clasifica cada cambio como "pending" | "applied" | "mismatch".
//      - todas "applied" -> ya aplicada: ROLLBACK, no escribe nada.
//      - mezcla / "mismatch" -> ROLLBACK, error.
//      - todas "pending" -> aplica (si apply=true).
//   5. Exige exactamente 1 fila afectada por UPDATE (usa el `rowsAffected` de la
//      MISMA sentencia; no usa `SELECT changes()` fuera de contexto).
//   6. Verifica el estado final (precios, stock por talla, stock total e
//      invariante de las 7; kingdom intacto).
//   7. COMMIT solo si todo pasó; ante cualquier fallo, ROLLBACK y código != 0.

export type Size = 30 | 50 | 100;
export type PriceField = `price_${Size}`;
export type StockField = `stock_${Size}`;
export type Field = PriceField | StockField;

// Un cambio sobre UN producto: precondiciones exactas ("before") y valores
// finales de los campos que cambian ("after"). Los campos que no están en
// "after" quedan como están (no se toca su presentación).
export interface CatalogChange {
  slug: string;
  summary: string;
  before: Partial<Record<Field, number | null>>;
  after: Partial<Record<Field, number | null>>;
}

// --- Cambio aprobado (7 productos; kingdom NO se toca) ----------------------
// Precios en pesos. "Retirar de la venta" = price_30 = null (conserva stock_30).
export const CATALOG_CHANGES: CatalogChange[] = [
  {
    slug: "asad",
    summary: "agregar 30 ml a $32.990 con 10 unidades",
    before: { price_30: null, stock_30: 0 },
    after: { price_30: 32990, stock_30: 10 },
  },
  {
    slug: "jpg-le-beau",
    summary: "30 ml a $39.990 con stock final 10 (absoluto); agregar 50 ml a $54.990 con 10 unidades",
    // El valor previo de stock_30 es precondición ESTRICTA, pero se inyecta
    // desde LE_BEAU_STOCK_30_BEFORE (ver abajo): no se inventa acá.
    before: { price_30: 39990, price_50: null, stock_50: 0 },
    after: { price_50: 54990, stock_30: 10, stock_50: 10 },
  },
  {
    slug: "erba-pura",
    summary: "agregar 30 ml a $39.990 con 10 unidades",
    before: { price_30: null, stock_30: 0 },
    after: { price_30: 39990, stock_30: 10 },
  },
  {
    slug: "jpg-le-male-elixir",
    summary: "agregar 30 ml a $39.990 y 50 ml a $54.990, 10 unidades cada una",
    before: { price_30: null, price_50: null, stock_30: 0, stock_50: 0 },
    after: { price_30: 39990, price_50: 54990, stock_30: 10, stock_50: 10 },
  },
  {
    slug: "eclaire",
    summary: "retirar 30 ml de la venta (price_30 = null), conservando 10 unidades",
    before: { price_30: 39990, stock_30: 10 },
    after: { price_30: null },
  },
  {
    slug: "hawas-tropical",
    summary: "retirar 30 ml de la venta (price_30 = null), conservando 10 unidades",
    before: { price_30: 32990, stock_30: 10 },
    after: { price_30: null },
  },
];

// Productos que la migración NO debe tocar (se verifica que queden idénticos).
export const UNCHANGED_SLUGS: string[] = ["kingdom"];

export const MIGRATION_SLUGS: string[] = [
  ...CATALOG_CHANGES.map((c) => c.slug),
  ...UNCHANGED_SLUGS,
];

// --- Precondición ESTRICTA adicional: jpg-le-beau.stock_30 ------------------
// El valor previo REAL de jpg-le-beau.stock_30 en Producción debe conocerse
// ANTES de aplicar. NO se inventa: queda `null` (= SIN VERIFICAR) hasta que una
// auditoría real de solo lectura lo confirme. Mientras sea `null`, la migración
// y la auditoría quedan BLOQUEADAS: no escriben ni declaran "listo".
//
// Para habilitarla: correr `node scripts/catalog-audit.mjs`, mirar el stock_30
// real de jpg-le-beau y reemplazar `null` por ese número. Es el único lugar a
// tocar: el guard del UPDATE y la clasificación se derivan de acá.
export const LE_BEAU_STOCK_30_BEFORE: number | null = null;

export interface MigrationConfig {
  leBeauStock30Before: number | null;
}

export const DEFAULT_CONFIG: MigrationConfig = {
  leBeauStock30Before: LE_BEAU_STOCK_30_BEFORE,
};

export interface RequiredPrecondition {
  slug: string;
  field: StockField;
  expected: number | null;
}

export function requiredPreconditions(
  config: MigrationConfig
): RequiredPrecondition[] {
  return [
    { slug: "jpg-le-beau", field: "stock_30", expected: config.leBeauStock30Before },
  ];
}

export function unverifiedPreconditions(
  config: MigrationConfig
): RequiredPrecondition[] {
  return requiredPreconditions(config).filter(
    (p) => typeof p.expected !== "number"
  );
}

// Cambios con las precondiciones estrictas YA VERIFICADAS inyectadas en
// `before`: así el guard del UPDATE y la clasificación las exigen. Si todavía no
// están verificadas no se inyectan; el runner corta antes con "blocked".
export function withRequiredPreconditions(
  config: MigrationConfig = DEFAULT_CONFIG
): CatalogChange[] {
  const reqs = requiredPreconditions(config);
  return CATALOG_CHANGES.map((change) => {
    const applicable = reqs.filter(
      (p) => p.slug === change.slug && typeof p.expected === "number"
    );
    if (applicable.length === 0) return change;
    const before: Partial<Record<Field, number | null>> = { ...change.before };
    for (const p of applicable) before[p.field] = p.expected;
    return { ...change, before };
  });
}

const SIZES: Size[] = [30, 50, 100];

export interface PerfumeRow {
  slug: string;
  price_30: number | null;
  price_50: number | null;
  price_100: number | null;
  stock: number;
  stock_30: number;
  stock_50: number;
  stock_100: number;
}

export function invariantDelta(row: PerfumeRow): number {
  return (
    Number(row.stock) -
    (Number(row.stock_30) + Number(row.stock_50) + Number(row.stock_100))
  );
}

function hasOwn(obj: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function eqValue(actual: unknown, expected: number | null): boolean {
  if (expected === null) return actual === null || actual === undefined;
  return Number(actual) === expected;
}

export function getField(row: PerfumeRow, field: Field): number | null {
  return row[field];
}

// Clasificación de una fila respecto de un cambio.
export type RowState = "pending" | "applied" | "mismatch";

export function classifyRow(change: CatalogChange, row: PerfumeRow): RowState {
  const beforeOk = (Object.keys(change.before) as Field[]).every((f) =>
    eqValue(row[f], change.before[f] ?? null)
  );
  const afterOk = (Object.keys(change.after) as Field[]).every((f) =>
    eqValue(row[f], change.after[f] ?? null)
  );
  // "before" y "after" siempre difieren en al menos un campo para este cambio,
  // así que "ambos" es un estado imposible: lo tratamos como mismatch.
  if (beforeOk && afterOk) return "mismatch";
  if (afterOk) return "applied";
  if (beforeOk) return "pending";
  return "mismatch";
}

// Campos finales de un cambio (solo los que cambian), tal como quedarán.
export function expectedFinalFields(
  change: CatalogChange
): Partial<Record<Field, number | null>> {
  const out: Partial<Record<Field, number | null>> = {};
  for (const s of SIZES) {
    const p = `price_${s}` as PriceField;
    const st = `stock_${s}` as StockField;
    if (hasOwn(change.after, p)) out[p] = change.after[p] ?? null;
    if (hasOwn(change.after, st)) out[st] = change.after[st] ?? null;
  }
  return out;
}

// Stock total final del cambio, preservando la invariante: es la suma de las
// tallas finales (las que cambian toman su valor "after"; el resto, el actual).
export function finalStockTotal(change: CatalogChange, row: PerfumeRow): number {
  const val = (s: Size): number => {
    const key = `stock_${s}` as StockField;
    return hasOwn(change.after, key)
      ? Number(change.after[key])
      : Number(row[key]);
  };
  return val(30) + val(50) + val(100);
}

// Construye el UPDATE con SET (campos finales + total) y GUARDAS en el WHERE
// (precondiciones). Los placeholders se ordenan: SET primero, WHERE después.
export function buildUpdate(
  change: CatalogChange,
  row: PerfumeRow
): { sql: string; args: (number | null | string)[] } {
  const finalFields = expectedFinalFields(change);
  const sets: string[] = [];
  const args: (number | null | string)[] = [];
  for (const f of Object.keys(finalFields) as Field[]) {
    sets.push(`${f} = ?`);
    args.push(finalFields[f] ?? null);
  }
  sets.push("stock = ?");
  args.push(finalStockTotal(change, row));

  const guards: string[] = ["slug = ?"];
  args.push(change.slug);
  for (const f of Object.keys(change.before) as Field[]) {
    const v = change.before[f] ?? null;
    if (v === null) {
      guards.push(`${f} IS NULL`);
    } else {
      guards.push(`${f} = ?`);
      args.push(v);
    }
  }

  const sql = `UPDATE perfumes SET ${sets.join(", ")} WHERE ${guards.join(" AND ")}`;
  return { sql, args };
}

export function toPerfumeRow(r: Record<string, unknown>): PerfumeRow {
  const num = (v: unknown): number =>
    v === null || v === undefined ? 0 : Number(v);
  const nullable = (v: unknown): number | null =>
    v === null || v === undefined ? null : Number(v);
  return {
    slug: String(r.slug),
    price_30: nullable(r.price_30),
    price_50: nullable(r.price_50),
    price_100: nullable(r.price_100),
    stock: num(r.stock),
    stock_30: num(r.stock_30),
    stock_50: num(r.stock_50),
    stock_100: num(r.stock_100),
  };
}

// --- Interface mínima de cliente (la cumple @libsql/client) ------------------
export interface ExecResult {
  rows: Record<string, unknown>[];
  rowsAffected: number;
}

export interface SqlTx {
  execute(stmt: { sql: string; args?: unknown[] }): Promise<ExecResult>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close?(): void | Promise<void>;
}

export interface SqlClient {
  transaction(mode?: string): Promise<SqlTx>;
}

export const RUN_CODES = {
  APPLIED: 0,
  READY: 0,
  FAILED: 1,
  MISMATCH: 2,
  ALREADY_APPLIED: 3,
  BLOCKED: 5,
} as const;

export type RunStatus =
  | "applied"
  | "ready"
  | "already-applied"
  | "mismatch"
  | "blocked"
  | "failed";

export interface RunResult {
  code: number;
  status: RunStatus;
  problems: string[];
  applied: boolean;
}

const SELECT_SQL = `SELECT slug, price_30, price_50, price_100,
       stock, stock_30, stock_50, stock_100
  FROM perfumes
 WHERE slug IN (${MIGRATION_SLUGS.map(() => "?").join(", ")})`;

async function readRows(tx: SqlTx): Promise<Map<string, PerfumeRow>> {
  const res = await tx.execute({ sql: SELECT_SQL, args: MIGRATION_SLUGS });
  const map = new Map<string, PerfumeRow>();
  for (const raw of res.rows) {
    const row = toPerfumeRow(raw);
    map.set(row.slug, row);
  }
  return map;
}

// Verificación final (post-aplicación): precios, stock por talla, total e
// invariante de los 7 productos, y que los "sin cambios" queden idénticos.
export function verifyFinal(
  before: Map<string, PerfumeRow>,
  after: Map<string, PerfumeRow>
): string[] {
  const problems: string[] = [];

  for (const change of CATALOG_CHANGES) {
    const b = before.get(change.slug);
    const a = after.get(change.slug);
    if (!b || !a) {
      problems.push(`Falta la fila ${change.slug} en la verificación`);
      continue;
    }
    for (const f of Object.keys(change.after) as Field[]) {
      const expected = change.after[f] ?? null;
      if (!eqValue(a[f], expected)) {
        problems.push(`${change.slug}.${f}: esperado ${expected}, real ${a[f]}`);
      }
    }
    const expectedTotal = finalStockTotal(change, b);
    if (Number(a.stock) !== expectedTotal) {
      problems.push(
        `${change.slug}.stock: esperado ${expectedTotal}, real ${a.stock}`
      );
    }
  }

  for (const slug of MIGRATION_SLUGS) {
    const a = after.get(slug);
    if (!a) {
      problems.push(`Falta la fila ${slug} en la verificación`);
      continue;
    }
    const d = invariantDelta(a);
    if (d !== 0) problems.push(`Invariante roto en ${slug} tras aplicar: delta=${d}`);
  }

  for (const slug of UNCHANGED_SLUGS) {
    const b = before.get(slug);
    const a = after.get(slug);
    if (!b || !a) continue;
    for (const f of [
      "price_30",
      "price_50",
      "price_100",
      "stock",
      "stock_30",
      "stock_50",
      "stock_100",
    ] as Field[]) {
      if (String(getField(b, f)) !== String(getField(a, f))) {
        problems.push(`${slug}.${f} cambió pero debía quedar intacto`);
      }
    }
  }

  return problems;
}

async function safeRollback(tx: SqlTx): Promise<void> {
  try {
    await tx.rollback();
  } catch {
    // ignorar: el objetivo es no dejar cambios; si falla, se reporta abajo.
  }
  try {
    await tx.close?.();
  } catch {
    // ignorar
  }
}

export interface RunOptions {
  apply: boolean;
  log?: (message: string) => void;
  config?: MigrationConfig;
}

export async function runCatalogMigration(
  client: SqlClient,
  options: RunOptions
): Promise<RunResult> {
  const log = options.log ?? (() => {});
  const config = options.config ?? DEFAULT_CONFIG;
  const tx = await client.transaction("write");

  try {
    const before = await readRows(tx);

    const missing = MIGRATION_SLUGS.filter((s) => !before.has(s));
    if (missing.length > 0) {
      await safeRollback(tx);
      return {
        code: RUN_CODES.FAILED,
        status: "failed",
        problems: [`No existen en la base: ${missing.join(", ")}`],
        applied: false,
      };
    }

    // BLOQUEO por precondiciones estrictas sin verificar: no se escribe nada y
    // no se declara "listo". Se exige configurarlas tras una auditoría real.
    const unverified = unverifiedPreconditions(config);
    if (unverified.length > 0) {
      await safeRollback(tx);
      return {
        code: RUN_CODES.BLOCKED,
        status: "blocked",
        problems: unverified.map(
          (p) =>
            `Precondición sin verificar: ${p.slug}.${p.field}. Auditá Producción (solo lectura) y configurá el valor antes de aplicar.`
        ),
        applied: false,
      };
    }

    const changes = withRequiredPreconditions(config);
    const problems: string[] = [];

    for (const slug of MIGRATION_SLUGS) {
      const row = before.get(slug)!;
      const d = invariantDelta(row);
      if (d !== 0) {
        problems.push(`Invariante roto ANTES en ${slug}: stock=${row.stock} != suma de tallas (delta=${d})`);
      }
    }

    const states = changes.map((change) => {
      const row = before.get(change.slug)!;
      const state = classifyRow(change, row);
      if (state === "mismatch") {
        problems.push(
          `${change.slug}: el estado real no coincide ni con el "antes" ni con el "después" esperado`
        );
      }
      return { change, row, state };
    });

    if (problems.length > 0) {
      await safeRollback(tx);
      return { code: RUN_CODES.MISMATCH, status: "mismatch", problems, applied: false };
    }

    const allApplied = states.every((s) => s.state === "applied");
    const allPending = states.every((s) => s.state === "pending");

    if (allApplied) {
      await safeRollback(tx);
      log("La migración YA estaba aplicada: no se escribió nada.");
      return {
        code: RUN_CODES.ALREADY_APPLIED,
        status: "already-applied",
        problems: [],
        applied: false,
      };
    }

    if (!allPending) {
      await safeRollback(tx);
      return {
        code: RUN_CODES.MISMATCH,
        status: "mismatch",
        problems: [
          "Estado MIXTO: parte de los cambios ya están aplicados y parte pendientes. No se escribió nada.",
        ],
        applied: false,
      };
    }

    if (!options.apply) {
      await safeRollback(tx);
      for (const { change } of states) log(`(dry-run) listo: ${change.slug} — ${change.summary}`);
      return { code: RUN_CODES.READY, status: "ready", problems: [], applied: false };
    }

    for (const { change, row } of states) {
      const { sql, args } = buildUpdate(change, row);
      const res = await tx.execute({ sql, args });
      if (Number(res.rowsAffected) !== 1) {
        await safeRollback(tx);
        return {
          code: RUN_CODES.FAILED,
          status: "failed",
          problems: [
            `${change.slug}: se esperaba exactamente 1 fila afectada, se obtuvo ${res.rowsAffected}. ROLLBACK.`,
          ],
          applied: false,
        };
      }
      log(`OK: ${change.slug} — ${change.summary}`);
    }

    const after = await readRows(tx);
    const verificationProblems = verifyFinal(before, after);
    if (verificationProblems.length > 0) {
      await safeRollback(tx);
      return {
        code: RUN_CODES.FAILED,
        status: "failed",
        problems: ["Falló la verificación final. ROLLBACK."].concat(verificationProblems),
        applied: false,
      };
    }

    await tx.commit();
    log("COMMIT realizado: migración aplicada y verificada.");
    return { code: RUN_CODES.APPLIED, status: "applied", problems: [], applied: true };
  } catch {
    await safeRollback(tx);
    return {
      code: RUN_CODES.FAILED,
      status: "failed",
      // No exponemos el mensaje crudo del error (puede contener la URL de conexión).
      problems: ["Error durante la transacción (detalle omitido por seguridad). ROLLBACK."],
      applied: false,
    };
  }
}
