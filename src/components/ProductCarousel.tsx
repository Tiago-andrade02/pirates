import Link from "next/link";
import { ArrowRightIcon } from "./icons";
import { ProductCard } from "./ProductCard";
import { ClientCarousel } from "./ClientCarousel";
import type { Perfume } from "@/lib/types";

interface ProductCarouselProps {
  title: string;
  kicker: string;
  href: string;
  products: Perfume[];
}

export function ProductCarousel({
  title,
  kicker,
  href,
  products,
}: ProductCarouselProps) {
  return (
    <section className="relative">
      <div className="mb-4 flex items-end justify-between gap-3 px-4 sm:mb-6 sm:px-0">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-faint sm:text-xs">
            {kicker}
          </p>
          <h2 className="mt-1.5 font-serif text-[1.5rem] leading-tight text-white sm:mt-2 sm:text-3xl lg:text-4xl">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href={href}
            className="group hidden items-center gap-2 text-sm text-muted hover:text-white sm:flex"
          >
            Ver todos
            <ArrowRightIcon className="mi-btn h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <ClientCarousel>
        {products.map((perfume) => (
          <div
            key={perfume.id}
            className="h-full w-[78%] min-w-[260px] shrink-0 snap-start sm:w-[45%] sm:min-w-[220px] lg:w-[23%] lg:min-w-[240px]"
          >
            <ProductCard perfume={perfume} />
          </div>
        ))}
      </ClientCarousel>

      <Link
        href={href}
        className="mi-btn mt-4 flex h-11 items-center justify-center rounded-full border border-line px-4 text-sm text-muted hover:border-white/40 hover:text-white sm:hidden"
      >
        Ver todos
        <ArrowRightIcon className="ml-2 h-4 w-4" />
      </Link>
    </section>
  );
}
