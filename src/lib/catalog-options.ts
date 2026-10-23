import type { Aroma, Gender, Occasion, Season } from "./types.ts";

// Opciones de filtrado del catálogo. Viven en un módulo sin dependencias del
// servidor (ni DB ni red) para poder importarse tanto desde componentes de
// servidor como de cliente. `data.ts` las re-exporta para no romper a los
// importadores que ya las tomaban de ahí.
export const PRICE_RANGES: { key: string; label: string; min: number; max: number }[] = [
  { key: "bajo", label: "Hasta $40.000", min: 0, max: 40000 },
  { key: "medio", label: "$40.000 – $60.000", min: 40000, max: 60000 },
  { key: "alto", label: "$60.000 – $90.000", min: 60000, max: 90000 },
  { key: "premium", label: "Más de $90.000", min: 90000, max: Infinity },
];

export const SIZE_OPTIONS = ["30", "50", "100"] as const;

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
  { value: "unisex", label: "Unisex" },
];

export const AROMA_OPTIONS: { value: Aroma; label: string }[] = [
  { value: "dulce", label: "Dulce" },
  { value: "fresco", label: "Fresco" },
  { value: "citrico", label: "Cítrico" },
  { value: "amaderado", label: "Amaderado" },
  { value: "ambar", label: "Ámbar" },
  { value: "vainilla", label: "Vainilla" },
  { value: "floral", label: "Floral" },
];

export const SEASON_OPTIONS: { value: Season; label: string }[] = [
  { value: "verano", label: "Verano" },
  { value: "invierno", label: "Invierno" },
  { value: "primavera", label: "Primavera" },
  { value: "otono", label: "Otoño" },
  { value: "todo-el-ano", label: "Todo el año" },
];

export const OCCASION_OPTIONS: { value: Occasion; label: string }[] = [
  { value: "oficina", label: "Oficina" },
  { value: "noche", label: "Noche" },
  { value: "citas", label: "Citas" },
  { value: "diario", label: "Diario" },
  { value: "fiesta", label: "Fiesta" },
];
