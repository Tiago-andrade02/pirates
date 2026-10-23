"use client";

import { useState, useEffect } from "react";
import { CloseIcon, FilterIcon } from "./icons";
import { FilterGroup, type FilterGroupDef } from "./FilterGroup";

interface FilterDrawerProps {
  groups: FilterGroupDef[];
  activeCount: number;
  onSelect: (field: string, value: string) => void;
  onClearGroup: (field: string) => void;
  onClearAll: () => void;
}

export function FilterDrawer({
  groups,
  activeCount,
  onSelect,
  onClearGroup,
  onClearAll,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mi-btn mi-shine inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-medium text-white sm:text-sm lg:hidden"
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
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="animate-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-slide-in-right absolute inset-y-0 right-0 flex h-full w-[85%] max-w-sm flex-col border-l border-line bg-background shadow-2xl shadow-black/50">
            <div className="flex h-14 items-center justify-between border-b border-line px-5 sm:h-16">
              <h2 className="font-serif text-lg text-white">Filtros</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mi-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:text-white"
                aria-label="Cerrar filtros"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
              {groups.map((group) => (
                <FilterGroup
                  key={group.label}
                  label={group.label}
                  options={group.options}
                  allowClear={group.allowClear}
                  onSelect={(value) => onSelect(group.field, value)}
                  onClear={() => onClearGroup(group.field)}
                />
              ))}
            </div>

            <div className="flex gap-3 border-t border-line px-5 py-4">
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="mi-btn flex h-11 flex-1 items-center justify-center rounded-full border border-line text-sm text-muted hover:border-white/40 hover:text-white"
                >
                  Limpiar ({activeCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mi-btn mi-shine flex h-11 flex-1 items-center justify-center rounded-full bg-white text-sm font-semibold text-black"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
