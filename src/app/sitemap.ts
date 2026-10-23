import type { MetadataRoute } from "next";
import { getPerfumeSlugs } from "@/lib/data";

const BASE = process.env.SITE_URL || "https://piratesarg.com";

// Cacheable (Etapa 1): se regenera como máximo cada hora en lugar de emitir una
// fecha nueva en cada solicitud. No se emite `lastModified`: la base no guarda
// un timestamp de modificación de producto, así que cualquier fecha sería
// inventada (y ensuciaría el rastreo de los buscadores).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/perfumes`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/marcas`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/envios`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/devoluciones`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terminos`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE}/privacidad`, changeFrequency: "monthly", priority: 0.2 },
  ];

  // Si Turso no responde, el error PROPAGA: preferimos que la generación falle
  // (y se reintente en la próxima revalidación, a los 60 min o al purgar el
  // catálogo) antes que cachear como válido un sitemap sin URLs de producto.
  const slugs = await getPerfumeSlugs();

  const perfumePages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${BASE}/perfumes/${slug}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...perfumePages];
}
