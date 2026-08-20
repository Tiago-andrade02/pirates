import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "perfumes");

const cache = new Map<string, boolean>();

function exists(filePath: string): boolean {
  const cached = cache.get(filePath);
  if (cached !== undefined) return cached;
  const exists = fs.existsSync(filePath);
  cache.set(filePath, exists);
  return exists;
}

export function productImageUrl(image: string, variant = 1): string {
  const base = `/perfumes/${image}-${variant}`;
  const pngPath = path.join(PUBLIC_DIR, `${image}-${variant}.png`);
  if (exists(pngPath)) return `${base}.png`;
  return `${base}.svg`;
}
