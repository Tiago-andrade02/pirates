import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import seed from "./seed.json";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "pirates.db");

let db: DatabaseSync | null = null;

function createSchema(database: DatabaseSync) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS perfumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      brand_id INTEGER NOT NULL REFERENCES brands(id),
      gender TEXT NOT NULL,
      aroma TEXT NOT NULL,
      season TEXT NOT NULL,
      occasion TEXT NOT NULL,
      price_30 REAL,
      price_50 REAL,
      price_100 REAL,
      cost REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      stock_30 INTEGER NOT NULL DEFAULT 0,
      stock_50 INTEGER NOT NULL DEFAULT 0,
      stock_100 INTEGER NOT NULL DEFAULT 0,
      package_weight INTEGER NOT NULL DEFAULT 0,
      package_length INTEGER NOT NULL DEFAULT 0,
      package_width INTEGER NOT NULL DEFAULT 0,
      package_height INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      notes_top TEXT NOT NULL DEFAULT '[]',
      notes_heart TEXT NOT NULL DEFAULT '[]',
      notes_base TEXT NOT NULL DEFAULT '[]',
      duration INTEGER NOT NULL DEFAULT 3,
      projection INTEGER NOT NULL DEFAULT 3,
      sweetness INTEGER NOT NULL DEFAULT 3,
      inspired_by TEXT,
      image TEXT NOT NULL,
      is_new INTEGER NOT NULL DEFAULT 0,
      best_seller INTEGER NOT NULL DEFAULT 0,
      top_rank INTEGER,
      rating REAL NOT NULL DEFAULT 4.5,
      review_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      province TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      customer_id INTEGER REFERENCES customers(id),
      status TEXT NOT NULL DEFAULT 'pendiente',
      subtotal REAL NOT NULL DEFAULT 0,
      shipping REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'mercadopago',
      province TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      locality TEXT NOT NULL DEFAULT '',
      address_street TEXT NOT NULL DEFAULT '',
      address_number TEXT NOT NULL DEFAULT '',
      address_floor TEXT NOT NULL DEFAULT '',
      address_apartment TEXT NOT NULL DEFAULT '',
      delivery_type TEXT NOT NULL DEFAULT 'D',
      agency_code TEXT NOT NULL DEFAULT '',
      shipping_provider TEXT NOT NULL DEFAULT '',
      shipping_service TEXT NOT NULL DEFAULT '',
      tracking_number TEXT NOT NULL DEFAULT '',
      tracking_url TEXT NOT NULL DEFAULT '',
      tracking_events TEXT NOT NULL DEFAULT '[]',
      shipped_at TEXT,
      shipping_label TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      perfume_id INTEGER,
      name TEXT NOT NULL,
      size INTEGER,
      price REAL NOT NULL,
      qty INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier TEXT NOT NULL,
      total_cost REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS supplier_purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES supplier_purchases(id),
      perfume_id INTEGER NOT NULL REFERENCES perfumes(id),
      qty INTEGER NOT NULL,
      unit_cost REAL NOT NULL,
      size INTEGER NOT NULL DEFAULT 100
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL,
      date TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_perfumes_brand ON perfumes(brand_id);
    CREATE INDEX IF NOT EXISTS idx_perfumes_gender ON perfumes(gender);
    CREATE INDEX IF NOT EXISTS idx_perfumes_aroma ON perfumes(aroma);
    CREATE INDEX IF NOT EXISTS idx_perfumes_season ON perfumes(season);
    CREATE INDEX IF NOT EXISTS idx_perfumes_occasion ON perfumes(occasion);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
  `);
}

function migrate(database: DatabaseSync) {
  const tableColumns = (table: string) =>
    database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];

  const perfumeColumns = tableColumns("perfumes");
  if (!perfumeColumns.some((c) => c.name === "cost")) {
    database.exec("ALTER TABLE perfumes ADD COLUMN cost REAL");
  }
  if (!perfumeColumns.some((c) => c.name === "stock_30")) {
    database.exec(
      `ALTER TABLE perfumes ADD COLUMN stock_30 INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN stock_50 INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN stock_100 INTEGER NOT NULL DEFAULT 0;`
    );
  }
  if (!perfumeColumns.some((c) => c.name === "package_weight")) {
    database.exec(
      `ALTER TABLE perfumes ADD COLUMN package_weight INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_length INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_width INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_height INTEGER NOT NULL DEFAULT 0;`
    );
  }

  if (!perfumeColumns.some((c) => c.name === "top_rank")) {
    database.exec("ALTER TABLE perfumes ADD COLUMN top_rank INTEGER");
  }

  const orderColumns = tableColumns("orders");
  if (!orderColumns.some((c) => c.name === "postal_code")) {
    database.exec(
      `ALTER TABLE orders ADD COLUMN postal_code TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN locality TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN address_street TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN address_number TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN address_floor TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN address_apartment TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN delivery_type TEXT NOT NULL DEFAULT 'D';
       ALTER TABLE orders ADD COLUMN agency_code TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN shipping_provider TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN shipping_service TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN tracking_number TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN tracking_url TEXT NOT NULL DEFAULT '';
       ALTER TABLE orders ADD COLUMN tracking_events TEXT NOT NULL DEFAULT '[]';
       ALTER TABLE orders ADD COLUMN shipped_at TEXT;
       ALTER TABLE orders ADD COLUMN shipping_label TEXT NOT NULL DEFAULT '';`
    );
  }

  const itemColumns = tableColumns("supplier_purchase_items");
  if (!itemColumns.some((c) => c.name === "size")) {
    database.exec(
      "ALTER TABLE supplier_purchase_items ADD COLUMN size INTEGER NOT NULL DEFAULT 100"
    );
  }
  database.exec(
    `UPDATE perfumes SET cost = ROUND(COALESCE(price_50, price_100, price_30) * 0.45, 0) WHERE cost IS NULL`
  );

  // Los tags (aroma, season, occasion) pasan de un único valor a un array
  // JSON. Esta conversión es idempotente: solo toca filas que aún no sean
  // arrays.
  database.exec(`
    UPDATE perfumes SET aroma = '["' || aroma || '"]' WHERE aroma NOT LIKE '[%';
    UPDATE perfumes SET season = '["' || season || '"]' WHERE season NOT LIKE '[%';
    UPDATE perfumes SET occasion = '["' || occasion || '"]' WHERE occasion NOT LIKE '[%';
  `);
}

function reconcileStock(database: DatabaseSync) {
  database.exec(`
    UPDATE perfumes SET stock_100 = stock
    WHERE stock > 0 AND stock_30 = 0 AND stock_50 = 0 AND stock_100 = 0;
    UPDATE perfumes SET stock = stock_30 + stock_50 + stock_100;
  `);
}

// Datos de empaque por defecto (editables desde el admin) para que el envío
// pueda cotizarse. Deben validarse con el empaque real de cada fragancia.
function backfillPackageDefaults(database: DatabaseSync) {
  database.exec(
    `UPDATE perfumes SET
       package_weight = 700,
       package_length = 21,
       package_width = 13,
       package_height = 10
     WHERE package_weight <= 0 OR package_length <= 0 OR package_width <= 0 OR package_height <= 0`
  );
}

function seedIfEmpty(database: DatabaseSync) {
  const row = database
    .prepare("SELECT COUNT(*) AS count FROM perfumes")
    .get() as { count: number };
  if (row.count > 0) return;

  const insertBrand = database.prepare(
    "INSERT INTO brands (slug, name, country, description) VALUES (?, ?, ?, ?)"
  );
  const insertPerfume = database.prepare(`
    INSERT INTO perfumes (
      slug, name, brand_id, gender, aroma, season, occasion,
      price_30, price_50, price_100, stock, description,
      notes_top, notes_heart, notes_base, duration, projection, sweetness,
      inspired_by, image, is_new, best_seller, top_rank, rating, review_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  database.exec("BEGIN");
  try {
    const brandIds = new Map<string, number>();
    for (const brand of seed.brands) {
      const result = insertBrand.run(
        brand.slug,
        brand.name,
        brand.country,
        brand.description
      );
      brandIds.set(brand.slug, Number(result.lastInsertRowid));
    }

    for (const perfume of seed.perfumes) {
      insertPerfume.run(
        perfume.slug,
        perfume.name,
        brandIds.get(perfume.brand)!,
        perfume.gender,
        JSON.stringify(perfume.aroma),
        JSON.stringify(perfume.season),
        JSON.stringify(perfume.occasion),
        perfume.price_30 ?? null,
        perfume.price_50 ?? null,
        perfume.price_100 ?? null,
        perfume.stock,
        perfume.description,
        JSON.stringify(perfume.notes_top),
        JSON.stringify(perfume.notes_heart),
        JSON.stringify(perfume.notes_base),
        perfume.duration,
        perfume.projection,
        perfume.sweetness,
        perfume.inspired_by ?? null,
        perfume.image,
        perfume.is_new ? 1 : 0,
        perfume.best_seller ? 1 : 0,
        perfume.top_rank ?? null,
        perfume.rating,
        perfume.review_count
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getDb(): DatabaseSync {
  if (!db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    createSchema(db);
    migrate(db);
    seedIfEmpty(db);
    reconcileStock(db);
    backfillPackageDefaults(db);
  }
  return db;
}
