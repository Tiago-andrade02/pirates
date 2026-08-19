import type { Metadata } from "next";
import Link from "next/link";
import { getBrandsWithCounts } from "@/lib/data";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marcas",
  description:
    "Todas las marcas árabes que importamos: Lattafa, Afnan, Armaf, Maison Alhambra, Fragrance World, French Avenue y más.",
};

export default async function BrandsPage() {
  const brands = await getBrandsWithCounts();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-faint">Casas que importamos</p>
        <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">Marcas</h1>
        <p className="mt-4 leading-relaxed text-muted">
          Trabajamos con las casas de perfumería árabe más prestigiosas del
          mundo, importadas directo del fabricante y en alta calidad.
        </p>
      </header>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {brands.map((brand) => (
          <Link
            key={brand.id}
            href={`/perfumes?marca=${brand.slug}`}
            className="group flex flex-col rounded-2xl border border-line bg-surface p-7 transition-all hover:border-white/30 hover:bg-surface-2"
          >
            <div className="flex items-start justify-between">
              <h2 className="font-serif text-2xl text-white">{brand.name}</h2>
              <span className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                {brand.country}
              </span>
            </div>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">
              {brand.description}
            </p>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-faint">
                {brand.count} {brand.count === 1 ? "perfume" : "perfumes"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                Explorar
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
