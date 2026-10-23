import { getDb } from "@/lib/db";

// Índice del buscador. Antes este handler consultaba Turso en cada petición
// (una por tecla tipeada). Ahora es estático: se prerenderiza en el build, se
// sirve desde la caché de Vercel y se revalida cada 60 s o al instante cuando el
// admin cambia el catálogo (catalogPaths incluye /api/search). El cliente baja
// la lista una vez y filtra en el navegador, así tipear no ejecuta funciones.
export const dynamic = "force-static";
export const revalidate = 60;

export async function GET() {
  const db = await getDb();
  const result = await db.execute(
    `SELECT p.slug, p.name, p.image, p.inspired_by,
            b.name AS brand_name,
            COALESCE(p.price_50, p.price_100, p.price_30) AS price
     FROM perfumes p
     JOIN brands b ON b.id = p.brand_id
     ORDER BY p.name ASC`
  );

  return Response.json(result.rows);
}
