import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyCatalogFilters,
  clearFilterField,
  countActiveFilters,
  EMPTY_FILTERS,
  filtersToParams,
  parseFilters,
  setFilterValue,
} from "../src/lib/catalog-filters.ts";
import type { CatalogFilters, Perfume } from "../src/lib/types.ts";

// Réplica en el navegador de getCatalog: estos casos fijan la paridad de cada
// filtro/orden con la consulta SQL que usaba la página server-side.
function perfume(overrides: Partial<Perfume> & { id: number; name: string }): Perfume {
  return {
    slug: `p-${overrides.id}`,
    brand: { id: 1, slug: "lattafa", name: "Lattafa", country: "EAU", description: "" },
    gender: "unisex",
    aromas: [],
    seasons: [],
    occasions: [],
    prices: { "30": null, "50": null, "100": null },
    stock: 0,
    stockBySize: { "30": 0, "50": 0, "100": 0 },
    description: "",
    notes: { top: [], heart: [], base: [] },
    duration: 3,
    projection: 3,
    sweetness: 3,
    inspiredBy: null,
    image: "",
    isNew: false,
    bestSeller: false,
    topRank: null,
    rating: 0,
    reviewCount: 0,
    package: { weightGrams: 0, lengthCm: 0, widthCm: 0, heightCm: 0 },
    ...overrides,
  };
}

const CATALOG: Perfume[] = [
  perfume({
    id: 1,
    name: "9PM",
    brand: { id: 2, slug: "afnan", name: "Afnan", country: "EAU", description: "" },
    gender: "hombre",
    aromas: ["dulce", "ambar"],
    seasons: ["invierno"],
    occasions: ["noche", "fiesta"],
    prices: { "30": 30000, "50": 45000, "100": null },
    isNew: false,
    bestSeller: true,
    topRank: 1,
    rating: 4.8,
    reviewCount: 100,
  }),
  perfume({
    id: 2,
    name: "Khamrah",
    gender: "unisex",
    aromas: ["dulce", "vainilla"],
    seasons: ["invierno", "otono"],
    occasions: ["noche"],
    prices: { "30": null, "50": 55000, "100": 75000 },
    inspiredBy: "Angel's Share",
    isNew: true,
    bestSeller: true,
    topRank: null,
    rating: 4.9,
    reviewCount: 50,
  }),
  perfume({
    id: 3,
    name: "Yara",
    gender: "mujer",
    aromas: ["floral", "vainilla"],
    seasons: ["todo-el-ano"],
    occasions: ["diario"],
    prices: { "30": null, "50": null, "100": 95000 },
    isNew: true,
    bestSeller: false,
    rating: 4.5,
    reviewCount: 10,
  }),
];

function withFilters(overrides: Partial<CatalogFilters>): CatalogFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe("applyCatalogFilters — filtros", () => {
  test("sin filtros devuelve todo ordenado por destacados/rating", () => {
    const result = applyCatalogFilters(CATALOG, EMPTY_FILTERS);
    assert.deepEqual(result.map((p) => p.id), [2, 1, 3]);
  });

  test("filtra por marca (multi-selección)", () => {
    const result = applyCatalogFilters(CATALOG, withFilters({ brands: ["lattafa"] }));
    assert.deepEqual(result.map((p) => p.id), [2, 3]);
  });

  test("filtra por género", () => {
    const result = applyCatalogFilters(CATALOG, withFilters({ gender: "hombre" }));
    assert.deepEqual(result.map((p) => p.id), [1]);
  });

  test("filtra por aroma/estación/ocasión (pertenencia al tag)", () => {
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ aroma: "vainilla" })).map((p) => p.id),
      [2, 3]
    );
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ occasion: "noche" })).map((p) => p.id),
      [2, 1]
    );
  });

  test("filtra por talla: solo productos con precio en esa talla", () => {
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ size: "30" })).map((p) => p.id),
      [1]
    );
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ size: "100" })).map((p) => p.id),
      [2, 3]
    );
  });

  test("filtra por rango de precio usando el precio representativo (50→100→30)", () => {
    // 9PM = 45.000 (50 ml) y Khamrah = 55.000 (50 ml) caen en "medio"
    // ($40.000–$60.000); Yara = 95.000 (100 ml) queda afuera.
    const result = applyCatalogFilters(CATALOG, withFilters({ priceRange: "medio" }));
    assert.deepEqual(result.map((p) => p.id), [2, 1]);
  });

  test("filtra novedades y más vendidos", () => {
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ onlyNew: true })).map((p) => p.id),
      [2, 3]
    );
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ onlyBestSellers: true })).map((p) => p.id),
      [2, 1]
    );
  });

  test("busca por nombre, marca o inspiración, sin distinguir mayúsculas", () => {
    assert.deepEqual(applyCatalogFilters(CATALOG, withFilters({ q: "afnan" })).map((p) => p.id), [1]);
    assert.deepEqual(applyCatalogFilters(CATALOG, withFilters({ q: "9pm" })).map((p) => p.id), [1]);
    assert.deepEqual(
      applyCatalogFilters(CATALOG, withFilters({ q: "angel's share" })).map((p) => p.id),
      [2]
    );
  });
});

describe("applyCatalogFilters — orden", () => {
  test("precio-asc ordena por precio representativo creciente", () => {
    const result = applyCatalogFilters(CATALOG, withFilters({ order: "precio-asc" }));
    assert.deepEqual(result.map((p) => p.id), [1, 2, 3]);
  });

  test("nombre ordena alfabéticamente", () => {
    const result = applyCatalogFilters(CATALOG, withFilters({ order: "nombre" }));
    assert.deepEqual(result.map((p) => p.id), [1, 2, 3]);
  });

  test("novedad prioriza los recién llegados", () => {
    const result = applyCatalogFilters(CATALOG, withFilters({ order: "novedad" }));
    assert.deepEqual(result[0].id, 3);
  });
});

describe("setFilterValue / clearFilterField", () => {
  test("togglea marcas y selección única", () => {
    const one = setFilterValue(EMPTY_FILTERS, "brands", "afnan");
    assert.deepEqual(one.brands, ["afnan"]);
    assert.deepEqual(setFilterValue(one, "brands", "afnan").brands, []);

    const size = setFilterValue(EMPTY_FILTERS, "size", "50");
    assert.equal(size.size, "50");
    assert.equal(setFilterValue(size, "size", "50").size, null);
  });

  test("togglea novedad y limpia grupos", () => {
    const novo = setFilterValue(EMPTY_FILTERS, "onlyNew", "1");
    assert.equal(novo.onlyNew, true);
    assert.equal(setFilterValue(novo, "onlyNew", "1").onlyNew, false);

    const cleared = clearFilterField({ ...EMPTY_FILTERS, brands: ["x"], size: "30" }, "brands");
    assert.deepEqual(cleared.brands, []);
    assert.equal(cleared.size, "30");
  });

  test("cuenta los filtros activos", () => {
    assert.equal(countActiveFilters(EMPTY_FILTERS), 0);
    assert.equal(
      countActiveFilters(withFilters({ brands: ["a", "b"], size: "50", onlyNew: true })),
      4
    );
  });
});

describe("parseFilters / filtersToParams", () => {
  test("lee los mismos parámetros que usaba la página server-side", () => {
    const filters = parseFilters(
      new URLSearchParams("marca=afnan&marca=lattafa&talla=50&precio=medio&novedad=1&orden=rating")
    );
    assert.deepEqual(filters.brands, ["afnan", "lattafa"]);
    assert.equal(filters.size, "50");
    assert.equal(filters.priceRange, "medio");
    assert.equal(filters.onlyNew, true);
    assert.equal(filters.order, "rating");
  });

  test("reconstruye la query string (ida y vuelta)", () => {
    const params = new URLSearchParams(
      "marca=afnan&talla=50&tipo=hombre&destacados=1&q=khamrah&orden=precio-asc"
    );
    const roundTrip = new URLSearchParams(filtersToParams(parseFilters(params)));
    assert.equal(roundTrip.get("marca"), "afnan");
    assert.equal(roundTrip.get("talla"), "50");
    assert.equal(roundTrip.get("tipo"), "hombre");
    assert.equal(roundTrip.get("destacados"), "1");
    assert.equal(roundTrip.get("q"), "khamrah");
    assert.equal(roundTrip.get("orden"), "precio-asc");
  });
});
