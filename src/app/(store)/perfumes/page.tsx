import type { Metadata } from "next";
import { getBrands, getCatalog } from "@/lib/data";
import { EMPTY_FILTERS } from "@/lib/catalog-filters";
import { CatalogClient } from "@/components/CatalogClient";

// Renderizado dinámico: el catálogo consulta la DB en runtime. Evita que
// `next build` abra `file:./data/pirates.db` o congele un catálogo incompleto.
// El filtrado, orden y búsqueda siguen corriendo en el navegador (CatalogClient).
export const dynamic = "force-dynamic";

// SEO: una única URL canónica (/perfumes). Las URLs con filtros se bloquean a
// nivel de crawler en robots.ts ("/*?") para no generar miles de variantes.
export const metadata: Metadata = {
  title: "Catálogo de Perfumes",
  description:
    "Explorá nuestro catálogo de perfumes árabes e importados de alta calidad. Filtrá por marca, tamaño, aroma, estación y ocasión.",
  alternates: { canonical: "/perfumes" },
};

export default async function CatalogPage() {
  const [perfumes, brands] = await Promise.all([
    getCatalog(EMPTY_FILTERS),
    getBrands(),
  ]);

  return <CatalogClient perfumes={perfumes} brands={brands} />;
}
