import { revalidatePath } from "next/cache";

// Rutas públicas servidas desde la caché ISR del catálogo (Etapa 1). Se
// comparten entre las server actions del admin y el cierre de pago para que
// cualquier cambio de stock/precio/disponibilidad las purgue desde un único
// lugar: quedan enumeradas acá para no olvidar ninguna al agregar rutas.
export function catalogPaths(slug?: string): string[] {
  const paths = ["/", "/perfumes", "/marcas", "/sitemap.xml", "/api/search"];
  if (slug) paths.push(`/perfumes/${slug}`);
  return paths;
}

// Purga la caché del catálogo público. `slug` es opcional: se usa cuando el
// cambio afecta la ficha de un producto concreto.
export function revalidatePublicCatalog(slug?: string): void {
  for (const path of catalogPaths(slug)) {
    revalidatePath(path);
  }
}
