import fs from "node:fs";
import path from "node:path";

function pngSize(buffer) {
  const w = buffer.readUInt32BE(16);
  const h = buffer.readUInt32BE(20);
  return { w, h };
}

const [src, dest] = process.argv.slice(2);
const png = fs.readFileSync(src);
const { w, h } = pngSize(png);
const b64 = png.toString("base64");
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#0d0d0d"/><image xlink:href="data:image/png;base64,` +
  b64 +
  `"/></svg>`;
fs.writeFileSync(dest, svg);
console.log(`escrito ${path.basename(dest)} (${w}x${h}, ${(svg.length / 1024).toFixed(0)} KB)`);
