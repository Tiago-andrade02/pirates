import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL || "https://piratesarg.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/perfumes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/marcas`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/envios`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/devoluciones`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE}/privacidad`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.2 },
  ];

  try {
    const { getDb } = await import("@/lib/db");
    const db = await getDb();
    const result = await db.execute("SELECT slug FROM perfumes");
    const slugs = result.rows as unknown as { slug: string }[];

    const perfumePages: MetadataRoute.Sitemap = slugs.map((p) => ({
      url: `${BASE}/perfumes/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

    return [...staticPages, ...perfumePages];
  } catch {
    return staticPages;
  }
}
