"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { CartIcon } from "../icons";

export function CartBadge() {
  const { count } = useCart();
  return (
    <Link
      href="/carrito"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white"
      aria-label="Carrito de compras"
    >
      <CartIcon className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-black">
          {count}
        </span>
      )}
    </Link>
  );
}
