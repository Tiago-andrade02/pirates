import Link from "next/link";
import Image from "next/image";
import type { Perfume } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { StarIcon } from "./icons";

function referencePrice(p: Perfume): number | null {
  return p.prices["50"] ?? p.prices["100"] ?? p.prices["30"];
}

export function ProductCard({ perfume }: { perfume: Perfume }) {
  const price = referencePrice(perfume);
  const price50 = perfume.prices["50"];
  const displayPrice = price50 ?? price;
  const transferPrice = displayPrice !== null ? Math.round(displayPrice * 0.9) : null;
  const installment = displayPrice !== null ? Math.round(displayPrice / 3) : null;
  const outOfStock = perfume.stock <= 0;

  return (
    <Link
      href={`/perfumes/${perfume.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all hover:border-white/25 hover:bg-surface-2 ${
        outOfStock ? "opacity-70" : ""
      }`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-b from-surface-2 to-background">
        <Image
          src={productImageUrl(perfume.image)}
          alt={perfume.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
            outOfStock ? "grayscale" : ""
          }`}
        />
        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {perfume.bestSeller && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black">
              Más vendido
            </span>
          )}
          {perfume.isNew && (
            <span className="rounded-full border border-white/30 bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              Nuevo
            </span>
          )}
          {outOfStock && (
            <span className="rounded-full bg-red-500/90 px-2.5 py-1 text-[11px] font-semibold text-white">
              Sin stock
            </span>
          )}
        </div>
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full border border-white/30 bg-black/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white backdrop-blur-sm">
              Agotado
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:gap-2 sm:p-4">
        <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
          {perfume.brand.name}
        </p>
        <h3 className="font-serif text-sm leading-snug text-white sm:text-lg">
          {perfume.name}
        </h3>
        <div className="hidden items-center gap-1.5 text-xs text-muted sm:flex">
          <span className="flex items-center gap-0.5 text-white">
            <StarIcon className="h-3.5 w-3.5 text-white" />
            <span className="font-semibold">{perfume.rating.toFixed(1)}</span>
          </span>
          <span>({perfume.reviewCount} reseñas)</span>
        </div>
        <div className="mt-auto pt-1.5 sm:pt-2">
          {outOfStock ? (
            <p className="text-xs font-semibold text-red-400 sm:text-sm">Sin stock</p>
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  {price50 !== null ? (
                    <>
                      <p className="text-[10px] text-faint sm:text-[11px]">Desde 50 ml</p>
                      <p className="text-xs font-semibold text-white sm:text-base">
                        {formatARS(price50)}
                      </p>
                    </>
                  ) : price !== null ? (
                    <p className="text-xs font-semibold text-white sm:text-base">
                      {formatARS(price)}
                    </p>
                  ) : (
                    <p className="text-xs text-faint sm:text-sm">Consultar</p>
                  )}
                </div>
              </div>
              {displayPrice !== null && (
                <div className="mt-0.5 space-y-0 sm:mt-1.5">
                  <p className="text-[10px] font-medium text-emerald-400 sm:text-xs">
                    Transferencia: {transferPrice !== null ? formatARS(transferPrice) : "—"}
                  </p>
                  <p className="hidden text-xs text-muted sm:block">
                    3 cuotas sin interés de{" "}
                    {installment !== null ? formatARS(installment) : "—"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
