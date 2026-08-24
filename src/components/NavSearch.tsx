"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { SearchIcon, CloseIcon } from "./icons";
import { ProductImage } from "./ProductImage";
import { formatARS } from "@/lib/format";

interface SearchResult {
  slug: string;
  name: string;
  image: string;
  brand_name: string;
  price: number | null;
}

interface NavSearchProps {
  mobileOpen: boolean;
  onMobileOpen: () => void;
  onMobileClose: () => void;
}

export function NavSearch({
  mobileOpen,
  onMobileOpen,
  onMobileClose,
}: NavSearchProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      const id = setTimeout(() => mobileInputRef.current?.focus(), 120);
      return () => clearTimeout(id);
    }
  }, [mobileOpen]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setValue(val);
    const q = val.trim();
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

  function closeMobile() {
    setValue("");
    setResults([]);
    setLoading(false);
    setFocused(false);
    onMobileClose();
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = value.trim();
    const isMobile = mobileOpen;
    setValue("");
    setResults([]);
    setLoading(false);
    setFocused(false);
    if (isMobile) onMobileClose();
    router.push(q ? `/perfumes?q=${encodeURIComponent(q)}` : "/perfumes");
  }

  function onBlur() {
    blurTimer.current = setTimeout(() => setFocused(false), 150);
  }

  function onResultClick(slug: string) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    closeMobile();
    router.push(`/perfumes/${slug}`);
  }

  const showDropdown = focused && value.trim().length >= 2;

  const dropdown = showDropdown ? (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-background/95 shadow-2xl shadow-black/50 backdrop-blur-md">
      {loading ? (
        <p className="px-4 py-3 text-xs text-faint">Buscando…</p>
      ) : results.length === 0 ? (
        <p className="px-4 py-3 text-xs text-faint">
          No se encontraron perfumes para &ldquo;{value.trim()}&rdquo;.
        </p>
      ) : (
        <ul className="max-h-80 overflow-y-auto py-1">
          {results.map((r) => (
            <li key={r.slug}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onResultClick(r.slug)}
                className="mi-btn flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2"
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-background">
                  <ProductImage
                    image={r.image}
                    alt={r.name}
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {r.name}
                  </span>
                  <span className="block text-xs text-faint">
                    {r.brand_name}
                  </span>
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
  ) : null;

  return (
    <>
      <div className="relative hidden md:block">
        <form onSubmit={onSubmit} role="search">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            ref={desktopInputRef}
            type="search"
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setValue("");
                setResults([]);
                setFocused(false);
                desktopInputRef.current?.blur();
              }
            }}
            placeholder="Buscar perfumes o marcas..."
            className="mi-search w-[160px] rounded-full border border-line bg-surface py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-faint focus:border-white/40 focus:w-[260px] lg:w-[200px] lg:focus:w-[260px]"
            aria-label="Buscar perfumes o marcas"
          />
        </form>
        {dropdown}
      </div>

      <button
        type="button"
        onClick={mobileOpen ? closeMobile : onMobileOpen}
        aria-label="Buscar"
        aria-expanded={mobileOpen}
        className="mi-btn inline-flex h-9 w-9 items-center justify-center rounded-full text-muted md:hidden"
      >
        {mobileOpen ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <SearchIcon className="h-5 w-5" />
        )}
      </button>

      {mobileOpen && mounted && createPortal(
        <div className="fixed inset-x-0 top-[56px] z-50 animate-slide-down border-b border-line bg-background px-4 py-3 backdrop-blur-md sm:top-[60px] md:hidden">
          <form onSubmit={onSubmit} className="relative" role="search">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input
              ref={mobileInputRef}
              type="search"
              value={value}
              onChange={handleChange}
              onFocus={() => setFocused(true)}
              onBlur={onBlur}
              onKeyDown={(e) => {
                if (e.key === "Escape") closeMobile();
              }}
              placeholder="Buscar perfumes o marcas..."
              className="mi-search w-full rounded-full border border-line bg-surface py-2.5 pl-9 pr-10 text-sm text-white outline-none placeholder:text-faint focus:border-white/40"
              aria-label="Buscar perfumes o marcas"
            />
            <button
              type="button"
              onClick={closeMobile}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-white"
              aria-label="Cerrar búsqueda"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </form>
          {dropdown}
        </div>,
        document.body,
      )}
    </>
  );
}
