import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // "/*?" bloquea las URLs con query-string. El catálogo genera una URL
        // distinta por cada combinación de filtros (?marca=, ?talla=, ?aroma=,
        // ?q=, ...): millones de variantes que los crawlers rastreaban y que
        // ejecutaban la función + consulta a Turso en cada visita. La única URL
        // indexable del catálogo es /perfumes (ver canonical en su metadata).
        disallow: ["/admin", "/api", "/checkout", "/*?"],
      },
    ],
    sitemap: `${process.env.SITE_URL ?? "https://piratesarg.com"}/sitemap.xml`,
  };
}
