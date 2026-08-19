import { createClient, type Client } from "@libsql/client";
import seed from "./seed.json";

let client: Client | null = null;

function getDbSync(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || "file:./data/pirates.db";
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
    client = createClient({ url, authToken });
  }
  return client;
}

const SCHEMA = `
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
`;

async function createSchema(database: Client) {
  await database.executeMultiple(SCHEMA);
}

async function migrate(database: Client) {
  const tableColumns = async (table: string) => {
    const result = await database.execute(`PRAGMA table_info(${table})`);
    return result.rows as unknown as { name: string }[];
  };

  const perfumeColumns = await tableColumns("perfumes");
  if (!perfumeColumns.some((c) => c.name === "cost")) {
    await database.execute("ALTER TABLE perfumes ADD COLUMN cost REAL");
  }
  if (!perfumeColumns.some((c) => c.name === "stock_30")) {
    await database.executeMultiple(
      `ALTER TABLE perfumes ADD COLUMN stock_30 INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN stock_50 INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN stock_100 INTEGER NOT NULL DEFAULT 0;`
    );
  }
  if (!perfumeColumns.some((c) => c.name === "package_weight")) {
    await database.executeMultiple(
      `ALTER TABLE perfumes ADD COLUMN package_weight INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_length INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_width INTEGER NOT NULL DEFAULT 0;
       ALTER TABLE perfumes ADD COLUMN package_height INTEGER NOT NULL DEFAULT 0;`
    );
  }

  if (!perfumeColumns.some((c) => c.name === "top_rank")) {
    await database.execute("ALTER TABLE perfumes ADD COLUMN top_rank INTEGER");
  }

  const orderColumns = await tableColumns("orders");
  if (!orderColumns.some((c) => c.name === "postal_code")) {
    await database.executeMultiple(
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

  const itemColumns = await tableColumns("supplier_purchase_items");
  if (!itemColumns.some((c) => c.name === "size")) {
    await database.execute(
      "ALTER TABLE supplier_purchase_items ADD COLUMN size INTEGER NOT NULL DEFAULT 100"
    );
  }
  await database.execute(
    `UPDATE perfumes SET cost = ROUND(COALESCE(price_50, price_100, price_30) * 0.45, 0) WHERE cost IS NULL`
  );

  await database.executeMultiple(`
    UPDATE perfumes SET aroma = '["' || aroma || '"]' WHERE aroma NOT LIKE '[%';
    UPDATE perfumes SET season = '["' || season || '"]' WHERE season NOT LIKE '[%';
    UPDATE perfumes SET occasion = '["' || occasion || '"]' WHERE occasion NOT LIKE '[%';
  `);
}

async function reconcileStock(database: Client) {
  await database.executeMultiple(`
    UPDATE perfumes SET stock_100 = stock
    WHERE stock > 0 AND stock_30 = 0 AND stock_50 = 0 AND stock_100 = 0;
    UPDATE perfumes SET stock = stock_30 + stock_50 + stock_100;
  `);
}

async function backfillPackageDefaults(database: Client) {
  await database.execute(
    `UPDATE perfumes SET
       package_weight = 700,
       package_length = 21,
       package_width = 13,
       package_height = 10
     WHERE package_weight <= 0 OR package_length <= 0 OR package_width <= 0 OR package_height <= 0`
  );
}

async function seedIfEmpty(database: Client) {
  const row = await database.execute("SELECT COUNT(*) AS count FROM perfumes");
  if ((row.rows[0]?.count as number) > 0) return;

  const brandIds = new Map<string, number>();
  for (const brand of seed.brands) {
    const result = await database.execute({
      sql: "INSERT INTO brands (slug, name, country, description) VALUES (?, ?, ?, ?)",
      args: [brand.slug, brand.name, brand.country, brand.description],
    });
    brandIds.set(brand.slug, Number(result.lastInsertRowid));
  }

  for (const perfume of seed.perfumes) {
    await database.execute({
      sql: `INSERT INTO perfumes (
        slug, name, brand_id, gender, aroma, season, occasion,
        price_30, price_50, price_100, stock, description,
        notes_top, notes_heart, notes_base, duration, projection, sweetness,
        inspired_by, image, is_new, best_seller, top_rank, rating, review_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
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
        perfume.review_count,
      ],
    });
  }
}

let initPromise: Promise<void> | null = null;

async function ensureInit(db: Client) {
  if (!initPromise) {
    initPromise = (async () => {
      await createSchema(db);
      await migrate(db);
      await seedIfEmpty(db);
      await reconcileStock(db);
      await backfillPackageDefaults(db);
    })();
  }
  return initPromise;
}

export async function getDb(): Promise<Client> {
  const db = getDbSync();
  await ensureInit(db);
  return db;
}
