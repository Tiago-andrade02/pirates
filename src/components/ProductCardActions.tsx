"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import type { Prices, Stocks } from "@/lib/types";
import {
  availableSizes,
  defaultSize,
  sizeLabel,
  type PerfumeSize,
} from "@/lib/variants";
import { formatARS } from "@/lib/format";

interface ProductCardActionsProps {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  prices: Prices;
  stockBySize: Stocks;
}

// Parte interactiva de la card: selector de presentación, precio y stock de la
// variante elegida, y "agregar al carrito". Vive en un componente cliente para
// que la card (imagen, marca, nombre) siga renderizándose en el servidor.
//
// Solo se agregan variantes con precio Y stock; la misma regla que valida
// /api/checkout, así que lo que la card deja comprar el servidor no lo rechaza.
export function ProductCardActions({
  slug,
  name,
  brandName,
  image,
  prices,
  stockBySize,
}: ProductCardActionsProps) {
  const { addItem } = useCart();
  const sizes = availableSizes(prices);
  const [size, setSize] = useState<PerfumeSize | null>(() =>
    defaultSize(prices, stockBySize)
  );
  const [added, setAdded] = useState(false);

  const detailHref = `/perfumes/${slug}`;

  if (sizes.length === 0 || size === null) {
    return (
      <div className="mt-auto pt-2">
        <p className="text-xs text-faint sm:text-sm">Consultar disponibilidad</p>
        <Link
          href={detailHref}
          className="mt-2 block w-full rounded-lg border border-line py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:border-white/40 sm:py-2 sm:text-xs"
        >
          Ver detalles
        </Link>
      </div>
    );
  }

  const currentSize: PerfumeSize = size;
  const price = prices[currentSize];
  const stock = stockBySize[currentSize];
  const outOfStock = stock <= 0;

  function handleAdd() {
    if (price === null || outOfStock) return;
    addItem({ slug, size: currentSize, name, brandName, image, price, qty: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="mt-auto pt-2">
      {sizes.length > 1 && (
        <div
          className="mb-1.5 flex flex-wrap gap-1"
          role="group"
          aria-label="Elegí la presentación"
        >
          {sizes.map((option) => {
            const optionOut = stockBySize[option] <= 0;
            const active = option === size;
            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setSize(option);
                  setAdded(false);
                }}
                aria-pressed={active}
                aria-label={`${sizeLabel(option)}${optionOut ? " (agotado)" : ""}`}
                className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold transition-colors sm:text-[11px] ${
                  active
                    ? "border-white bg-white text-black"
                    : optionOut
                      ? "border-line bg-surface-2 text-faint line-through"
                      : "border-line bg-surface-2 text-white hover:border-white/40"
                }`}
              >
                {option} ml
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-bold text-white sm:text-base">
          {price !== null ? formatARS(price) : "Consultar"}
        </p>
        {sizes.length === 1 && (
          <span className="shrink-0 text-[10px] text-faint sm:text-xs">
            {sizeLabel(size)}
          </span>
        )}
      </div>

      <p
        className={`mt-0.5 text-[10px] sm:text-[11px] ${
          outOfStock ? "text-red-400" : "text-emerald-400"
        }`}
      >
        {outOfStock
          ? "Sin stock en esta presentación"
          : `${stock} ${stock === 1 ? "unidad disponible" : "unidades disponibles"}`}
      </p>

      <button
        type="button"
        onClick={handleAdd}
        disabled={outOfStock}
        className={`mi-btn mt-2 w-full rounded-lg py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors sm:py-2 sm:text-xs ${
          outOfStock
            ? "cursor-not-allowed bg-surface-3 text-faint"
            : added
              ? "bg-gold text-black"
              : "bg-white text-black hover:bg-gold"
        }`}
      >
        {outOfStock ? "Sin stock" : added ? "✓ Agregado" : "Agregar al carrito"}
      </button>

      <Link
        href={detailHref}
        className="mt-1 block text-center text-[10px] text-faint transition-colors hover:text-white sm:text-[11px]"
      >
        Ver detalles
      </Link>
    </div>
  );
}
