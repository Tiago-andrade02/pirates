"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { formatARS } from "@/lib/format";
import { CartIcon, CreditCardIcon, TruckIcon, WhatsAppIcon } from "../icons";
import { ProductImage } from "../ProductImage";

export function CartView() {
  const { items, setQty, removeItem, clear, subtotal, count } = useCart();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-muted sm:h-20 sm:w-20">
          <CartIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h1 className="mt-5 font-serif text-xl text-white sm:text-3xl">
          Tu carrito está vacío
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">
          Explorá el catálogo y encontrá la fragancia que te representa.
        </p>
        <Link
          href="/perfumes"
          className="mt-7 inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= 80000 ? 0 : 6500;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8 lg:py-10">
      <h1 className="font-serif text-xl text-white sm:text-3xl lg:text-4xl">Carrito</h1>
      <p className="mt-1 text-xs text-muted sm:mt-2 sm:text-sm">
        {count} {count === 1 ? "producto" : "productos"}
      </p>

      <div className="mt-5 grid gap-5 sm:mt-8 sm:gap-8 lg:grid-cols-[1fr_360px] lg:mt-10 lg:gap-10">
        <ul className="space-y-2.5 sm:space-y-3">
          {items.map((item) => (
            <li
              key={`${item.slug}-${item.size}`}
              className="flex gap-2.5 rounded-xl border border-line bg-surface p-2.5 sm:gap-4 sm:rounded-2xl sm:p-4"
            >
              <Link
                href={`/perfumes/${item.slug}`}
                className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-line bg-background sm:h-28 sm:w-28 sm:rounded-xl"
              >
                <ProductImage
                  image={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-widest text-faint sm:text-[10px]">
                      {item.brandName}
                    </p>
                    <Link
                      href={`/perfumes/${item.slug}`}
                      className="mt-0.5 block truncate font-serif text-sm text-white transition-colors hover:text-neutral-300 sm:text-base"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-[10px] text-muted sm:text-xs">
                      {item.size} ml · {formatARS(item.price)} c/u
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.slug, item.size)}
                    className="shrink-0 rounded-full px-1.5 py-1 text-[10px] text-faint transition-colors hover:bg-surface-3 hover:text-white sm:px-2.5 sm:text-xs"
                  >
                    Quitar
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-1.5 sm:pt-2.5">
                  <div className="flex items-center rounded-full border border-line bg-background">
                    <button
                      type="button"
                      onClick={() => setQty(item.slug, item.size, item.qty - 1)}
                      className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-white sm:h-9 sm:w-9"
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-xs text-white sm:w-7 sm:text-sm">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item.slug, item.size, item.qty + 1)}
                      className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:text-white sm:h-9 sm:w-9"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-white sm:text-base">
                    {formatARS(item.price * item.qty)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-xl border border-line bg-surface p-3.5 sm:rounded-2xl sm:p-5 lg:sticky lg:top-24">
          <h2 className="font-serif text-base text-white sm:text-xl">Resumen</h2>
          <dl className="mt-3 space-y-2 text-xs sm:mt-4 sm:space-y-2.5 sm:text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-white">{formatARS(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Envío</dt>
              <dd className="text-white">
                {shipping === 0 ? (
                  <span className="text-emerald-400">Gratis</span>
                ) : (
                  formatARS(shipping)
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Cupón</dt>
              <dd className="text-faint">Próximamente</dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-between border-t border-line pt-3 sm:mt-4 sm:pt-4">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="font-serif text-lg text-white sm:text-xl">
              {formatARS(subtotal + shipping)}
            </span>
          </div>

          {subtotal < 80000 && (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-line bg-background p-2.5 text-[11px] text-muted sm:rounded-xl sm:text-xs">
              <TruckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
              Te faltan {formatARS(80000 - subtotal)} para el envío gratis.
            </p>
          )}

          <Link
            href="/checkout"
            className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200 sm:mt-4"
          >
            Finalizar compra
          </Link>

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-faint sm:mt-4 sm:text-xs">
            <CreditCardIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Pagos con Mercado Pago
          </div>
          <div className="mt-1.5 flex items-center justify-center gap-2 text-[11px] text-faint sm:text-xs">
            <WhatsAppIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Consultas por WhatsApp
          </div>

          <button
            type="button"
            onClick={clear}
            className="mt-4 w-full text-center text-[11px] text-faint transition-colors hover:text-white sm:text-xs"
          >
            Vaciar carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
