"use client";

export interface FilterOption {
  value: string;
  label: string;
  active: boolean;
}

// Definición de un grupo de filtros, tal como la arma el catálogo. `field`
// indica qué filtro del estado toca cada opción (ver FilterField).
export interface FilterGroupDef {
  label: string;
  field: string;
  options: FilterOption[];
  allowClear?: boolean;
}

export function FilterGroup({
  label,
  options,
  allowClear,
  onSelect,
  onClear,
}: {
  label: string;
  options: FilterOption[];
  allowClear?: boolean;
  onSelect: (value: string) => void;
  onClear?: () => void;
}) {
  const anyActive = options.some((o) => o.active);
  return (
    <div className="border-b border-line py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white">
          {label}
        </h3>
        {anyActive && allowClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-faint transition-colors hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={option.active}
            className={`mi-chip rounded-full border px-3.5 py-1.5 text-sm ${
              option.active
                ? "border-white bg-white font-medium text-black"
                : "border-line bg-surface text-muted hover:border-white/40 hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
