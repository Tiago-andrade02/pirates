"use client";

import { useState } from "react";
import { useCart, type SizeKey } from "./cart/CartProvider";
import type { Prices, Stocks } from "@/lib/types";
import { formatARS } from "@/lib/format";
import {
  availableSizes,
  defaultSize,
  sizeLabel,
  type PerfumeSize,
} from "@/lib/variants";
import { TruckIcon } from "./icons";

interface AddToCartProps {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  prices: Prices;
  stockBySize: Stocks;
}

export function AddToCart({
  slug,
  name,
  brandName,
  image,
  prices,
  stockBySize,
}: AddToCartProps) {
  const { addItem } = useCart();
  // Solo las presentaciones con precio cargado: un tamaño sin precio no existe
  // para la tienda y no debe ofrecerse.
  const sizes = availableSizes(prices);
  const [size, setSize] = useState<PerfumeSize | null>(() =>
    defaultSize(prices, stockBySize)
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (sizes.length === 0 || size === null) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        Producto agotado temporalmente.
      </div>
    );
  }

  const currentSize: PerfumeSize = size;
  const price = prices[currentSize];
  const currentStock = stockBySize[currentSize];
  const outOfStock = currentStock <= 0;

  function handleAdd() {
    if (price === null || outOfStock) return;
    addItem({
      slug,
      size: currentSize as SizeKey,
      name,
      brandName,
      image,
      price,
      qty: Math.min(qty, currentStock),
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3 sm:rounded-2xl sm:p-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
          Presentación
        </p>
        <div className="mt-2 flex gap-1.5 sm:mt-3 sm:gap-2">
          {sizes.map((option) => {
            const optionPrice = prices[option];
            const optionStock = stockBySize[option];
            const unavailable = optionPrice === null || optionStock <= 0;
            const active = size === option;
            return (
              <button
                key={option}
                type="button"
                disabled={unavailable}
                onClick={() => {
                  setSize(option);
                  setQty(1);
                  setAdded(false);
                }}
                className={`mi-size flex-1 rounded-lg border px-2 py-2 text-left sm:rounded-xl sm:px-3 sm:py-2.5 ${
                  active
                    ? "border-white bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.08)]"
                    : "border-line bg-surface-2 text-white hover:border-white/40"
                } ${unavailable ? "cursor-not-allowed opacity-40" : ""}`}
                aria-label={`${sizeLabel(option)}${unavailable ? " (agotado)" : ""}`}
              >
                <span className="block text-xs font-semibold sm:text-sm">
                  {sizeLabel(option)}
                </span>
                <span
                  className={`block text-[10px] sm:text-xs ${
                    active ? "text-black/70" : "text-muted"
                  }`}
                >
                  {optionPrice !== null && optionStock > 0
                    ? formatARS(optionPrice)
                    : "Agotado"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {price !== null && (
        <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3 sm:rounded-xl sm:p-4">
          <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
            Métodos de pago
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-wide text-muted sm:text-[11px]">
              Precio de lista
            </span>
            <span className="text-sm font-semibold text-white sm:text-base">
              {formatARS(price)}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted sm:text-xs">
            Se paga con Mercado Pago. Las cuotas y promociones que ofrezca se
            eligen al pagar.
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5 sm:mt-4 sm:gap-3">
        <div className="flex shrink-0 items-center rounded-full border border-line bg-surface-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="mi-qty flex h-11 w-11 items-center justify-center text-lg text-muted hover:text-white"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold text-white">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => (outOfStock ? q : Math.min(currentStock, q + 1)))}
            disabled={outOfStock || qty >= currentStock}
            className="mi-qty flex h-11 w-11 items-center justify-center text-lg text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className={`mi-btn mi-shine h-11 flex-1 rounded-full text-sm font-semibold ${
            outOfStock
              ? "cursor-not-allowed bg-surface-3 text-faint"
              : added
                ? "bg-white text-black"
                : "bg-white text-black hover:bg-neutral-200"
          }`}
        >
          {added
            ? "✓ Agregado"
            : outOfStock
              ? "Sin stock"
              : "Agregar al carrito"}
        </button>
      </div>

      <p className="mt-2.5 flex items-center gap-2 text-[11px] text-muted sm:text-xs">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
            outOfStock ? "bg-red-500" : "bg-emerald-400"
          }`}
        />
        {outOfStock
          ? "Sin stock disponible"
          : `${currentStock} ${currentStock === 1 ? "unidad" : "unidades"} · Envío a todo el país`}
      </p>

      {!outOfStock && price !== null && (
        <p className="mt-1.5 flex items-center gap-2 text-[11px] sm:text-xs">
          <TruckIcon className="h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
          <span className="font-medium text-emerald-400">
            Envío gratis a todo el país
          </span>
        </p>
      )}
    </div>
  );
}
