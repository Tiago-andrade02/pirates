import fs from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public", "perfumes");

export function productImageUrl(image: string, variant = 1): string {
  const base = `/perfumes/${image}-${variant}`;
  const pngPath = path.join(PUBLIC_DIR, `${image}-${variant}.png`);
  if (fs.existsSync(pngPath)) return `${base}.png`;
  return `${base}.svg`;
}
