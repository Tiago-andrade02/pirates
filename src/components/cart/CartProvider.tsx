"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type SizeKey = "30" | "50" | "100";

export interface CartItem {
  slug: string;
  size: SizeKey;
  name: string;
  brandName: string;
  price: number;
  qty: number;
  image: string;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "qty"> & { qty?: number }) => void;
  removeItem: (slug: string, size: SizeKey) => void;
  setQty: (slug: string, size: SizeKey, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "pirates-cart";

const EMPTY_ITEMS: CartItem[] = [];
let items: CartItem[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CartItem[];
      if (Array.isArray(parsed)) items = parsed;
    }
  } catch {
    // ignore
  }
}

function emit() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CartItem[] {
  ensureLoaded();
  return items;
}

function getServerSnapshot(): CartItem[] {
  return EMPTY_ITEMS;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback(
    (item: Omit<CartItem, "qty"> & { qty?: number }) => {
      ensureLoaded();
      const existing = items.find(
        (i) => i.slug === item.slug && i.size === item.size
      );
      if (existing) {
        items = items.map((i) =>
          i.slug === item.slug && i.size === item.size
            ? { ...i, qty: i.qty + (item.qty ?? 1) }
            : i
        );
      } else {
        items = [...items, { ...item, qty: item.qty ?? 1 }];
      }
      emit();
    },
    []
  );

  const removeItem = useCallback((slug: string, size: SizeKey) => {
    ensureLoaded();
    items = items.filter((i) => !(i.slug === slug && i.size === size));
    emit();
  }, []);

  const setQty = useCallback((slug: string, size: SizeKey, qty: number) => {
    ensureLoaded();
    items =
      qty <= 0
        ? items.filter((i) => !(i.slug === slug && i.size === size))
        : items.map((i) =>
            i.slug === slug && i.size === size ? { ...i, qty } : i
          );
    emit();
  }, []);

  const clear = useCallback(() => {
    items = [];
    emit();
  }, []);

  const count = snapshot.reduce((acc, i) => acc + i.qty, 0);
  const subtotal = snapshot.reduce((acc, i) => acc + i.price * i.qty, 0);

  const value: CartContextValue = {
    items: snapshot,
    addItem,
    removeItem,
    setQty,
    clear,
    count,
    subtotal,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart debe usarse dentro de CartProvider");
  }
  return context;
}
