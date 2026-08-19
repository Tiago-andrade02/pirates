import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json([]);

  const like = `%${q}%`;
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT p.slug, p.name, p.image, b.name AS brand_name,
              COALESCE(p.price_50, p.price_100, p.price_30) AS price
       FROM perfumes p
       JOIN brands b ON b.id = p.brand_id
       WHERE p.name LIKE ? OR b.name LIKE ? OR p.inspired_by LIKE ?
       ORDER BY (p.name LIKE ?) DESC, p.rating DESC, p.review_count DESC
       LIMIT 8`,
    args: [like, like, like, `%${q}%`],
  });

  return Response.json(result.rows);
}
