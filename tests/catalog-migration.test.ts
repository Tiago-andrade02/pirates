import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  runCatalogMigration,
  CATALOG_CHANGES,
  MIGRATION_SLUGS,
  DEFAULT_CONFIG,
  LE_BEAU_STOCK_30_BEFORE,
  classifyRow,
  finalStockTotal,
  invariantDelta,
  requiredPreconditions,
  toPerfumeRow,
  unverifiedPreconditions,
  withRequiredPreconditions,
  type MigrationConfig,
  type PerfumeRow,
} from "../src/lib/catalog-migration.ts";

// Config VERIFICADA para los tests: el "antes" real de jpg-le-beau.stock_30 es
// 2 (coincide con validBefore). En Producción esto sigue SIN verificar (null).
const VERIFIED: MigrationConfig = { leBeauStock30Before: 2 };

// Cliente SIMULADO: SQLite en memoria con transacciones reales (BEGIN/COMMIT/
// ROLLBACK), para probar el runner sin tocar Turso. Permite inyectar fallos:
//   zeroUpdateAt: la N-ésima sentencia UPDATE afecta 0 filas.
//   failUpdateAt: la N-ésima sentencia UPDATE lanza un error.
class FakeClient {
  private db: DatabaseSync;
  private updateCount = 0;
  zeroUpdateAt: number | null = null;
  failUpdateAt: number | null = null;

  constructor() {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(`CREATE TABLE perfumes (
      slug TEXT UNIQUE,
      price_30 REAL, price_50 REAL, price_100 REAL,
      stock INTEGER, stock_30 INTEGER, stock_50 INTEGER, stock_100 INTEGER
    )`);
  }

  seed(rows: SeedRow[]): void {
    const stmt = this.db.prepare(
      "INSERT INTO perfumes (slug,price_30,price_50,price_100,stock,stock_30,stock_50,stock_100) VALUES (?,?,?,?,?,?,?,?)"
    );
    for (const r of rows) {
      stmt.run(
        r.slug,
        r.price_30,
        r.price_50,
        r.price_100,
        r.stock,
        r.stock_30,
        r.stock_50,
        r.stock_100
      );
    }
  }

  private run(
    sql: string,
    args: (number | null | string)[]
  ): { rows: Record<string, unknown>[]; rowsAffected: number } {
    const upper = sql.trimStart().toUpperCase();
    if (upper.startsWith("SELECT")) {
      const rows = this.db.prepare(sql).all(...args) as Record<string, unknown>[];
      return { rows, rowsAffected: 0 };
    }
    this.updateCount += 1;
    if (this.failUpdateAt === this.updateCount) throw new Error("fallo simulado");
    if (this.zeroUpdateAt === this.updateCount) return { rows: [], rowsAffected: 0 };
    const info = this.db.prepare(sql).run(...args);
    return { rows: [], rowsAffected: Number(info.changes) };
  }

  async transaction(_mode?: string) {
    this.db.exec("BEGIN");
    return {
      execute: async (stmt: { sql: string; args?: unknown[] }) =>
        this.run(stmt.sql, (stmt.args ?? []) as (number | null | string)[]),
      commit: async () => {
        this.db.exec("COMMIT");
      },
      rollback: async () => {
        this.db.exec("ROLLBACK");
      },
      close: () => {},
    };
  }

  snapshot(): Record<string, PerfumeRow> {
    const rows = this.db
      .prepare(
        "SELECT slug, price_30, price_50, price_100, stock, stock_30, stock_50, stock_100 FROM perfumes ORDER BY slug"
      )
      .all() as Record<string, unknown>[];
    const out: Record<string, PerfumeRow> = {};
    for (const raw of rows) {
      const row = toPerfumeRow(raw);
      out[row.slug] = row;
    }
    return out;
  }
}

interface SeedRow extends Record<string, unknown> {
  slug: string;
  price_30: number | null;
  price_50: number | null;
  price_100: number | null;
  stock: number;
  stock_30: number;
  stock_50: number;
  stock_100: number;
}

// Estado "antes" válido: cumple TODAS las precondiciones y el invariante.
// jpg-le-beau arranca con stock_30 = 2 para probar que el resultado es 10
// ABSOLUTO (no 2 + 10 = 12).
function validBefore(): SeedRow[] {
  return [
    { slug: "asad", price_30: null, price_50: 39990, price_100: 47990, stock: 24, stock_30: 0, stock_50: 10, stock_100: 14 },
    { slug: "jpg-le-beau", price_30: 39990, price_50: null, price_100: 70990, stock: 16, stock_30: 2, stock_50: 0, stock_100: 14 },
    { slug: "erba-pura", price_30: null, price_50: 54990, price_100: 83490, stock: 14, stock_30: 0, stock_50: 4, stock_100: 10 },
    { slug: "jpg-le-male-elixir", price_30: null, price_50: null, price_100: 70990, stock: 14, stock_30: 0, stock_50: 0, stock_100: 14 },
    { slug: "eclaire", price_30: 39990, price_50: null, price_100: 73990, stock: 20, stock_30: 10, stock_50: 0, stock_100: 10 },
    { slug: "hawas-tropical", price_30: 32990, price_50: null, price_100: 58990, stock: 14, stock_30: 10, stock_50: 0, stock_100: 4 },
    { slug: "kingdom", price_30: 32990, price_50: null, price_100: 80990, stock: 15, stock_30: 4, stock_50: 0, stock_100: 11 },
  ];
}

function mutate(rows: SeedRow[], slug: string, patch: Partial<SeedRow>): SeedRow[] {
  return rows.map((r) => (r.slug === slug ? { ...r, ...patch } : r));
}

function setup(rows = validBefore()): { client: FakeClient; before: string } {
  const client = new FakeClient();
  client.seed(rows);
  return { client, before: JSON.stringify(client.snapshot()) };
}

describe("migración 002: spec", () => {
  test("cubre los 6 cambios + kingdom sin cambios (7 productos)", () => {
    assert.equal(CATALOG_CHANGES.length, 6);
    assert.equal(MIGRATION_SLUGS.length, 7);
    assert.ok(MIGRATION_SLUGS.includes("kingdom"));
    assert.ok(!CATALOG_CHANGES.some((c) => c.slug === "kingdom"));
  });

  test("jpg-le-beau.stock_30 exige valor previo VERIFICADO (no se inventa)", () => {
    // Sin configurar (valor por defecto) queda SIN VERIFICAR: bloquea.
    assert.equal(LE_BEAU_STOCK_30_BEFORE, null);
    const pending = unverifiedPreconditions(DEFAULT_CONFIG);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].slug, "jpg-le-beau");
    assert.equal(pending[0].field, "stock_30");

    // Configurada, la precondición se inyecta en el "before" (guard del UPDATE).
    assert.deepEqual(
      requiredPreconditions(VERIFIED),
      [{ slug: "jpg-le-beau", field: "stock_30", expected: 2 }]
    );
    assert.equal(unverifiedPreconditions(VERIFIED).length, 0);
    const change = withRequiredPreconditions(VERIFIED).find(
      (c) => c.slug === "jpg-le-beau"
    )!;
    assert.equal(change.before.stock_30, 2);
  });

  test("clasifica pending/applied/mismatch con stock_30 previo estricto", () => {
    const before = validBefore();
    const beau = before.find((r) => r.slug === "jpg-le-beau")!;
    const change = withRequiredPreconditions(VERIFIED).find(
      (c) => c.slug === "jpg-le-beau"
    )!;
    assert.equal(classifyRow(change, toPerfumeRow(beau)), "pending");
    assert.equal(finalStockTotal(change, toPerfumeRow(beau)), 34); // 10 + 10 + 14
    const applied = toPerfumeRow({ ...beau, stock_30: 10, stock_50: 10, stock: 34, price_50: 54990 });
    assert.equal(classifyRow(change, applied), "applied");
    // Valor previo distinto del verificado -> mismatch (no "pending").
    assert.equal(classifyRow(change, toPerfumeRow({ ...beau, stock_30: 7 })), "mismatch");
    // Otra precondición incumplida (price_50 debe ser null) -> mismatch.
    assert.equal(classifyRow(change, toPerfumeRow({ ...beau, price_50: 999 })), "mismatch");
  });
});

describe("migración 002: aplicación segura", () => {
  test("aplica todo, preserva invariante y deja kingdom intacto", async () => {
    const { client } = setup();
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 0);
    assert.equal(result.status, "applied");
    assert.equal(result.applied, true);
    assert.deepEqual(result.problems, []);

    const s = client.snapshot();
    // asad: nueva talla 30.
    assert.equal(s.asad.price_30, 32990);
    assert.equal(s.asad.stock_30, 10);
    assert.equal(s.asad.stock, 34);
    // Le Beau: stock_30 = 10 ABSOLUTO (no 12); nueva 50.
    assert.equal(s["jpg-le-beau"].stock_30, 10);
    assert.equal(s["jpg-le-beau"].stock_50, 10);
    assert.equal(s["jpg-le-beau"].price_50, 54990);
    assert.equal(s["jpg-le-beau"].stock, 34);
    // erba-pura.
    assert.equal(s["erba-pura"].price_30, 39990);
    assert.equal(s["erba-pura"].stock_30, 10);
    assert.equal(s["erba-pura"].stock, 24);
    // Le Male Elixir.
    assert.equal(s["jpg-le-male-elixir"].price_30, 39990);
    assert.equal(s["jpg-le-male-elixir"].price_50, 54990);
    assert.equal(s["jpg-le-male-elixir"].stock, 34);
    // Eclaire / Hawas: retiran 30 ml de la venta pero CONSERVAN 10 u. y el total.
    assert.equal(s.eclaire.price_30, null);
    assert.equal(s.eclaire.stock_30, 10);
    assert.equal(s.eclaire.stock, 20);
    assert.equal(s["hawas-tropical"].price_30, null);
    assert.equal(s["hawas-tropical"].stock_30, 10);
    assert.equal(s["hawas-tropical"].stock, 14);
    // kingdom intacto.
    assert.equal(s.kingdom.price_30, 32990);
    assert.equal(s.kingdom.stock, 15);
    // Invariante en los 7.
    for (const slug of MIGRATION_SLUGS) {
      assert.equal(invariantDelta(s[slug]), 0, `invariante roto en ${slug}`);
    }
  });

  test("precio previo inesperado -> mismatch y no escribe nada", async () => {
    const { client, before } = setup(mutate(validBefore(), "asad", { price_30: 11111 }));
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 2);
    assert.equal(result.status, "mismatch");
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("stock previo inesperado -> mismatch y no escribe nada", async () => {
    // stock_30 = 3 con total 17 mantiene el invariante, pero viola la precondición.
    const rows = mutate(validBefore(), "erba-pura", { stock_30: 3, stock: 17 });
    const { client, before } = setup(rows);
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 2);
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("precondición estricta SIN verificar -> blocked y no escribe", async () => {
    const { client, before } = setup();
    // Sin config => stock_30 previo de jpg-le-beau sigue SIN VERIFICAR (null).
    const result = await runCatalogMigration(client, { apply: true });
    assert.equal(result.code, 5);
    assert.equal(result.status, "blocked");
    assert.equal(result.applied, false);
    assert.ok(result.problems.some((p) => p.includes("jpg-le-beau.stock_30")));
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("stock_30 previo inesperado en jpg-le-beau -> mismatch, revierte TODO sin cambios parciales", async () => {
    // El valor real es 3, pero el verificado (precondición) es 2.
    const rows = mutate(validBefore(), "jpg-le-beau", { stock_30: 3, stock: 17 });
    const { client, before } = setup(rows);
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 2);
    assert.equal(result.status, "mismatch");
    assert.equal(result.applied, false);
    // Ningún producto cambió (ni siquiera el primero de la lista).
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("un UPDATE que afecta 0 filas -> falla y revierte lo ya aplicado", async () => {
    const { client, before } = setup();
    client.zeroUpdateAt = 2; // la 2da actualización (jpg-le-beau) afecta 0 filas
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 1);
    assert.equal(result.status, "failed");
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before); // rollback total
  });

  test("error a mitad de la transacción -> revierte TODO", async () => {
    const { client, before } = setup();
    client.failUpdateAt = 3; // falla al 3er UPDATE
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 1);
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("violación del invariante antes de escribir -> mismatch y no escribe", async () => {
    const rows = mutate(validBefore(), "kingdom", { stock: 99 });
    const { client, before } = setup(rows);
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 2);
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("segunda ejecución -> already-applied, no escribe", async () => {
    const { client } = setup();
    const first = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(first.code, 0);
    const afterFirst = JSON.stringify(client.snapshot());

    const second = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(second.code, 3);
    assert.equal(second.status, "already-applied");
    assert.equal(second.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), afterFirst);
  });

  test("estado mixto (parte aplicada) -> mismatch y no escribe", async () => {
    // asad ya en su estado final; el resto pendiente.
    const rows = mutate(validBefore(), "asad", {
      price_30: 32990,
      stock_30: 10,
      stock: 34,
    });
    const { client, before } = setup(rows);
    const result = await runCatalogMigration(client, { apply: true, config: VERIFIED });
    assert.equal(result.code, 2);
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });

  test("dry-run (apply=false) valida pero no persiste", async () => {
    const { client, before } = setup();
    const result = await runCatalogMigration(client, { apply: false, config: VERIFIED });
    assert.equal(result.code, 0);
    assert.equal(result.status, "ready");
    assert.equal(result.applied, false);
    assert.equal(JSON.stringify(client.snapshot()), before);
  });
});
