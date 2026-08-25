import { getDb } from "@/lib/db";

interface AssistantRequest {
  aromas: string[];
  occasions: string[];
  intensity: string;
  budget: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AssistantRequest;
  const { aromas, occasions, intensity, budget } = body;

  const db = await getDb();

  let where = "WHERE p.stock > 0";
  const args: (string | number)[] = [];

  if (aromas.length > 0) {
    const aromaConditions = aromas.map((a) => `p.aroma LIKE ?`);
    where += ` AND (${aromaConditions.join(" OR ")})`;
    aromas.forEach((a) => args.push(`%"${a}"%`));
  }

  if (occasions.length > 0) {
    const occasionConditions = occasions.map((o) => `p.occasion LIKE ?`);
    where += ` AND (${occasionConditions.join(" OR ")})`;
    occasions.forEach((o) => args.push(`%"${o}"%`));
  }

  if (intensity === "suave") {
    where += " AND p.projection <= 2";
  } else if (intensity === "moderada") {
    where += " AND p.projection >= 2 AND p.projection <= 3";
  } else if (intensity === "intensa") {
    where += " AND p.projection >= 4";
  }

  if (budget === "bajo") {
    where += " AND COALESCE(p.price_50, p.price_30, p.price_100) < 40000";
  } else if (budget === "medio") {
    where += " AND COALESCE(p.price_50, p.price_30, p.price_100) >= 40000 AND COALESCE(p.price_50, p.price_30, p.price_100) <= 60000";
  } else if (budget === "alto") {
    where += " AND COALESCE(p.price_50, p.price_30, p.price_100) > 60000";
  }

  const result = await db.execute({
    sql: `SELECT p.slug, p.name, p.image, p.description,
                 p.price_30, p.price_50, p.price_100,
                 p.rating, p.review_count, p.aroma, p.occasion,
                 b.name AS brand_name
          FROM perfumes p
          JOIN brands b ON b.id = p.brand_id
          ${where}
          ORDER BY p.best_seller DESC, p.rating DESC, p.review_count DESC
          LIMIT 3`,
    args,
  });

  const perfumes = result.rows.map((r: Record<string, unknown>) => ({
    slug: r.slug,
    name: r.name,
    image: `/perfumes/${r.image}-1.png`,
    description: r.description,
    price: r.price_50 ?? r.price_100 ?? r.price_30,
    rating: r.rating,
    brand: r.brand_name,
  }));

  return Response.json(perfumes);
}
