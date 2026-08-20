"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Perfume } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { useCart, type SizeKey } from "./cart/CartProvider";
import { CartIcon, StarIcon } from "./icons";

function referencePrice(p: Perfume): number | null {
  return p.prices["50"] ?? p.prices["100"] ?? p.prices["30"];
}

function defaultSize(p: Perfume): SizeKey | null {
  if (p.prices["50"] !== null) return "50";
  if (p.prices["100"] !== null) return "100";
  if (p.prices["30"] !== null) return "30";
  return null;
}

export function ProductCard({ perfume }: { perfume: Perfume }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const price = referencePrice(perfume);
  const price50 = perfume.prices["50"];
  const displayPrice = price50 ?? price;
  const transferPrice = displayPrice !== null ? Math.round(displayPrice * 0.9) : null;
  const outOfStock = perfume.stock <= 0;
  const size = defaultSize(perfume);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (outOfStock || size === null || displayPrice === null) return;
    addItem({
      slug: perfume.slug,
      size,
      name: perfume.name,
      brandName: perfume.brand.name,
      image: perfume.image,
      price: displayPrice,
      qty: 1,
    });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:border-white/25 hover:bg-surface-2 sm:rounded-2xl ${
        outOfStock ? "opacity-70" : ""
      }`}
    >
      <Link href={`/perfumes/${perfume.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-surface-2 to-background">
          <Image
            src={productImageUrl(perfume.image)}
            alt={perfume.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-contain transition-transform duration-500 group-hover:scale-105 ${
              outOfStock ? "grayscale" : ""
            }`}
          />
          <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
            {perfume.bestSeller && (
              <span className="self-start rounded-full bg-white px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black sm:px-2.5 sm:py-1 sm:text-[10px]">
                Más vendido
              </span>
            )}
            {perfume.isNew && (
              <span className="self-start rounded-full border border-white/30 bg-black/60 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white backdrop-blur-sm sm:px-2.5 sm:py-1 sm:text-[10px]">
                Nuevo
              </span>
            )}
            {outOfStock && (
              <span className="self-start rounded-full bg-red-500/90 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white sm:px-2.5 sm:py-1 sm:text-[10px]">
                Sin stock
              </span>
            )}
          </div>
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-full border border-white/30 bg-black/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-white backdrop-blur-sm sm:px-4 sm:text-xs">
                Agotado
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        <Link href={`/perfumes/${perfume.slug}`} className="block">
          <p className="truncate text-[9px] uppercase tracking-widest text-faint sm:text-[10px]">
            {perfume.brand.name}
          </p>
          <h3 className="mt-0.5 line-clamp-2 font-serif text-[13px] leading-snug text-white sm:text-sm lg:text-base">
            {perfume.name}
          </h3>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted sm:gap-1.5 sm:text-xs">
            <span className="flex items-center gap-0.5 text-white">
              <StarIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="font-semibold">{perfume.rating.toFixed(1)}</span>
            </span>
            <span className="hidden sm:inline">({perfume.reviewCount} reseñas)</span>
            <span className="sm:hidden">({perfume.reviewCount})</span>
          </div>
        </Link>

        <div className="mt-auto pt-2">
          {outOfStock ? (
            <p className="text-xs font-semibold text-red-400 sm:text-sm">Sin stock</p>
          ) : (
            <>
              <div>
                {price50 !== null ? (
                  <>
                    <p className="text-[8px] uppercase tracking-wider text-faint sm:text-[10px]">Desde 50 ml</p>
                    <p className="text-sm font-bold text-white sm:text-base">
                      {formatARS(price50)}
                    </p>
                  </>
                ) : price !== null ? (
                  <p className="text-sm font-bold text-white sm:text-base">
                    {formatARS(price)}
                  </p>
                ) : (
                  <p className="text-xs text-faint sm:text-sm">Consultar</p>
                )}
              </div>
              {displayPrice !== null && (
                <div className="mt-0.5">
                  <p className="truncate text-[9px] font-medium text-emerald-400 sm:text-[11px]">
                    Transf: {transferPrice !== null ? formatARS(transferPrice) : "—"}
                  </p>
                  <p className="text-[9px] text-muted sm:text-[11px]">
                    3 cuotas sin interés
                  </p>
                </div>
              )}
            </>
          )}

          {!outOfStock && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={size === null || displayPrice === null}
              className={`mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg text-[11px] font-semibold transition-all sm:mt-2.5 sm:h-10 sm:rounded-xl sm:text-xs ${
                added
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-white text-black hover:bg-neutral-200 active:scale-[0.97]"
              }`}
              aria-label={`Agregar ${perfume.name} al carrito`}
            >
              {added ? (
                "Agregado ✓"
              ) : (
                <>
                  AGREGAR
                  <CartIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
