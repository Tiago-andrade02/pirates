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
      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-muted">
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
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div>
        <p className="text-xs uppercase tracking-widest text-faint">
          Presentación
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
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
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors sm:py-3 ${
                  active
                    ? "border-white bg-white text-black"
                    : "border-line bg-surface-2 text-white hover:border-white/40"
                } ${optionPrice === null ? "cursor-not-allowed opacity-40" : ""}`}
              >
                <span className="block text-sm font-semibold">
                  {option.label}
                </span>
                <span
                  className={`block text-xs ${
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
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
          <p className="text-xs uppercase tracking-widest text-faint">
            Métodos de pago
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2">
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[11px] uppercase tracking-wide text-faint sm:mb-1">
                Precio lista
              </p>
              <p className="text-sm font-semibold text-white">
                {formatARS(price)}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[11px] uppercase tracking-wide text-faint sm:mb-1">
                Transferencia -10%
              </p>
              <p className="text-sm font-semibold text-emerald-400">
                {transferPrice !== null ? formatARS(transferPrice) : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3 sm:block">
              <p className="text-[11px] uppercase tracking-wide text-faint sm:mb-1">
                3 cuotas sin interés
              </p>
              <p className="text-sm font-semibold text-white">
                {installment !== null ? `${formatARS(installment)} c/u` : "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 sm:mt-5 sm:gap-4">
        <div className="flex items-center rounded-full border border-line bg-surface-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-lg text-muted transition-colors hover:text-white sm:h-11 sm:w-11"
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
            className="flex h-10 w-10 items-center justify-center text-lg text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11"
            aria-label="Aumentar cantidad"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={outOfStock}
          className={`h-10 flex-1 rounded-full text-sm font-semibold transition-all sm:h-11 ${
            outOfStock
              ? "cursor-not-allowed bg-surface-3 text-faint"
              : added
                ? "bg-white text-black"
                : "bg-white text-black hover:bg-neutral-200"
          }`}
        >
          {added
            ? "Agregado al carrito ✓"
            : outOfStock
              ? "Sin stock"
              : "Agregar al carrito"}
        </button>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <span
          className={`h-2 w-2 rounded-full ${
            outOfStock ? "bg-red-500" : "bg-emerald-400"
          }`}
        />
        {outOfStock
          ? "Sin stock disponible"
          : `${stock} unidades disponibles · Envío a todo el país`}
      </p>

      {!outOfStock && price !== null && (() => {
        const lineTotal = price * qty;
        const freeShipping = lineTotal >= FREE_SHIPPING_MIN;
        const missing = Math.max(0, FREE_SHIPPING_MIN - lineTotal);
        return (
          <p className="mt-2 flex items-center gap-2 text-xs">
            <TruckIcon className="h-4 w-4 shrink-0 text-faint" />
            {freeShipping ? (
              <span className="font-medium text-emerald-400">
                Envío gratis
              </span>
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
