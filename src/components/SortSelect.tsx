"use client";

const OPTIONS = [
  { value: "", label: "Recomendados" },
  { value: "ventas", label: "Más vendidos" },
  { value: "novedad", label: "Novedades" },
  { value: "rating", label: "Mejor valorados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
];

export function SortSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-0 rounded-full border border-line bg-surface px-3 text-xs text-white outline-none transition-colors focus:border-white/40 sm:shrink-0 sm:px-4 sm:text-sm"
      aria-label="Ordenar productos"
    >
      {OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
