import { createClient, type Client } from "@libsql/client";
import seed from "./seed.json";
import { assertDatabaseConfig } from "./db-guard";

let client: Client | null = null;

function getDbSync(): Client {
  if (!client) {
    // FAIL-CLOSED: en producción no se admite SQLite local. La decisión está en
    // db-guard.ts (pura y testeable) y se evalúa ANTES de resolver la URL.
    assertDatabaseConfig();
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
    preferred_branch TEXT NOT NULL DEFAULT '',
    customer_notes TEXT NOT NULL DEFAULT '',
    shipping_provider TEXT NOT NULL DEFAULT '',
    shipping_service TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL DEFAULT '',
    tracking_url TEXT NOT NULL DEFAULT '',
    tracking_events TEXT NOT NULL DEFAULT '[]',
    shipped_at TEXT,
    shipping_label TEXT NOT NULL DEFAULT '',
    notified_at TEXT,
    stock_alerted_at TEXT,
    customer_notified_at TEXT,
    customer_email_notified_at TEXT,
    customer_whatsapp_notified_at TEXT,
    mp_payment_id TEXT,
    paid_at TEXT,
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

  CREATE TABLE IF NOT EXISTS payment_diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_reference TEXT NOT NULL DEFAULT '',
    payment_type_id TEXT NOT NULL DEFAULT '',
    payment_method_id TEXT NOT NULL DEFAULT '',
    installments TEXT NOT NULL DEFAULT '',
    mp_result TEXT NOT NULL DEFAULT '',
    mp_error TEXT NOT NULL DEFAULT '',
    mp_raw TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS client_diagnostics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    build_tag TEXT NOT NULL DEFAULT '',
    has_selected_method INTEGER NOT NULL DEFAULT 0,
    selected_method_type TEXT NOT NULL DEFAULT '',
    has_additional_payment_type INTEGER NOT NULL DEFAULT 0,
    payment_method_id TEXT NOT NULL DEFAULT '',
    installments TEXT NOT NULL DEFAULT '',
    issuer_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  -- Rate limiting genérico (login por IP, checkout, payment, cotización):
  -- la ventana expirada se reinicia en el primer uso posterior.
  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    window_start TEXT NOT NULL
  );

  -- Mensajes que ENTRAN por el webhook de WhatsApp de Meta.
  --
  --  - wamid: identificador del mensaje (wamid.Id). No es unique por si solo:
  --    un mismo mensaje genera varios eventos de estado distintos.
  --  - dedupe_key: UNIQUE y es la garantia real de no duplicar. Un mensaje
  --    entrante vale su wamid; un evento de estado vale "wamid:status", para
  --    que el reenvio exacto de Meta caiga en la misma clave pero cada
  --    transicion real (sent/delivered/read) se guarde.
  --  - our_number_label: numero-1 / numero-2 / desconocido. Se guarda la
  --    etiqueta junto al ID crudo para poder separar los dos numeros al leer,
  --    sin depender de las variables de entorno en ese momento.
  -- No se guarda el cuerpo crudo del evento a proposito: trae datos personales
  -- del contacto que no hacen falta para leer el mensaje.
  CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wamid TEXT NOT NULL DEFAULT '',
    dedupe_key TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT '',
    our_phone_number_id TEXT NOT NULL DEFAULT '',
    our_number_label TEXT NOT NULL DEFAULT '',
    from_number TEXT NOT NULL DEFAULT '',
    to_number TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_perfumes_brand ON perfumes(brand_id);
  CREATE INDEX IF NOT EXISTS idx_perfumes_gender ON perfumes(gender);
  CREATE INDEX IF NOT EXISTS idx_perfumes_aroma ON perfumes(aroma);
  CREATE INDEX IF NOT EXISTS idx_perfumes_season ON perfumes(season);
  CREATE INDEX IF NOT EXISTS idx_perfumes_occasion ON perfumes(occasion);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

  -- Dedupe del webhook de WhatsApp. La columna dedupe_key NO tiene UNIQUE inline:
  -- la garantia de no duplicar la da Este indice, que es lo que permite el
  -- "ON CONFLICT(dedupe_key) DO NOTHING" del INSERT. Si el indice faltara, el
  -- INSERT fallaria con error en vez de duplicar en silencio, que es el fallo
  -- que conviene: el indice tiene que estar en el mismo lote que la tabla.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_dedupe ON whatsapp_messages(dedupe_key);
  -- Para leer los mensajes de un número en orden cronológico.
  CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON whatsapp_messages(created_at);
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

  if (!orderColumns.some((c) => c.name === "notified_at")) {
    await database.execute("ALTER TABLE orders ADD COLUMN notified_at TEXT");
  }

  if (!orderColumns.some((c) => c.name === "mp_payment_id")) {
    await database.executeMultiple(
      `ALTER TABLE orders ADD COLUMN mp_payment_id TEXT;
       ALTER TABLE orders ADD COLUMN paid_at TEXT;`
    );
  }

  // Reclamos de aviso, uno por canal. TEXT nullable a proposito: los pedidos ya
  // existentes quedan con NULL (= nadie los aviso todavia) y no se altera su
  // estado ni se reenvia nada retroactivamente.
  //
  //  - stock_alerted_at:   aviso urgente de pedido cobrado sin stock.
  //  - customer_notified_at: reclamo LEGADO de la confirmacion al comprador.
  //    Antes cubria email y WhatsApp a la vez; hoy solo se sigue LEYENDO para
  //    los pedidos historicos (equivale a "ambos canales ya avisados", ver
  //    src/lib/notification-plan.ts). No se elimina ni se migra.
  // Cada columna se comprueba por separado a proposito. Si las dos se agregaran
  // juntas bajo un unico "if", una base que quedo a medio migrar (tiene
  // stock_alerted_at pero todavia no customer_notified_at) nunca receberia la
  // segunda, y el envio del email al cliente fallaria para siempre con un error
  // de columna inexistente en el UPDATE.
  if (!orderColumns.some((c) => c.name === "stock_alerted_at")) {
    await database.execute("ALTER TABLE orders ADD COLUMN stock_alerted_at TEXT");
  }
  if (!orderColumns.some((c) => c.name === "customer_notified_at")) {
    await database.execute("ALTER TABLE orders ADD COLUMN customer_notified_at TEXT");
  }

  // Reclamo de la confirmacion al comprador, UNO POR CANAL. Reemplaza al reclamo
  // compartido (customer_notified_at, arriba): el email y el WhatsApp se marcan
  // por separado, asi un exito parcial (salio uno y fallo el otro) no bloquea el
  // canal que todavia falta y cada uno se puede reintentar sin arrastrar al otro.
  //
  // TEXT nullable a proposito: las ordenes existentes quedan en NULL (= canal
  // sin avisar todavia) sin alterar su estado ni reenviar nada retroactivamente.
  // Cada columna se comprueba por separado (mismo criterio que arriba): una base
  // a medio migrar que ya tenga una de las dos no pierde la otra.
  if (!orderColumns.some((c) => c.name === "customer_email_notified_at")) {
    await database.execute(
      "ALTER TABLE orders ADD COLUMN customer_email_notified_at TEXT"
    );
  }
  if (!orderColumns.some((c) => c.name === "customer_whatsapp_notified_at")) {
    await database.execute(
      "ALTER TABLE orders ADD COLUMN customer_whatsapp_notified_at TEXT"
    );
  }

  // Modalidad sucursal de Correo Argentino y observaciones del cliente.
  //
  //  - preferred_branch: texto libre con la sucursal que el cliente prefiere. NO
  //    es un código de agencia (eso es `agency_code`, que las nuevas órdenes
  //    siguen dejando vacío): no hay padron de sucursales contra el que validar,
  //    asi que se guarda tal cual y se coordina por WhatsApp.
  //  - customer_notes: observaciones del cliente en el checkout.
  //
  // Se comprueban por separado a proposito (mismo criterio que arriba): si se
  // agregaran juntas bajo un unico "if", una base a medio migrar se quedaria sin
  // la segunda columna para siempre y el INSERT del checkout fallaria siempre.
  if (!orderColumns.some((c) => c.name === "preferred_branch")) {
    await database.execute(
      "ALTER TABLE orders ADD COLUMN preferred_branch TEXT NOT NULL DEFAULT ''"
    );
  }
  if (!orderColumns.some((c) => c.name === "customer_notes")) {
    await database.execute(
      "ALTER TABLE orders ADD COLUMN customer_notes TEXT NOT NULL DEFAULT ''"
    );
  }

  const itemColumns = await tableColumns("supplier_purchase_items");
  if (!itemColumns.some((c) => c.name === "size")) {
    await database.execute(
      "ALTER TABLE supplier_purchase_items ADD COLUMN size INTEGER NOT NULL DEFAULT 100"
    );
  }

  const pdColumns = await tableColumns("payment_diagnostics");
  if (!pdColumns.some((c) => c.name === "mp_raw")) {
    await database.execute(
      "ALTER TABLE payment_diagnostics ADD COLUMN mp_raw TEXT NOT NULL DEFAULT ''"
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

async function seedIfEmpty(database: Client): Promise<boolean> {
  const row = await database.execute("SELECT COUNT(*) AS count FROM perfumes");
  if ((row.rows[0]?.count as number) > 0) return false;

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
  return true;
}

async function reconcilePrices(database: Client) {
  for (const p of seed.perfumes) {
    await database.execute({
      sql: `UPDATE perfumes SET price_30 = ?, price_50 = ?, price_100 = ? WHERE slug = ?`,
      args: [p.price_30 ?? null, p.price_50 ?? null, p.price_100 ?? null, p.slug],
    });
  }
}

let initPromise: Promise<void> | null = null;

async function ensureInit(db: Client) {
  if (!initPromise) {
    initPromise = (async () => {
      await createSchema(db);
      await migrate(db);
      const seeded = await seedIfEmpty(db);
      // Los reconciles de stock/precios solo corren al sembrar una base nueva.
      // Correrlos en cada init sobreescribía lo que el admin cargó (precios y
      // stock por tamaño) en cada cold start / deploy: se "perdían" los datos.
      if (seeded) {
        await reconcileStock(db);
        await reconcilePrices(db);
      }
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
