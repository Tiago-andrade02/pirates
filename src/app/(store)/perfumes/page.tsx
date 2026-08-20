import type { Metadata } from "next";
import Link from "next/link";
import {
  AROMA_OPTIONS,
  GENDER_OPTIONS,
  getBrands,
  getCatalog,
  OCCASION_OPTIONS,
  PRICE_RANGES,
  SEASON_OPTIONS,
  SIZE_OPTIONS,
} from "@/lib/data";
import type { CatalogFilters } from "@/lib/types";
import { ProductCard } from "@/components/ProductCard";
import { FilterGroup } from "@/components/FilterGroup";
import { SearchBox } from "@/components/SearchBox";
import { SortSelect } from "@/components/SortSelect";
import { SearchIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Catálogo de Perfumes",
  description:
    "Explorá nuestro catálogo de perfumes árabes e importados de alta calidad. Filtrá por marca, tamaño, aroma, estación y ocasión.",
};

function parseFilters(
  params: URLSearchParams
): { filters: CatalogFilters; baseParams: string } {
  const brands = params.getAll("marca");
  const baseParams = params.toString();
  return {
    baseParams,
    filters: {
      brands,
      size: params.get("talla"),
      priceRange: params.get("precio"),
      gender: params.get("tipo"),
      aroma: params.get("aroma"),
      season: params.get("temporada"),
      occasion: params.get("ocasion"),
      onlyNew: params.get("novedad") === "1",
      onlyBestSellers: params.get("destacados") === "1",
      q: params.get("q"),
      order: params.get("orden"),
    },
  };
}

function buildParams(
  base: URLSearchParams,
  changes: Record<string, string | string[] | null>
): string {
  const params = new URLSearchParams(base);
  for (const [key, value] of Object.entries(changes)) {
    params.delete(key);
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else if (value !== null) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `/perfumes?${qs}` : "/perfumes";
}

interface CatalogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CatalogPage(props: CatalogPageProps) {
  const searchParams = await props.searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, v);
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }

  const { filters, baseParams } = parseFilters(params);
  const perfumes = await getCatalog(filters);
  const brands = await getBrands();

  const brandOptions = brands.map((brand) => ({
    value: brand.slug,
    label: brand.name,
    href: buildParams(params, {
      marca: filters.brands.includes(brand.slug)
        ? filters.brands.filter((b) => b !== brand.slug)
        : [...filters.brands, brand.slug],
    }),
    active: filters.brands.includes(brand.slug),
  }));

  const sizeOptions = SIZE_OPTIONS.map((size) => ({
    value: size,
    label: `${size} ml`,
    href: buildParams(params, {
      talla: filters.size === size ? null : size,
    }),
    active: filters.size === size,
  }));

  const priceOptions = PRICE_RANGES.map((range) => ({
    value: range.key,
    label: range.label,
    href: buildParams(params, {
      precio: filters.priceRange === range.key ? null : range.key,
    }),
    active: filters.priceRange === range.key,
  }));

  const genderOptions = GENDER_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    href: buildParams(params, {
      tipo: filters.gender === option.value ? null : option.value,
    }),
    active: filters.gender === option.value,
  }));

  const aromaOptions = AROMA_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    href: buildParams(params, {
      aroma: filters.aroma === option.value ? null : option.value,
    }),
    active: filters.aroma === option.value,
  }));

  const seasonOptions = SEASON_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    href: buildParams(params, {
      temporada: filters.season === option.value ? null : option.value,
    }),
    active: filters.season === option.value,
  }));

  const occasionOptions = OCCASION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
    href: buildParams(params, {
      ocasion: filters.occasion === option.value ? null : option.value,
    }),
    active: filters.occasion === option.value,
  }));

  const extraGroups = [
    {
      label: "Novedades",
      options: [
        {
          value: "novedad",
          label: "Recién llegados",
          href: buildParams(params, {
            novedad: filters.onlyNew ? null : "1",
          }),
          active: filters.onlyNew,
        },
      ],
    },
    {
      label: "Más vendidos",
      options: [
        {
          value: "destacados",
          label: "Los favoritos",
          href: buildParams(params, {
            destacados: filters.onlyBestSellers ? null : "1",
          }),
          active: filters.onlyBestSellers,
        },
      ],
    },
  ];

  const activeCount =
    filters.brands.length +
    (filters.size ? 1 : 0) +
    (filters.priceRange ? 1 : 0) +
    (filters.gender ? 1 : 0) +
    (filters.aroma ? 1 : 0) +
    (filters.season ? 1 : 0) +
    (filters.occasion ? 1 : 0) +
    (filters.onlyNew ? 1 : 0) +
    (filters.onlyBestSellers ? 1 : 0);

  const hasFilters = activeCount > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-10 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-faint sm:text-xs">
            Catálogo
          </p>
          <h1 className="mt-1.5 font-serif text-[1.5rem] text-white sm:mt-2 sm:text-3xl lg:text-5xl">
            Perfumes
          </h1>
          <p className="mt-1 text-xs text-muted sm:mt-2 sm:text-sm">
            {perfumes.length}{" "}
            {perfumes.length === 1 ? "perfume encontrado" : "perfumes encontrados"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="w-full sm:w-72">
            <SearchBox />
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Link
                href="/perfumes"
                className="h-10 shrink-0 rounded-full border border-line px-4 text-xs text-muted transition-colors hover:border-white/40 hover:text-white"
              >
                Limpiar ({activeCount})
              </Link>
            )}
            <SortSelect baseParams={baseParams} current={filters.order ?? ""} />
          </div>
        </div>
      </header>

      {filters.q && (
        <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-3.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-faint" />
          <p className="min-w-0 flex-1 text-xs text-muted sm:text-sm">
            Resultados para{" "}
            <span className="font-semibold text-white">&ldquo;{filters.q}&rdquo;</span>
          </p>
          <Link
            href="/perfumes"
            className="shrink-0 text-xs text-faint transition-colors hover:text-white sm:text-sm"
          >
            Quitar
          </Link>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:mt-7 sm:gap-6 lg:grid-cols-[240px_1fr] lg:mt-10 lg:gap-10">
        <aside className="hidden lg:block">
          <FilterGroup label="Marca" options={brandOptions} allowClear />
          <FilterGroup label="Tamaño" options={sizeOptions} allowClear />
          <FilterGroup label="Precio" options={priceOptions} allowClear />
          <FilterGroup label="Tipo" options={genderOptions} allowClear />
          <FilterGroup label="Aroma" options={aromaOptions} allowClear />
          <FilterGroup label="Estación" options={seasonOptions} allowClear />
          <FilterGroup label="Ocasión" options={occasionOptions} allowClear />
          {extraGroups.map((group) => (
            <FilterGroup key={group.label} label={group.label} options={group.options} />
          ))}
        </aside>

        <div>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-2 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ...brandOptions.slice(0, 6),
              ...sizeOptions,
              ...priceOptions,
              ...genderOptions,
              ...aromaOptions,
              ...seasonOptions,
              ...occasionOptions,
            ].map((option) => (
              <Link
                key={option.value + option.label}
                href={option.href}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  option.active
                    ? "border-white bg-white font-medium text-black"
                    : "border-line bg-surface text-muted hover:text-white"
                }`}
              >
                {option.label}
              </Link>
            ))}
          </div>

          {perfumes.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-4 py-14 text-center sm:px-6 sm:py-24">
              <p className="font-serif text-xl text-white sm:text-2xl">
                No encontramos perfumes
              </p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted sm:mt-3 sm:text-sm">
                Probá quitar alguno de los filtros aplicados o buscá otra
                combinación.
              </p>
              <Link
                href="/perfumes"
                className="mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-black transition-colors hover:bg-neutral-200 sm:mt-6"
              >
                Ver todo el catálogo
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:gap-6">
              {perfumes.map((perfume) => (
                <ProductCard key={perfume.id} perfume={perfume} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
