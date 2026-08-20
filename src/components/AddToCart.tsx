"use client";

import { useState } from "react";
import { useCart, type SizeKey } from "./cart/CartProvider";
import type { Prices } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { TruckIcon } from "./icons";

const FREE_SHIPPING_MIN = 80000;

interface AddToCartProps {
  slug: string;
  name: string;
  brandName: string;
  image: string;
  prices: Prices;
  stock: number;
}

const SIZES: { key: SizeKey; label: string }[] = [
  { key: "30", label: "30 ml" },
  { key: "50", label: "50 ml" },
  { key: "100", label: "100 ml" },
];

export function AddToCart({
  slug,
  name,
  brandName,
  image,
  prices,
  stock,
}: AddToCartProps) {
  const { addItem } = useCart();
  const [size, setSize] = useState<SizeKey | null>(
    (["50", "100", "30"] as SizeKey[]).find((s) => prices[s] !== null) ?? null
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (size === null) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        Producto agotado temporalmente.
      </div>
    );
  }

  const currentSize: SizeKey = size;
  const price = prices[currentSize];
  const outOfStock = stock <= 0;
  const transferPrice = price !== null ? Math.round(price * 0.9) : null;
  const installment = price !== null ? Math.round(price / 3) : null;

  function handleAdd() {
    if (price === null || outOfStock) return;
    addItem({
      slug,
      size: currentSize,
      name,
      brandName,
      image,
      price,
      qty: Math.min(qty, stock),
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
        <div className="mt-2 grid grid-cols-3 gap-1.5 sm:mt-3 sm:gap-2">
          {SIZES.map((option) => {
            const optionPrice = prices[option.key];
            const active = size === option.key;
            return (
              <button
                key={option.key}
                type="button"
                disabled={optionPrice === null}
                onClick={() => {
                  setSize(option.key);
                  setQty(1);
                }}
                className={`rounded-lg border px-2 py-2 text-left transition-colors sm:rounded-xl sm:px-3 sm:py-2.5 ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-line bg-surface-2 text-white hover:border-white/40"
                } ${optionPrice === null ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <span className="block text-xs font-semibold sm:text-sm">
                  {option.label}
                </span>
                <span
                  className={`block text-[10px] sm:text-xs ${
                    active ? "text-black/70" : "text-muted"
                  }`}
                >
                  {optionPrice !== null ? formatARS(optionPrice) : "Agotado"}
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
          <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-3 sm:gap-2">
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[9px] uppercase tracking-wide text-faint sm:mb-0.5 sm:text-[11px]">
                Precio lista
              </p>
              <p className="text-xs font-semibold text-white sm:text-sm">
                {formatARS(price)}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[9px] uppercase tracking-wide text-faint sm:mb-0.5 sm:text-[11px]">
                Transferencia -10%
              </p>
              <p className="text-xs font-semibold text-emerald-400 sm:text-sm">
                {transferPrice !== null ? formatARS(transferPrice) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[9px] uppercase tracking-wide text-faint sm:mb-0.5 sm:text-[11px]">
                3 cuotas sin interés
              </p>
              <p className="text-xs font-semibold text-white sm:text-sm">
                {installment !== null ? `${formatARS(installment)} c/u` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5 sm:mt-4 sm:gap-3">
        <div className="flex shrink-0 items-center rounded-full border border-line bg-surface-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-11 w-11 items-center justify-center text-lg text-muted transition-colors hover:text-white"
            aria-label="Disminuir cantidad"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold text-white">
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => (outOfStock ? q : Math.min(stock, q + 1)))}
            disabled={outOfStock || qty >= stock}
            className="flex h-11 w-11 items-center justify-center text-lg text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className={`h-11 flex-1 rounded-full text-sm font-semibold transition-all ${
            outOfStock
              ? "cursor-not-allowed bg-surface-3 text-faint"
              : added
                ? "bg-white text-black"
                : "bg-white text-black hover:bg-neutral-200"
          }`}
        >
          {added
            ? "Agregado ✓"
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
          : `${stock} unidades · Envío a todo el país`}
      </p>

      {!outOfStock && price !== null && (() => {
        const lineTotal = price * qty;
        const freeShipping = lineTotal >= FREE_SHIPPING_MIN;
        const missing = Math.max(0, FREE_SHIPPING_MIN - lineTotal);
        return (
          <p className="mt-1.5 flex items-center gap-2 text-[11px] sm:text-xs">
            <TruckIcon className="h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
            {freeShipping ? (
              <span className="font-medium text-emerald-400">Envío gratis</span>
            ) : (
              <span className="text-muted">
                Te faltan {formatARS(missing)} para envío gratis
              </span>
            )}
          </p>
        );
      })()}
    </div>
  );
}
