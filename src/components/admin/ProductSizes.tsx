"use client";

import { useState } from "react";

const SIZES = [
  { key: "30", label: "30 ml" },
  { key: "50", label: "50 ml" },
  { key: "100", label: "100 ml" },
];

const inputCls =
  "w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder:text-faint focus:border-gold focus:outline-none";

const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-faint";

export function ProductSizes({
  initial,
  initialStock,
}: {
  initial: Record<string, number | null>;
  initialStock: Record<string, number>;
}) {
  const [available, setAvailable] = useState<Record<string, boolean>>(() => {
    const hasAny = SIZES.some((s) => initial[s.key] != null);
    return {
      "30": initial["30"] != null,
      "50": initial["50"] != null,
      "100": hasAny ? initial["100"] != null : true,
    };
  });

  function toggle(key: string, checked: boolean) {
    setAvailable((prev) => ({ ...prev, [key]: checked }));
  }

  return (
    <div className="sm:col-span-2">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
        Formatos disponibles
      </span>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SIZES.map((size) => {
          const isAvailable = available[size.key];
          return (
            <div
              key={size.key}
              className={`rounded-xl border p-4 transition-colors ${
                isAvailable
                  ? "border-gold/40 bg-gold/5"
                  : "border-line bg-background opacity-60"
              }`}
            >
              <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
                <span className="font-medium text-white">{size.label}</span>
                <input
                  type="checkbox"
                  name={`size_${size.key}`}
                  checked={isAvailable}
                  onChange={(e) => toggle(size.key, e.target.checked)}
                  className="h-4 w-4 accent-[#c9a05f]"
                />
              </label>
              {isAvailable && (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className={labelCls}>Precio</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      name={`price_${size.key}`}
                      defaultValue={initial[size.key] ?? ""}
                      placeholder="—"
                      className={inputCls}
                    />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Stock</span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      name={`stock_${size.key}`}
                      defaultValue={initialStock[size.key] ?? 0}
                      className={inputCls}
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-faint">
        Marcá los formatos en los que se vende el perfume. Solo se muestran en la
        tienda los formatos que tienen precio.
      </p>
    </div>
  );
}
