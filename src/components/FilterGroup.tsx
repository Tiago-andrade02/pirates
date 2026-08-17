import Link from "next/link";

export interface FilterOption {
  value: string;
  label: string;
  href: string;
  active: boolean;
}

export function FilterGroup({
  label,
  options,
  allowClear,
}: {
  label: string;
  options: FilterOption[];
  allowClear?: boolean;
}) {
  const anyActive = options.some((o) => o.active);
  return (
    <div className="border-b border-line py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-white">
          {label}
        </h3>
        {anyActive && allowClear && (
          <Link
            href={options.find((o) => o.active)?.href ?? ""}
            className="text-xs text-faint transition-colors hover:text-white"
          >
            Limpiar
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Link
            key={option.value}
            href={option.href}
            aria-current={option.active ? "true" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              option.active
                ? "border-white bg-white font-medium text-black"
                : "border-line bg-surface text-muted hover:border-white/40 hover:text-white"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
