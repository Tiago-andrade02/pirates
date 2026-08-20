"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { CartIcon } from "../icons";

export function CartBadge() {
  const { count } = useCart();
  const [bouncing, setBouncing] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (count > prevCount.current) {
      setBouncing(true);
      const id = setTimeout(() => setBouncing(false), 350);
      prevCount.current = count;
      return () => clearTimeout(id);
    }
    prevCount.current = count;
  }, [count]);

  return (
    <Link
      href="/carrito"
      className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white"
      aria-label="Carrito de compras"
    >
      <CartIcon className="h-5 w-5" />
      {count > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-black ${
            bouncing ? "mi-cart-bounce" : ""
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
