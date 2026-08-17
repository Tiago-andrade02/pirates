import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const seedPath = path.join(root, "src", "lib", "seed.json");
const outDir = path.join(root, "public", "perfumes");

const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
const brands = new Map(seed.brands.map((b) => [b.slug, b.name]));

fs.mkdirSync(outDir, { recursive: true });

function bottleParts(opts) {
  const {
    cx = 400,
    label = "",
    brand = "",
    variant = 1,
  } = opts;

  const bodyY = variant === 3 ? 380 : 430;
  const bodyW = variant === 3 ? 330 : 300;
  const bodyX = cx - bodyW / 2;

  const glassGradId = `glass${cx}${variant}`;
  const bgGradId = `bg${cx}${variant}`;
  const glowId = `glow${cx}${variant}`;
  const shineId = `shine${cx}${variant}`;

  const parts = [];
  parts.push(`
    <defs>
      <linearGradient id="${bgGradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#101010"/>
        <stop offset="1" stop-color="#030303"/>
      </linearGradient>
      <radialGradient id="${glowId}" cx="0.5" cy="0.42" r="0.55">
        <stop offset="0" stop-color="#2a2a2a" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${glassGradId}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#1d1d1d"/>
        <stop offset="0.25" stop-color="#0a0a0a"/>
        <stop offset="0.7" stop-color="#000000"/>
        <stop offset="1" stop-color="#222222"/>
      </linearGradient>
      <linearGradient id="${shineId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
    </defs>`);

  parts.push(`<rect width="800" height="1000" fill="url(#${bgGradId})"/>`);
  parts.push(`<ellipse cx="${cx}" cy="520" rx="420" ry="480" fill="url(#${glowId})"/>`);

  if (variant === 3) {
    parts.push(`
      <g transform="translate(${cx - 400}, 300)">
        <rect x="90" y="40" width="620" height="150" rx="12" fill="#0c0c0c" stroke="#2c2c2c"/>
        <text x="400" y="105" text-anchor="middle" font-family="Georgia, serif" font-size="30" letter-spacing="10" fill="#e8e8e8">${brand.toUpperCase()}</text>
        <text x="400" y="155" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" letter-spacing="4" fill="#8a8a8a">P A R F U M S</text>
      </g>
      <g transform="scale(1.18) translate(${cx - 400 - 75}, 180)">
        <rect x="${bodyX - 40}" y="${bodyY - 40}" width="${bodyW + 80}" height="${520 - bodyY + 240}" rx="34" fill="url(#${glassGradId})" opacity="0.0"/>
      </g>
    `);
  }

  // shadow
  parts.push(`<ellipse cx="${cx}" cy="840" rx="240" ry="30" fill="#000000" opacity="0.6"/>`);
  parts.push(`<ellipse cx="${cx}" cy="842" rx="150" ry="14" fill="#ffffff" opacity="0.04"/>`);

  // body
  parts.push(`
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${780 - bodyY}" rx="30"
          fill="url(#${glassGradId})" stroke="#3a3a3a" stroke-width="1.5"/>
  `);

  // shoulder + neck
  const neckY = variant === 3 ? 300 : 340;
  parts.push(`
    <path d="M ${bodyX + 34} ${bodyY} L ${cx - 34} ${neckY} L ${cx + 34} ${neckY} L ${bodyX + bodyW - 34} ${bodyY} Z"
          fill="url(#${glassGradId})" stroke="#3a3a3a" stroke-width="1.5"/>
    <rect x="${cx - 34}" y="${neckY - 14}" width="68" height="150" fill="#0a0a0a" stroke="#3a3a3a" stroke-width="1.5"/>
  `);

  // collar + cap
  parts.push(`
    <rect x="${cx - 44}" y="${neckY - 34}" width="88" height="22" rx="4" fill="#e8e8e8"/>
    <rect x="${cx - 40}" y="${neckY - 26}" width="80" height="12" fill="#bdbdbd"/>
    <rect x="${cx - 40}" y="${neckY - 74}" width="80" height="48" rx="10" fill="#0f0f0f" stroke="#4a4a4a" stroke-width="1.5"/>
    <rect x="${cx - 40}" y="${neckY - 74}" width="80" height="10" rx="5" fill="#e8e8e8" opacity="0.9"/>
  `);

  // glass shine
  parts.push(`
    <rect x="${bodyX + 14}" y="${bodyY + 10}" width="46" height="${780 - bodyY - 20}" rx="20"
          fill="url(#${shineId})" opacity="0.35"/>
    <rect x="${bodyX + bodyW - 24}" y="${bodyY + 16}" width="8" height="${780 - bodyY - 32}" rx="4" fill="#ffffff" opacity="0.18"/>
  `);

  if (variant !== 3) {
    // label
    const labelY = variant === 2 ? 570 : 545;
    parts.push(`
      <rect x="${bodyX + 40}" y="${labelY}" width="${bodyW - 80}" height="150" rx="6"
            fill="#0c0c0c" stroke="#2f2f2f" stroke-width="1.5"/>
      <line x1="${bodyX + 60}" y1="${labelY + 30}" x2="${bodyX + bodyW - 60}" y2="${labelY + 30}" stroke="#555555" stroke-width="1"/>
      <text x="${cx}" y="${labelY + 58}" text-anchor="middle" font-family="Arial, sans-serif"
            font-size="13" letter-spacing="6" fill="#8a8a8a">${brand.toUpperCase()}</text>
      <text x="${cx}" y="${labelY + 108}" text-anchor="middle" font-family="Georgia, serif"
            font-size="${variant === 2 ? 26 : 30}" letter-spacing="2" fill="#f2f2f2">${label.toUpperCase()}</text>
      <line x1="${bodyX + 60}" y1="${labelY + 128}" x2="${bodyX + bodyW - 60}" y2="${labelY + 128}" stroke="#555555" stroke-width="1"/>
    `);
  }

  return parts.join("\n");
}

function makeBottle(perfume, brandName, variant) {
  const label = perfume.name;
  const brand = brandName;
  const inner = bottleParts({ cx: 400, label, brand, variant });
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
${inner}
</svg>`;
}

function makeHero() {
  const a = bottleParts({ cx: 330, label: "Khamrah", brand: "Lattafa", variant: 1 });
  const b = bottleParts({ cx: 570, label: "9PM", brand: "Afnan", variant: 1 });
  const c = bottleParts({ cx: 400, label: "Asad", brand: "Lattafa", variant: 2 });

  const hero = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" width="1600" height="1000">
  <defs>
    <linearGradient id="heroBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101010"/>
      <stop offset="1" stop-color="#020202"/>
    </linearGradient>
    <radialGradient id="heroGlow" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#333333" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#heroBg)"/>
  <ellipse cx="800" cy="520" rx="900" ry="600" fill="url(#heroGlow)"/>
  <ellipse cx="800" cy="870" rx="620" ry="60" fill="#000000" opacity="0.55"/>
  <g transform="translate(60, 120) scale(0.62)">${a}</g>
  <g transform="translate(660, 30) scale(0.92)">${c}</g>
  <g transform="translate(1120, 150) scale(0.6)">${b}</g>
</svg>`;
  return hero;
}

const only = process.argv.slice(2);
const targets = only.length
  ? seed.perfumes.filter((p) => only.includes(p.slug))
  : seed.perfumes;

for (const perfume of targets) {
  const brandName = brands.get(perfume.brand) ?? perfume.brand;
  for (const variant of [1, 2]) {
    const file = path.join(outDir, `${perfume.slug}-${variant}.svg`);
    fs.writeFileSync(file, makeBottle(perfume, brandName, variant), "utf8");
  }
}

if (!only.length) {
  fs.writeFileSync(path.join(root, "public", "hero.svg"), makeHero(), "utf8");
}

console.log(
  `Generated ${targets.length * 3} perfume images` +
    (only.length ? ` (${only.join(", ")})` : " + hero.svg")
);
