// Códigos de provincia oficiales de la API MiCorreo de Correo Argentino
// (ver documentación oficial "API MiCorreo" -> Notes: Province Codes).

export const PROVINCE_CODES: Record<string, string> = {
  "Buenos Aires": "B",
  "Ciudad Autónoma de Buenos Aires": "C",
  CABA: "C",
  Catamarca: "K",
  Chaco: "H",
  Chubut: "U",
  "Córdoba": "X",
  Corrientes: "W",
  "Entre Ríos": "E",
  Formosa: "P",
  Jujuy: "Y",
  "La Pampa": "L",
  "La Rioja": "F",
  Mendoza: "M",
  Misiones: "N",
  Neuquén: "Q",
  "Río Negro": "R",
  Salta: "A",
  "San Juan": "J",
  "San Luis": "D",
  "Santa Cruz": "Z",
  "Santa Fe": "S",
  "Santiago del Estero": "G",
  "Tierra del Fuego": "V",
  Tucumán: "T",
};

export const PROVINCE_CODE_LABELS: Record<string, string> = {
  A: "Salta",
  B: "Buenos Aires",
  C: "Ciudad Autónoma de Buenos Aires",
  D: "San Luis",
  E: "Entre Ríos",
  F: "La Rioja",
  G: "Santiago del Estero",
  H: "Chaco",
  J: "San Juan",
  K: "Catamarca",
  L: "La Pampa",
  M: "Mendoza",
  N: "Misiones",
  P: "Formosa",
  Q: "Neuquén",
  R: "Río Negro",
  S: "Santa Fe",
  T: "Tucumán",
  U: "Chubut",
  V: "Tierra del Fuego",
  W: "Corrientes",
  X: "Córdoba",
  Y: "Jujuy",
  Z: "Santa Cruz",
};

export const PROVINCES: { name: string; code: string }[] = Object.entries(
  PROVINCE_CODES
)
  .filter(([name]) => name !== "CABA")
  .map(([name, code]) => ({ name, code }));

export function provinceCodeFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = name.trim();
  return PROVINCE_CODES[key] ?? null;
}

export function provinceNameFor(code: string | null | undefined): string | null {
  if (!code) return null;
  return PROVINCE_CODE_LABELS[code] ?? null;
}

const POSTAL_CODE_RE = /^[A-Za-z]{0,1}\d{4}[A-Za-z]{0,3}$/;

export function isValidPostalCode(value: string): boolean {
  return POSTAL_CODE_RE.test(value.trim());
}
