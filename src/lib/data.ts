import { getDb } from "./db";
import type {
  Brand,
  CatalogFilters,
  Occasion,
  Perfume,
  Prices,
  Season,
  Aroma,
  Gender,
} from "./types";

interface PerfumeRow {
  id: number;
  slug: string;
  name: string;
  brand_id: number;
  gender: string;
  aroma: string;
  season: string;
  occasion: string;
  price_30: number | null;
  price_50: number | null;
  price_100: number | null;
  stock: number;
  package_weight: number;
  package_length: number;
  package_width: number;
  package_height: number;
  description: string;
  notes_top: string;
  notes_heart: string;
  notes_base: string;
  duration: number;
  projection: number;
  sweetness: number;
  inspired_by: string | null;
  image: string;
  is_new: number;
  best_seller: number;
  top_rank: number | null;
  rating: number;
  review_count: number;
  brand_slug: string;
  brand_name: string;
  brand_country: string;
  brand_description: string;
}

export const PRICE_RANGES: { key: string; label: string; min: number; max: number }[] = [
  { key: "bajo", label: "Hasta $40.000", min: 0, max: 40000 },
  { key: "medio", label: "$40.000 – $60.000", min: 40000, max: 60000 },
  { key: "alto", label: "$60.000 – $90.000", min: 60000, max: 90000 },
  { key: "premium", label: "Más de $90.000", min: 90000, max: Infinity },
];

export const SIZE_OPTIONS = ["30", "50", "100"] as const;
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
  { value: "unisex", label: "Unisex" },
];
export const AROMA_OPTIONS: { value: Aroma; label: string }[] = [
  { value: "dulce", label: "Dulce" },
  { value: "fresco", label: "Fresco" },
  { value: "citrico", label: "Cítrico" },
  { value: "amaderado", label: "Amaderado" },
  { value: "ambar", label: "Ámbar" },
  { value: "vainilla", label: "Vainilla" },
  { value: "floral", label: "Floral" },
];
export const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: "verano", label: "Verano" },
  { value: "invierno", label: "Invierno" },
  { value: "primavera", label: "Primavera" },
  { value: "otono", label: "Otoño" },
  { value: "todo-el-ano", label: "Todo el año" },
];
export const OCCASION_OPTIONS: { value: Occasion; label: string }[] = [
  { value: "oficina", label: "Oficina" },
  { value: "noche", label: "Noche" },
  { value: "citas", label: "Citas" },
  { value: "diario", label: "Diario" },
  { value: "fiesta", label: "Fiesta" },
];

const SELECT_PERFUME = `
  SELECT p.*,
         b.slug AS brand_slug,
         b.name AS brand_name,
         b.country AS brand_country,
         b.description AS brand_description
  FROM perfumes p
  JOIN brands b ON b.id = p.brand_id
`;

function parseTags(value: string): string[] {
  if (!value) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [trimmed];
}

function tagMatch(column: string, value: string): { sql: string; params: string[] } {
  return { sql: `${column} LIKE ?`, params: [`%"${value}"%`] };
}

function mapPerfume(row: Record<string, unknown>): Perfume {
  const r = row as unknown as PerfumeRow;
  const prices: Prices = {
    "30": r.price_30,
    "50": r.price_50,
    "100": r.price_100,
  };
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    brand: {
      id: r.brand_id,
      slug: r.brand_slug,
      name: r.brand_name,
      country: r.brand_country,
      description: r.brand_description,
    },
    gender: r.gender as Gender,
    aromas: parseTags(r.aroma) as Aroma[],
    seasons: parseTags(r.season) as Season[],
    occasions: parseTags(r.occasion) as Occasion[],
    prices,
    stock: r.stock,
    description: r.description,
    package: {
      weightGrams: r.package_weight,
      lengthCm: r.package_length,
      widthCm: r.package_width,
      heightCm: r.package_height,
    },
    notes: {
      top: JSON.parse(r.notes_top),
      heart: JSON.parse(r.notes_heart),
      base: JSON.parse(r.notes_base),
    },
    duration: r.duration,
    projection: r.projection,
    sweetness: r.sweetness,
    inspiredBy: r.inspired_by,
    image: r.image,
    isNew: r.is_new === 1,
    bestSeller: r.best_seller === 1,
    topRank: r.top_rank ?? null,
    rating: r.rating,
    reviewCount: r.review_count,
  };
}

export async function getBrands(): Promise<Brand[]> {
  const db = await getDb();
  const result = await db.execute("SELECT * FROM brands ORDER BY name");
  return result.rows.map((row) => ({ ...row })) as unknown as Brand[];
}

export interface BrandWithCount extends Brand {
  count: number;
}

export async function getBrandsWithCounts(): Promise<BrandWithCount[]> {
  const db = await getDb();
  const result = await db.execute(
    `SELECT b.*, COUNT(p.id) AS count
     FROM brands b
     LEFT JOIN perfumes p ON p.brand_id = b.id
     GROUP BY b.id
     ORDER BY b.name`
  );
  return result.rows.map((row) => ({ ...row })) as unknown as BrandWithCount[];
}

export async function getBrandBySlug(slug: string): Promise<Brand | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM brands WHERE slug = ?",
    args: [slug],
  });
  const row = result.rows[0];
  return row ? ({ ...row } as unknown as Brand) : null;
}

export async function getPerfumeBySlug(slug: string): Promise<Perfume | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${SELECT_PERFUME} WHERE p.slug = ?`,
    args: [slug],
  });
  const row = result.rows[0];
  return row ? mapPerfume(row) : null;
}

export async function getPerfumesByIds(ids: number[]): Promise<Perfume[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  const result = await db.execute({
    sql: `${SELECT_PERFUME} WHERE p.id IN (${placeholders})`,
    args: ids,
  });
  return result.rows.map(mapPerfume);
}

export async function getBestSellers(limit = 8): Promise<Perfume[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${SELECT_PERFUME} WHERE p.best_seller = 1 ORDER BY COALESCE(p.top_rank, 999) ASC, p.rating DESC, p.review_count DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(mapPerfume);
}

export async function getNewArrivals(limit = 8): Promise<Perfume[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `${SELECT_PERFUME} WHERE p.is_new = 1 ORDER BY p.id DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map(mapPerfume);
}

export async function getRelated(perfume: Perfume, limit = 4): Promise<Perfume[]> {
  const db = await getDb();
  const firstAroma = perfume.aromas[0] ?? "";
  const firstOccasion = perfume.occasions[0] ?? "";
  const result = await db.execute({
    sql: `${SELECT_PERFUME}
       WHERE p.id != ? AND (
         p.brand_id = ?
         OR ${tagMatch("p.aroma", firstAroma).sql}
         OR ${tagMatch("p.occasion", firstOccasion).sql}
       )
       ORDER BY (p.brand_id = ?) DESC, p.rating DESC
       LIMIT ?`,
    args: [
      perfume.id,
      perfume.brand.id,
      `%"${firstAroma}"%`,
      `%"${firstOccasion}"%`,
      perfume.brand.id,
      limit,
    ],
  });
  return result.rows.map(mapPerfume);
}

export async function getCatalog(filters: CatalogFilters): Promise<Perfume[]> {
  const db = await getDb();
  const where: string[] = [];
  const params: (string | number | null)[] = [];

  if (filters.brands.length > 0) {
    const placeholders = filters.brands.map(() => "?").join(",");
    where.push(`p.brand_id IN (SELECT id FROM brands WHERE slug IN (${placeholders}))`);
    params.push(...filters.brands);
  }

  if (filters.gender) {
    where.push("p.gender = ?");
    params.push(filters.gender);
  }

  if (filters.aroma) {
    const m = tagMatch("p.aroma", filters.aroma);
    where.push(m.sql);
    params.push(...m.params);
  }

  if (filters.season) {
    const m = tagMatch("p.season", filters.season);
    where.push(m.sql);
    params.push(...m.params);
  }

  if (filters.occasion) {
    const m = tagMatch("p.occasion", filters.occasion);
    where.push(m.sql);
    params.push(...m.params);
  }

  if (filters.size) {
    const column = `p.price_${filters.size}`;
    where.push(`${column} IS NOT NULL`);
  }

  if (filters.priceRange) {
    const range = PRICE_RANGES.find((r) => r.key === filters.priceRange);
    if (range) {
      if (Number.isFinite(range.min)) {
        where.push("COALESCE(p.price_50, p.price_100, p.price_30) >= ?");
        params.push(range.min);
      }
      if (Number.isFinite(range.max)) {
        where.push("COALESCE(p.price_50, p.price_100, p.price_30) < ?");
        params.push(range.max);
      }
    }
  }

  if (filters.onlyNew) {
    where.push("p.is_new = 1");
  }

  if (filters.onlyBestSellers) {
    where.push("p.best_seller = 1");
  }

  if (filters.q) {
    where.push("(p.name LIKE ? OR b.name LIKE ? OR p.inspired_by LIKE ?)");
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }

  let order = "p.rating DESC, p.review_count DESC";
  if (filters.order === "precio-asc") order = "COALESCE(p.price_50, p.price_100, p.price_30) ASC";
  if (filters.order === "precio-desc") order = "COALESCE(p.price_50, p.price_100, p.price_30) DESC";
  if (filters.order === "rating") order = "p.rating DESC, p.review_count DESC";
  if (filters.order === "nombre") order = "p.name ASC";

  const sql = `${SELECT_PERFUME} ${
    where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  } ORDER BY ${order}`;

  const result = await db.execute({ sql, args: params });
  return result.rows.map(mapPerfume);
}
