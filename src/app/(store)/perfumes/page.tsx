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
  const perfumes = getCatalog(filters);
  const brands = getBrands();

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
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-faint">
            Catálogo
          </p>
          <h1 className="mt-2 font-serif text-4xl text-white sm:text-5xl">
            Perfumes
          </h1>
          <p className="mt-3 text-sm text-muted">
            {perfumes.length}{" "}
            {perfumes.length === 1 ? "perfume encontrado" : "perfumes encontrados"}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div className="w-full min-w-[240px] sm:w-72">
            <SearchBox />
          </div>
          {hasFilters && (
            <Link
              href="/perfumes"
              className="h-10 rounded-full border border-line px-5 text-sm text-muted transition-colors hover:border-white/40 hover:text-white"
            >
              Limpiar filtros ({activeCount})
            </Link>
          )}
          <SortSelect baseParams={baseParams} current={filters.order ?? ""} />
        </div>
      </header>

      {filters.q && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <SearchIcon className="h-4 w-4 text-faint" />
          <p className="flex-1 text-sm text-muted">
            Resultados para{" "}
            <span className="font-semibold text-white">“{filters.q}”</span>
          </p>
          <Link
            href="/perfumes"
            className="text-sm text-faint transition-colors hover:text-white"
          >
            Quitar búsqueda
          </Link>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <FilterGroup
            label="Marca"
            options={brandOptions}
            allowClear
          />
          <FilterGroup
            label="Tamaño"
            options={sizeOptions}
            allowClear
          />
          <FilterGroup
            label="Precio"
            options={priceOptions}
            allowClear
          />
          <FilterGroup
            label="Tipo"
            options={genderOptions}
            allowClear
          />
          <FilterGroup
            label="Aroma"
            options={aromaOptions}
            allowClear
          />
          <FilterGroup
            label="Estación"
            options={seasonOptions}
            allowClear
          />
          <FilterGroup
            label="Ocasión"
            options={occasionOptions}
            allowClear
          />
          {extraGroups.map((group) => (
            <FilterGroup key={group.label} label={group.label} options={group.options} />
          ))}
        </aside>

        <div>
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              ...brandOptions,
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
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
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
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-24 text-center">
              <p className="font-serif text-2xl text-white">
                No encontramos perfumes
              </p>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                Probá quitar alguno de los filtros aplicados o buscá otra
                combinación.
              </p>
              <Link
                href="/perfumes"
                className="mt-6 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
              >
                Ver todo el catálogo
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
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
