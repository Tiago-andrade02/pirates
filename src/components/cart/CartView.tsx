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
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface text-muted">
          <CartIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-3xl text-white">
          Tu carrito está vacío
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Explorá el catálogo y encontrá la fragancia que te representa.
        </p>
        <Link
          href="/perfumes"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          Explorar catálogo
        </Link>
      </div>
    );
  }

  const shipping = subtotal >= 80000 ? 0 : 6500;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl text-white sm:text-4xl">Carrito</h1>
      <p className="mt-2 text-sm text-muted">
        {count} {count === 1 ? "producto" : "productos"}
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={`${item.slug}-${item.size}`}
              className="flex gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5"
            >
              <Link
                href={`/perfumes/${item.slug}`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-background sm:h-28 sm:w-28"
              >
                <ProductImage
                  image={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-widest text-faint">
                      {item.brandName}
                    </p>
                    <Link
                      href={`/perfumes/${item.slug}`}
                      className="mt-0.5 block truncate font-serif text-base text-white transition-colors hover:text-neutral-300 sm:text-lg"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 text-xs text-muted">
                      {item.size} ml · {formatARS(item.price)} c/u
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.slug, item.size)}
                    className="shrink-0 rounded-full px-2 py-1.5 text-xs text-faint transition-colors hover:bg-surface-3 hover:text-white sm:px-3"
                  >
                    Quitar
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center rounded-full border border-line bg-background">
                    <button
                      type="button"
                      onClick={() => setQty(item.slug, item.size, item.qty - 1)}
                      className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-white"
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <span className="w-7 text-center text-sm text-white">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(item.slug, item.size, item.qty + 1)}
                      className="flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-white"
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-base font-semibold text-white">
                    {formatARS(item.price * item.qty)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-xl text-white">Resumen</h2>
          <dl className="mt-5 space-y-3 text-sm">
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
              <dd className="text-faint">Disponible pronto</dd>
            </div>
          </dl>
          <div className="mt-5 flex justify-between border-t border-line pt-5">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="font-serif text-2xl text-white">
              {formatARS(subtotal + shipping)}
            </span>
          </div>

          {subtotal < 80000 && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-background p-3 text-xs text-muted">
              <TruckIcon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
              Te faltan {formatARS(80000 - subtotal)} para el envío gratis.
            </p>
          )}

          <Link
            href="/checkout"
            className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
          >
            Finalizar compra
          </Link>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-faint">
            <CreditCardIcon className="h-4 w-4" />
            Pagos con Mercado Pago
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-faint">
            <WhatsAppIcon className="h-4 w-4" />
            Consultas por WhatsApp
          </div>

          <button
            type="button"
            onClick={clear}
            className="mt-6 w-full text-center text-xs text-faint transition-colors hover:text-white"
          >
            Vaciar carrito
          </button>
        </aside>
      </div>
    </div>
  );
}
