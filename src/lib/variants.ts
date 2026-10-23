import type { Prices, Stocks } from "./types.ts";

// Presentaciones soportadas por el catálogo. El orden es de menor a mayor.
// Es el mismo conjunto que usa CartProvider (SizeKey) y el checkout (SIZE_PRICE):
// una presentación que no esté acá no existe para el carrito ni para el servidor.
export type PerfumeSize = "30" | "50" | "100";

export const PERFUME_SIZES: PerfumeSize[] = ["30", "50", "100"];

// Orden de preferencia al abrir una ficha: primero la presentación más vendible
// (50 ml), después 100 y por último 30. Es el criterio histórico de AddToCart.
export const SIZE_PREFERENCE: PerfumeSize[] = ["50", "100", "30"];

export const SIZE_LABELS: Record<PerfumeSize, string> = {
  "30": "30 ml",
  "50": "50 ml",
  "100": "100 ml",
};

export function sizeLabel(size: PerfumeSize): string {
  return SIZE_LABELS[size];
}

// Una presentación "existe" si tiene precio cargado. El precio es el indicador de
// que el negocio vende ese tamaño; un tamaño sin precio no debe mostrarse.
export function isAvailable(prices: Prices, size: PerfumeSize): boolean {
  return prices[size] !== null;
}

// Una presentación se puede comprar solo si tiene precio Y stock por tamaño.
// Es exactamente la regla que valida el servidor en /api/checkout (price_<size> y
// stock_<size>), así que la card y el backend no pueden discrepar.
export function isBuyable(prices: Prices, stocks: Stocks, size: PerfumeSize): boolean {
  return prices[size] !== null && stocks[size] > 0;
}

// Presentaciones con precio (las que se muestran en el selector, aunque estén
// agotadas: se marcan como agotadas en vez de ocultarlas).
export function availableSizes(prices: Prices): PerfumeSize[] {
  return PERFUME_SIZES.filter((size) => isAvailable(prices, size));
}

// Presentaciones realmente comprables (precio y stock).
export function buyableSizes(prices: Prices, stocks: Stocks): PerfumeSize[] {
  return PERFUME_SIZES.filter((size) => isBuyable(prices, stocks, size));
}

export function hasAnyBuyable(prices: Prices, stocks: Stocks): boolean {
  return buyableSizes(prices, stocks).length > 0;
}

// Presentación por defecto al abrir la card/ficha: la primera preferida que se
// pueda comprar. Si ninguna se puede comprar pero hay precios, devuelve la
// primera preferida disponible (para mostrar el precio aunque esté agotada). Si
// no hay ningún precio, devuelve null.
export function defaultSize(prices: Prices, stocks: Stocks): PerfumeSize | null {
  const buyable = buyableSizes(prices, stocks);
  const preferredBuyable = SIZE_PREFERENCE.find((size) => buyable.includes(size));
  if (preferredBuyable) return preferredBuyable;

  const available = availableSizes(prices);
  const preferredAvailable = SIZE_PREFERENCE.find((size) => available.includes(size));
  return preferredAvailable ?? available[0] ?? null;
}
