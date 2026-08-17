import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const seedPath = path.join(root, "src", "lib", "seed.json");
const dbPath = path.join(root, "data", "pirates.db");

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));

if (!fs.existsSync(dbPath)) {
  console.error("No existe la base. Iniciala levantando la app (next dev) y volvé a correr este script.");
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON;");

db.exec("BEGIN");
try {
  const upsertBrand = db.prepare(`
    INSERT INTO brands (slug, name, country, description) VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      country = excluded.country,
      description = excluded.description
  `);
  const brandIds = new Map();
  for (const brand of seed.brands) {
    upsertBrand.run(brand.slug, brand.name, brand.country, brand.description);
  }

  const selectBrand = db.prepare("SELECT id FROM brands WHERE slug = ?");
  for (const brand of seed.brands) {
    const row = selectBrand.get(brand.slug);
    brandIds.set(brand.slug, row.id);
  }

  const upsertPerfume = db.prepare(`
    INSERT INTO perfumes (
      slug, name, brand_id, gender, aroma, season, occasion,
      price_30, price_50, price_100, stock, description,
      notes_top, notes_heart, notes_base, duration, projection, sweetness,
      inspired_by, image, is_new, best_seller, rating, review_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      name = excluded.name,
      brand_id = excluded.brand_id,
      gender = excluded.gender,
      aroma = excluded.aroma,
      season = excluded.season,
      occasion = excluded.occasion,
      price_30 = excluded.price_30,
      price_50 = excluded.price_50,
      price_100 = excluded.price_100,
      stock = excluded.stock,
      description = excluded.description,
      notes_top = excluded.notes_top,
      notes_heart = excluded.notes_heart,
      notes_base = excluded.notes_base,
      duration = excluded.duration,
      projection = excluded.projection,
      sweetness = excluded.sweetness,
      inspired_by = excluded.inspired_by,
      image = excluded.image,
      is_new = excluded.is_new,
      best_seller = excluded.best_seller,
      rating = excluded.rating,
      review_count = excluded.review_count
  `);

  let inserted = 0;
  let updated = 0;
  const exists = db.prepare("SELECT 1 FROM perfumes WHERE slug = ?");
  for (const p of seed.perfumes) {
    const brandId = brandIds.get(p.brand);
    if (!brandId) {
      console.error(`Marca faltante para ${p.slug}: ${p.brand}`);
      process.exit(1);
    }
    const isNew = exists.get(p.slug) === undefined;
    upsertPerfume.run(
      p.slug,
      p.name,
      brandId,
      p.gender,
      p.aroma,
      p.season,
      p.occasion,
      p.price_30 ?? null,
      p.price_50 ?? null,
      p.price_100 ?? null,
      p.stock,
      p.description,
      JSON.stringify(p.notes_top),
      JSON.stringify(p.notes_heart),
      JSON.stringify(p.notes_base),
      p.duration,
      p.projection,
      p.sweetness,
      p.inspired_by ?? null,
      p.image,
      p.is_new ? 1 : 0,
      p.best_seller ? 1 : 0,
      p.rating,
      p.review_count
    );
    if (isNew) inserted++;
    else updated++;
  }

  db.prepare(`
    UPDATE perfumes
    SET cost = ROUND(COALESCE(price_50, price_100, price_30) * 0.45, 0)
  `).run();

  db.exec("COMMIT");
  console.log(`Sincronizado: ${inserted} insertados, ${updated} actualizados. Total: ${seed.perfumes.length} perfumes.`);
} catch (error) {
  db.exec("ROLLBACK");
  throw error;
}
