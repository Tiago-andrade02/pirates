import type { MetadataRoute } from "next";
import { getDb } from "@/lib/db";

const BASE = process.env.SITE_URL ?? "https://pirates-perfumeria.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = getDb()
    .prepare("SELECT slug FROM perfumes")
    .all() as { slug: string }[];

  const staticPages = [
    { url: BASE, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 1 },
    { url: `${BASE}/perfumes`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/marcas`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
    { url: `${BASE}/envios`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${BASE}/devoluciones`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.3 },
    { url: `${BASE}/terminos`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.2 },
    { url: `${BASE}/privacidad`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: 0.2 },
  ];

  const perfumePages = slugs.map((p) => ({
    url: `${BASE}/perfumes/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...perfumePages];
}
