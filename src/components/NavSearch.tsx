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

export function NavSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

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

  function close() {
    setOpen(false);
    setValue("");
    setResults([]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    close();
    router.push(q ? `/perfumes?q=${encodeURIComponent(q)}` : "/perfumes");
  }

  function onBlur() {
    blurTimer.current = setTimeout(() => setFocused(false), 150);
  }

  function onResultClick() {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    close();
  }

  const showDropdown = open && focused && value.trim().length >= 2;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Buscar"
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm sm:w-96">
          <form
            onSubmit={onSubmit}
            className="relative overflow-hidden rounded-2xl border border-line bg-background/95 shadow-2xl shadow-black/50 backdrop-blur-md"
          >
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={onBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
              }}
              placeholder="Buscar perfumes, marcas..."
              className="w-full bg-transparent py-3.5 pl-11 pr-4 text-sm text-white outline-none placeholder:text-faint"
            />
          </form>

          {showDropdown && (
            <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-background/95 shadow-2xl shadow-black/50 backdrop-blur-md">
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
                        onClick={() => {
                          onResultClick();
                          router.push(`/perfumes/${r.slug}`);
                        }}
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
        </div>
      )}
    </div>
  );
}
