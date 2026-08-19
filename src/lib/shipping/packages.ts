import { getDb } from "@/lib/db";
import type { PackageDimensions } from "./types";

export interface LineItem {
  slug: string;
  qty: number;
}

export interface PackageInfo extends PackageDimensions {
  lineCount: number;
}

// El peso y las dimensiones del paquete se calculan SIEMPRE en el backend a
// partir de los datos reales del producto (perfumes.package_*). El cliente
// nunca puede enviar peso ni dimensiones.
export async function computePackageForItems(items: LineItem[]): Promise<PackageInfo> {
  const db = await getDb();

  let weightGrams = 0;
  let lengthCm = 0;
  let widthCm = 0;
  let heightCm = 0;
  const missing: string[] = [];

  for (const item of items) {
    const qty = Math.floor(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Cantidad inválida para ${item.slug}`);
    }
    const result = await db.execute({
      sql: `SELECT package_weight, package_length, package_width, package_height
       FROM perfumes WHERE slug = ?`,
      args: [item.slug],
    });
    const row = result.rows[0] as unknown as
      | {
          package_weight: number;
          package_length: number;
          package_width: number;
          package_height: number;
        }
      | undefined;
    if (!row) {
      throw new Error(`Producto no encontrado: ${item.slug}`);
    }
    const weight = Number(row.package_weight);
    const length = Number(row.package_length);
    const width = Number(row.package_width);
    const height = Number(row.package_height);
    if (weight <= 0 || length <= 0 || width <= 0 || height <= 0) {
      missing.push(item.slug);
      continue;
    }
    weightGrams += weight * qty;
    lengthCm = Math.max(lengthCm, length);
    widthCm = Math.max(widthCm, width);
    heightCm = Math.max(heightCm, height);
  }

  if (missing.length > 0) {
    throw new Error(
      `Productos sin datos de empaque configurados: ${missing.join(", ")}`
    );
  }

  return {
    weightGrams,
    lengthCm,
    widthCm,
    heightCm,
    lineCount: items.length,
  };
}
