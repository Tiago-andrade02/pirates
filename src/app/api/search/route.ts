import { getDb } from "@/lib/db";

// Índice del buscador. Dinámico: se genera en runtime para no consultar la DB
// durante `next build` ni cachear un índice incompleto. El cliente baja la lista
// una vez y filtra en el navegador, así tipear no ejecuta funciones.
export const dynamic = "force-dynamic";

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
