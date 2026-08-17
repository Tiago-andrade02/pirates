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

// Los tags (aromas, estaciones, ocasiones) se guardan como array JSON en una
// columna TEXT. Este helper construye un match "contiene" para ese array.
function tagMatch(column: string, value: string): { sql: string; params: string[] } {
  return { sql: `${column} LIKE ?`, params: [`%"${value}"%`] };
}

function mapPerfume(row: PerfumeRow): Perfume {
  const prices: Prices = {
    "30": row.price_30,
    "50": row.price_50,
    "100": row.price_100,
  };
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: {
      id: row.brand_id,
      slug: row.brand_slug,
      name: row.brand_name,
      country: row.brand_country,
      description: row.brand_description,
    },
    gender: row.gender as Gender,
    aromas: parseTags(row.aroma) as Aroma[],
    seasons: parseTags(row.season) as Season[],
    occasions: parseTags(row.occasion) as Occasion[],
    prices,
    stock: row.stock,
    description: row.description,
    package: {
      weightGrams: row.package_weight,
      lengthCm: row.package_length,
      widthCm: row.package_width,
      heightCm: row.package_height,
    },
    notes: {
      top: JSON.parse(row.notes_top),
      heart: JSON.parse(row.notes_heart),
      base: JSON.parse(row.notes_base),
    },
    duration: row.duration,
    projection: row.projection,
    sweetness: row.sweetness,
    inspiredBy: row.inspired_by,
    image: row.image,
    isNew: row.is_new === 1,
    bestSeller: row.best_seller === 1,
    topRank: row.top_rank ?? null,
    rating: row.rating,
    reviewCount: row.review_count,
  };
}

export function getBrands(): Brand[] {
  const rows = getDb()
    .prepare("SELECT * FROM brands ORDER BY name")
    .all() as unknown as Brand[];
  return rows.map((row) => ({ ...row }));
}

export interface BrandWithCount extends Brand {
  count: number;
}

export function getBrandsWithCounts(): BrandWithCount[] {
  const rows = getDb()
    .prepare(
      `SELECT b.*, COUNT(p.id) AS count
       FROM brands b
       LEFT JOIN perfumes p ON p.brand_id = b.id
       GROUP BY b.id
       ORDER BY b.name`
    )
    .all() as unknown as BrandWithCount[];
  return rows.map((row) => ({ ...row }));
}

export function getBrandBySlug(slug: string): Brand | null {
  const row = getDb()
    .prepare("SELECT * FROM brands WHERE slug = ?")
    .get(slug) as Brand | undefined;
  return row ? { ...row } : null;
}

export function getPerfumeBySlug(slug: string): Perfume | null {
  const row = getDb()
    .prepare(`${SELECT_PERFUME} WHERE p.slug = ?`)
    .get(slug) as PerfumeRow | undefined;
  return row ? mapPerfume(row) : null;
}

export function getPerfumesByIds(ids: number[]): Perfume[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = getDb()
    .prepare(`${SELECT_PERFUME} WHERE p.id IN (${placeholders})`)
    .all(...ids) as unknown as PerfumeRow[];
  return rows.map(mapPerfume);
}

export function getBestSellers(limit = 8): Perfume[] {
  const rows = getDb()
    .prepare(
      `${SELECT_PERFUME} WHERE p.best_seller = 1 ORDER BY COALESCE(p.top_rank, 999) ASC, p.rating DESC, p.review_count DESC LIMIT ?`
    )
    .all(limit) as unknown as PerfumeRow[];
  return rows.map(mapPerfume);
}

export function getNewArrivals(limit = 8): Perfume[] {
  const rows = getDb()
    .prepare(
      `${SELECT_PERFUME} WHERE p.is_new = 1 ORDER BY p.id DESC LIMIT ?`
    )
    .all(limit) as unknown as PerfumeRow[];
  return rows.map(mapPerfume);
}

export function getRelated(perfume: Perfume, limit = 4): Perfume[] {
  const firstAroma = perfume.aromas[0] ?? "";
  const firstOccasion = perfume.occasions[0] ?? "";
  const rows = getDb()
    .prepare(
      `${SELECT_PERFUME}
       WHERE p.id != ? AND (
         p.brand_id = ?
         OR ${tagMatch("p.aroma", firstAroma).sql}
         OR ${tagMatch("p.occasion", firstOccasion).sql}
       )
       ORDER BY (p.brand_id = ?) DESC, p.rating DESC
       LIMIT ?`
    )
    .all(
      perfume.id,
      perfume.brand.id,
      `%"${firstAroma}"%`,
      `%"${firstOccasion}"%`,
      perfume.brand.id,
      limit
    ) as unknown as PerfumeRow[];
  return rows.map(mapPerfume);
}

export function getCatalog(filters: CatalogFilters): Perfume[] {
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

  const rows = getDb().prepare(sql).all(...params) as unknown as PerfumeRow[];
  return rows.map(mapPerfume);
}
