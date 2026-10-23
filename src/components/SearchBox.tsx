"use client";

import { SearchIcon } from "./icons";

// Búsqueda del catálogo: controlada y sin red. El listado se filtra en vivo
// (CatalogClient) sobre los datos que ya vienen prerenderizados, así no hay
// petición por tecla ni ejecución de función en el servidor.
export function SearchBox({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative w-full" role="search">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar perfumes, marcas..."
        aria-label="Buscar en el catálogo"
        className="w-full rounded-full border border-line bg-surface py-2.5 pl-9 pr-4 text-sm text-white outline-none transition-colors placeholder:text-faint focus:border-white/40"
      />
    </div>
  );
}
