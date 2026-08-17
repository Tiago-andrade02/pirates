"use client";

import { useState } from "react";

export function TagPicker({
  label,
  name,
  options,
  initial,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  initial?: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial ?? [])
  );

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.has(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggle(option.value)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-white bg-white text-black"
                  : "border-line bg-background text-muted hover:border-white/40 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1.5 self-center">
            {[...selected].map((value) => (
              <input key={value} type="hidden" name={name} value={value} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
