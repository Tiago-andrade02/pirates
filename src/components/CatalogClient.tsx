"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Brand, CatalogFilters, Perfume } from "@/lib/types";
import {
  applyCatalogFilters,
  clearFilterField,
  countActiveFilters,
  EMPTY_FILTERS,
  filtersToParams,
  parseFilters,
  setFilterValue,
  type FilterField,
} from "@/lib/catalog-filters";
import {
  AROMA_OPTIONS,
  GENDER_OPTIONS,
  OCCASION_OPTIONS,
  PRICE_RANGES,
  SEASON_OPTIONS,
  SIZE_OPTIONS,
} from "@/lib/catalog-options";
import { ProductCard } from "@/components/ProductCard";
import { FilterGroup, type FilterGroupDef } from "@/components/FilterGroup";
import { FilterDrawer } from "@/components/FilterDrawer";
import { SearchBox } from "@/components/SearchBox";
import { SortSelect } from "@/components/SortSelect";
import { SearchIcon } from "@/components/icons";

// Sincroniza el estado con la query string de la URL (deep-links: enlaces del
// home y de /marcas, búsqueda desde la navbar, botón atrás). Se aísla dentro de
// su propio <Suspense> para que el resto del catálogo —que no lee searchParams—
// se prerenderice y llegue en el HTML inicial; solo este hoja se renderiza en el
// cliente (comportamiento documentado de useSearchParams en rutas estáticas).
function SearchParamsSync({ onSync }: { onSync: (params: URLSearchParams) => void }) {
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  useEffect(() => {
    onSync(new URLSearchParams(queryString));
  }, [queryString, onSync]);
  return null;
}

export function CatalogClient({
  perfumes,
  brands,
}: {
  perfumes: Perfume[];
  brands: Brand[];
}) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);

  // Refleja el estado en la barra de direcciones sin navegar ni volver al
  // servidor (replaceState): la URL queda compartible y no genera una petición.
  const syncUrl = useCallback((next: CatalogFilters) => {
    const qs = filtersToParams(next);
    window.history.replaceState(null, "", qs ? `/perfumes?${qs}` : "/perfumes");
  }, []);

  const syncFromUrl = useCallback((params: URLSearchParams) => {
    setFilters(parseFilters(params));
  }, []);

  const select = useCallback(
    (field: FilterField, value: string) => {
      const next = setFilterValue(filters, field, value);
      setFilters(next);
      syncUrl(next);
    },
    [filters, syncUrl]
  );

  const clearGroup = useCallback(
    (field: FilterField) => {
      const next = clearFilterField(filters, field);
      setFilters(next);
      syncUrl(next);
    },
    [filters, syncUrl]
  );

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    window.history.replaceState(null, "", "/perfumes");
  }, []);

  const setQuery = useCallback(
    (value: string) => {
      const next = { ...filters, q: value.trim() ? value : null };
      setFilters(next);
      syncUrl(next);
    },
    [filters, syncUrl]
  );

  const setOrder = useCallback(
    (value: string) => {
      const next = { ...filters, order: value ? value : null };
      setFilters(next);
      syncUrl(next);
    },
    [filters, syncUrl]
  );

  const visible = useMemo(
    () => applyCatalogFilters(perfumes, filters),
    [perfumes, filters]
  );
  const activeCount = countActiveFilters(filters);

  const groups: FilterGroupDef[] = [
    {
      label: "Marca",
      field: "brands",
      allowClear: true,
      options: brands.map((brand) => ({
        value: brand.slug,
        label: brand.name,
        active: filters.brands.includes(brand.slug),
      })),
    },
    {
      label: "Tamaño",
      field: "size",
      allowClear: true,
      options: SIZE_OPTIONS.map((size) => ({
        value: size,
        label: `${size} ml`,
        active: filters.size === size,
      })),
    },
    {
      label: "Precio",
      field: "priceRange",
      allowClear: true,
      options: PRICE_RANGES.map((range) => ({
        value: range.key,
        label: range.label,
        active: filters.priceRange === range.key,
      })),
    },
    {
      label: "Tipo",
      field: "gender",
      allowClear: true,
      options: GENDER_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        active: filters.gender === option.value,
      })),
    },
    {
      label: "Aroma",
      field: "aroma",
      allowClear: true,
      options: AROMA_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        active: filters.aroma === option.value,
      })),
    },
    {
      label: "Estación",
      field: "season",
      allowClear: true,
      options: SEASON_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        active: filters.season === option.value,
      })),
    },
    {
      label: "Ocasión",
      field: "occasion",
      allowClear: true,
      options: OCCASION_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        active: filters.occasion === option.value,
      })),
    },
    {
      label: "Novedades",
      field: "onlyNew",
      options: [
        { value: "1", label: "Recién llegados", active: filters.onlyNew },
      ],
    },
    {
      label: "Más vendidos",
      field: "onlyBestSellers",
      options: [
        { value: "1", label: "Los favoritos", active: filters.onlyBestSellers },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <Suspense fallback={null}>
        <SearchParamsSync onSync={syncFromUrl} />
      </Suspense>

      <header className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-serif text-2xl text-white sm:text-3xl lg:text-5xl">
            Perfumes
          </h1>
          <p className="mt-1 text-xs text-muted sm:mt-1.5 sm:text-sm">
            {visible.length}{" "}
            {visible.length === 1 ? "perfume encontrado" : "perfumes encontrados"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <div className="w-full sm:w-72">
            <SearchBox value={filters.q ?? ""} onChange={setQuery} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="mi-btn h-11 rounded-full border border-line px-4 text-xs text-muted hover:border-white/40 hover:text-white"
              >
                Limpiar ({activeCount})
              </button>
            )}
            <FilterDrawer
              groups={groups}
              activeCount={activeCount}
              onSelect={(field, value) => select(field as FilterField, value)}
              onClearGroup={(field) => clearGroup(field as FilterField)}
              onClearAll={clearAll}
            />
            <SortSelect value={filters.order ?? ""} onChange={setOrder} />
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
          <button
            type="button"
            onClick={() => setQuery("")}
            className="shrink-0 text-xs text-faint transition-colors hover:text-white sm:text-sm"
          >
            Quitar
          </button>
        </div>
      )}

      <div className="mt-3 grid gap-4 sm:mt-5 sm:gap-6 lg:grid-cols-[240px_1fr] lg:mt-8 lg:gap-10">
        <aside className="hidden lg:block">
          {groups.map((group) => (
            <FilterGroup
              key={group.label}
              label={group.label}
              options={group.options}
              allowClear={group.allowClear}
              onSelect={(value) => select(group.field as FilterField, value)}
              onClear={() => clearGroup(group.field as FilterField)}
            />
          ))}
        </aside>

        <div>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-4 py-14 text-center sm:px-6 sm:py-24">
              <p className="font-serif text-xl text-white sm:text-2xl">
                No encontramos perfumes
              </p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted sm:mt-3 sm:text-sm">
                Probá quitar alguno de los filtros aplicados o buscá otra
                combinación.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="mi-btn mi-shine mt-5 inline-flex h-11 items-center rounded-full bg-white px-6 text-sm font-semibold text-black sm:mt-6"
              >
                Ver todo el catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4 lg:gap-5">
              {visible.map((perfume) => (
                <ProductCard key={perfume.id} perfume={perfume} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
