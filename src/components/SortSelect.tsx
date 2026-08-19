"use client";

import { useRouter } from "next/navigation";

const OPTIONS = [
  { value: "", label: "Destacados" },
  { value: "rating", label: "Mejor puntuados" },
  { value: "precio-asc", label: "Precio: menor a mayor" },
  { value: "precio-desc", label: "Precio: mayor a menor" },
  { value: "nombre", label: "Nombre A-Z" },
];

export function SortSelect({
  baseParams,
  current,
}: {
  baseParams: string;
  current: string;
}) {
  const router = useRouter();

  function onChange(value: string) {
    const params = new URLSearchParams(baseParams);
    if (value) {
      params.set("orden", value);
    } else {
      params.delete("orden");
    }
    const qs = params.toString();
    router.push(qs ? `/perfumes?${qs}` : "/perfumes");
  }

  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 shrink-0 rounded-full border border-line bg-surface px-3 text-xs text-white outline-none transition-colors focus:border-white/40 sm:px-4 sm:text-sm"
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
