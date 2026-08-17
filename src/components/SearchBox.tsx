"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";
import { ProductImage } from "./ProductImage";
import { formatARS } from "@/lib/format";

interface SearchResult {
  slug: string;
  name: string;
  image: string;
  brand_name: string;
  price: number | null;
}

export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setValue(value);
    const q = value.trim();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as SearchResult[];
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    router.push(q ? `/perfumes?q=${encodeURIComponent(q)}` : "/perfumes");
  }

  function onBlur() {
    blurTimer.current = setTimeout(() => setFocused(false), 150);
  }

  function onResultClick(slug: string) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    router.push(`/perfumes/${slug}`);
  }

  const showDropdown = focused && value.trim().length >= 2;

  return (
    <form onSubmit={onSubmit} className="relative w-full" role="search">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={onBlur}
        placeholder="Buscar perfumes, marcas..."
        className="w-full rounded-full border border-line bg-surface py-2.5 pl-9 pr-4 text-sm text-white outline-none transition-colors placeholder:text-faint focus:border-white/40"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-background/95 shadow-2xl shadow-black/50 backdrop-blur-md">
          {loading ? (
            <p className="px-4 py-3 text-xs text-faint">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-xs text-faint">
              No se encontraron perfumes para “{value.trim()}”.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={r.slug}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onResultClick(r.slug)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-background">
                      <ProductImage
                        image={r.image}
                        alt={r.name}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{r.name}</span>
                      <span className="block text-xs text-faint">{r.brand_name}</span>
                    </span>
                    {r.price != null && (
                      <span className="shrink-0 text-xs font-medium text-gold">
                        {formatARS(r.price)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
