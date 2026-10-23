import { PRICE_RANGES } from "./catalog-options.ts";
import type { CatalogFilters, Perfume } from "./types.ts";

// Módulo sin dependencias del servidor (ni DB ni red): lo comparten el
// componente de cliente que filtra el catálogo en el navegador y las pruebas.

export type FilterField =
  | "brands"
  | "size"
  | "priceRange"
  | "gender"
  | "aroma"
  | "season"
  | "occasion"
  | "onlyNew"
  | "onlyBestSellers";

export const EMPTY_FILTERS: CatalogFilters = {
  brands: [],
  size: null,
  priceRange: null,
  gender: null,
  aroma: null,
  season: null,
  occasion: null,
  onlyNew: false,
  onlyBestSellers: false,
  q: null,
  order: null,
};

// Lee los filtros desde la query string. Mismos nombres de parámetro que usaba
// la página server-side (marca, talla, precio, tipo, aroma, temporada, ocasion,
// novedad, destacados, q, orden) para no romper los enlaces existentes.
export function parseFilters(params: URLSearchParams): CatalogFilters {
  return {
    brands: params.getAll("marca"),
    size: params.get("talla"),
    priceRange: params.get("precio"),
    gender: params.get("tipo"),
    aroma: params.get("aroma"),
    season: params.get("temporada"),
    occasion: params.get("ocasion"),
    onlyNew: params.get("novedad") === "1",
    onlyBestSellers: params.get("destacados") === "1",
    q: params.get("q"),
    order: params.get("orden"),
  };
}

// Inversa de parseFilters: reconstruye la query string para reflejar el estado
// en la barra de direcciones (deep-links compartibles) sin volver al servidor.
export function filtersToParams(filters: CatalogFilters): string {
  const params = new URLSearchParams();
  for (const brand of filters.brands) params.append("marca", brand);
  if (filters.size) params.set("talla", filters.size);
  if (filters.priceRange) params.set("precio", filters.priceRange);
  if (filters.gender) params.set("tipo", filters.gender);
  if (filters.aroma) params.set("aroma", filters.aroma);
  if (filters.season) params.set("temporada", filters.season);
  if (filters.occasion) params.set("ocasion", filters.occasion);
  if (filters.onlyNew) params.set("novedad", "1");
  if (filters.onlyBestSellers) params.set("destacados", "1");
  if (filters.q && filters.q.trim()) params.set("q", filters.q);
  if (filters.order) params.set("orden", filters.order);
  return params.toString();
}

// Aplica un click de filtro. "brands" es multi-selección (toggle); las tallas,
// precio, tipo, aroma, estación y ocasión son de selección única (volver a
// clickear el valor activo lo quita). Novedad/destacados son booleanos.
export function setFilterValue(
  filters: CatalogFilters,
  field: FilterField,
  value: string
): CatalogFilters {
  switch (field) {
    case "brands":
      return filters.brands.includes(value)
        ? { ...filters, brands: filters.brands.filter((b) => b !== value) }
        : { ...filters, brands: [...filters.brands, value] };
    case "onlyNew":
      return { ...filters, onlyNew: !filters.onlyNew };
    case "onlyBestSellers":
      return { ...filters, onlyBestSellers: !filters.onlyBestSellers };
    case "size":
      return { ...filters, size: filters.size === value ? null : value };
    case "priceRange":
      return { ...filters, priceRange: filters.priceRange === value ? null : value };
    case "gender":
      return { ...filters, gender: filters.gender === value ? null : value };
    case "aroma":
      return { ...filters, aroma: filters.aroma === value ? null : value };
    case "season":
      return { ...filters, season: filters.season === value ? null : value };
    case "occasion":
      return { ...filters, occasion: filters.occasion === value ? null : value };
  }
}

// Vacía un grupo completo (el botón "Limpiar" de cada grupo del panel).
export function clearFilterField(
  filters: CatalogFilters,
  field: FilterField
): CatalogFilters {
  switch (field) {
    case "brands":
      return { ...filters, brands: [] };
    case "onlyNew":
      return { ...filters, onlyNew: false };
    case "onlyBestSellers":
      return { ...filters, onlyBestSellers: false };
    case "size":
      return { ...filters, size: null };
    case "priceRange":
      return { ...filters, priceRange: null };
    case "gender":
      return { ...filters, gender: null };
    case "aroma":
      return { ...filters, aroma: null };
    case "season":
      return { ...filters, season: null };
    case "occasion":
      return { ...filters, occasion: null };
  }
}

export function countActiveFilters(filters: CatalogFilters): number {
  return (
    filters.brands.length +
    (filters.size ? 1 : 0) +
    (filters.priceRange ? 1 : 0) +
    (filters.gender ? 1 : 0) +
    (filters.aroma ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.occasion ? 1 : 0) +
    (filters.onlyNew ? 1 : 0) +
    (filters.onlyBestSellers ? 1 : 0)
  );
}

// Precio representativo del producto: misma expresión que getCatalog usa en SQL
// (COALESCE(price_50, price_100, price_30)) para que orden y rango coincidan.
export function primaryPrice(perfume: Perfume): number {
  return perfume.prices["50"] ?? perfume.prices["100"] ?? perfume.prices["30"] ?? 0;
}

function comparePerfumes(a: Perfume, b: Perfume, order: string | null): number {
  switch (order) {
    case "precio-asc":
      return primaryPrice(a) - primaryPrice(b);
    case "precio-desc":
      return primaryPrice(b) - primaryPrice(a);
    case "rating":
      return b.rating - a.rating || b.reviewCount - a.reviewCount;
    case "nombre":
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    case "ventas":
      return (
        (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0) ||
        (a.topRank ?? 999) - (b.topRank ?? 999)
      );
    case "novedad":
      return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || b.id - a.id;
    default:
      return (
        (b.bestSeller ? 1 : 0) - (a.bestSeller ? 1 : 0) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount
      );
  }
}

// Réplica en el navegador de getCatalog (src/lib/data.ts). El catálogo se
// prerenderiza una sola vez y este filtrado corre en el cliente, así ninguna
// combinación de filtros ejecuta una función en el servidor.
export function applyCatalogFilters(
  perfumes: Perfume[],
  filters: CatalogFilters
): Perfume[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  const range = filters.priceRange
    ? PRICE_RANGES.find((r) => r.key === filters.priceRange)
    : undefined;

  const filtered = perfumes.filter((perfume) => {
    if (filters.brands.length > 0 && !filters.brands.includes(perfume.brand.slug)) {
      return false;
    }
    if (filters.gender && perfume.gender !== filters.gender) return false;
    if (filters.aroma && !(perfume.aromas as string[]).includes(filters.aroma)) {
      return false;
    }
    if (filters.season && !(perfume.seasons as string[]).includes(filters.season)) {
      return false;
    }
    if (filters.occasion && !(perfume.occasions as string[]).includes(filters.occasion)) {
      return false;
    }
    if (filters.size && perfume.prices[filters.size as "30" | "50" | "100"] === null) {
      return false;
    }
    if (range) {
      const price = primaryPrice(perfume);
      if (price < range.min || price >= range.max) return false;
    }
    if (filters.onlyNew && !perfume.isNew) return false;
    if (filters.onlyBestSellers && !perfume.bestSeller) return false;
    if (q) {
      const haystack = [perfume.name, perfume.brand.name, perfume.inspiredBy ?? ""];
      if (!haystack.some((value) => value.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => comparePerfumes(a, b, filters.order));
}
