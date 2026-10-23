import type { Metadata } from "next";
import { getBrands, getCatalog } from "@/lib/data";
import { EMPTY_FILTERS } from "@/lib/catalog-filters";
import { CatalogClient } from "@/components/CatalogClient";

// ISR (Etapa 1 → Paso 2): el catálogo se prerenderiza una sola vez y se sirve
// desde la caché (revalidación máxima cada 60 s). El filtrado, orden y búsqueda
// corren en el navegador (CatalogClient) sobre los datos ya incluidos en la
// página, así que ninguna combinación de filtros (?marca=…, ?talla=…) ejecuta la
// función ni consulta Turso. Las acciones del admin purgan esta ruta al instante
// vía revalidatePublicCatalog (src/lib/catalog-revalidation.ts).
export const revalidate = 60;

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
