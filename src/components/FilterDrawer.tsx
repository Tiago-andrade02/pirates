"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, FilterIcon } from "./icons";
import { FilterGroup, type FilterOption } from "./FilterGroup";

interface FilterDrawerProps {
  brandOptions: FilterOption[];
  sizeOptions: FilterOption[];
  priceOptions: FilterOption[];
  genderOptions: FilterOption[];
  aromaOptions: FilterOption[];
  seasonOptions: FilterOption[];
  occasionOptions: FilterOption[];
  extraGroups: { label: string; options: FilterOption[] }[];
  activeCount: number;
}

export function FilterDrawer({
  brandOptions,
  sizeOptions,
  priceOptions,
  genderOptions,
  aromaOptions,
  seasonOptions,
  occasionOptions,
  extraGroups,
  activeCount,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-medium text-white transition-colors hover:border-white/40 sm:text-sm lg:hidden"
      >
        <FilterIcon className="h-4 w-4" />
        FILTRAR
        {activeCount > 0 && (
          <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-black">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-slide-in-right absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col border-l border-line bg-background">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-serif text-lg text-white">Filtros</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white"
                aria-label="Cerrar filtros"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              <FilterGroup label="Marca" options={brandOptions} allowClear />
              <FilterGroup label="Tamaño" options={sizeOptions} allowClear />
              <FilterGroup label="Precio" options={priceOptions} allowClear />
              <FilterGroup label="Tipo" options={genderOptions} allowClear />
              <FilterGroup label="Aroma" options={aromaOptions} allowClear />
              <FilterGroup label="Estación" options={seasonOptions} allowClear />
              <FilterGroup label="Ocasión" options={occasionOptions} allowClear />
              {extraGroups.map((group) => (
                <FilterGroup
                  key={group.label}
                  label={group.label}
                  options={group.options}
                />
              ))}
            </div>

            <div className="border-t border-line px-5 py-4">
              {activeCount > 0 ? (
                <Link
                  href="/perfumes"
                  onClick={() => setOpen(false)}
                  className="flex h-11 items-center justify-center rounded-full border border-line text-sm text-muted transition-colors hover:border-white/40 hover:text-white"
                >
                  Limpiar filtros ({activeCount})
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
                >
                  Aplicar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
