"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { formatARS } from "@/lib/format";
import { CartIcon, CreditCardIcon } from "@/components/icons";
import {
  ShippingForm,
  type ShippingSelection,
} from "@/components/checkout/ShippingForm";

const inputCls =
  "w-full rounded-lg border border-line bg-background px-3.5 py-3 text-sm text-white placeholder:text-faint outline-none transition-colors focus:border-white/40 sm:rounded-xl sm:px-4";

export default function CheckoutPage() {
  const { items, subtotal, count } = useCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [shipping, setShipping] = useState<ShippingSelection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shippingCost = shipping?.price ?? 0;
  const total = subtotal + shippingCost;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!shipping) {
      setError("Completá provincia y código postal para calcular el envío.");
      return;
    }
    if (shipping.deliveryType === "S" && !shipping.agencyCode) {
      setError("Seleccioná la sucursal de retiro.");
      return;
    }
    if (shipping.deliveryType === "D" && (!shipping.street || !shipping.number)) {
      setError("Completá la dirección de entrega.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            slug: item.slug,
            size: item.size,
            qty: item.qty,
          })),
          customer: {
            name,
            email: email || undefined,
            phone,
          },
          shipping: {
            deliveryType: shipping.deliveryType,
            postalCode: shipping.postalCode,
            province: shipping.province,
            locality: shipping.locality,
            street: shipping.street,
            number: shipping.number,
            floor: shipping.floor,
            apartment: shipping.apartment,
            agencyCode: shipping.agencyCode,
          },
        }),
      });
      const data = (await res.json()) as { initPoint?: string; error?: string };
      if (!res.ok || !data.initPoint) {
        setError(data.error ?? "No se pudo iniciar el pago.");
        setLoading(false);
        return;
      }
      window.location.href = data.initPoint;
    } catch {
      setError("Ocurrió un error inesperado. Intentalo de nuevo.");
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center sm:py-24">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-muted sm:h-20 sm:w-20">
          <CartIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        </div>
        <h1 className="mt-5 font-serif text-xl text-white sm:text-3xl">No hay nada para pagar</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-muted">
          Tu carrito está vacío. Agregá fragancias y volvé para finalizar la compra.
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:py-8 lg:py-10">
      <h1 className="font-serif text-xl text-white sm:text-3xl lg:text-4xl">Checkout</h1>
      <p className="mt-1 text-xs text-muted sm:mt-2 sm:text-sm">
        {count} {count === 1 ? "producto" : "productos"} · Pago seguro con Mercado Pago
      </p>

      <div className="mt-5 grid gap-5 sm:mt-8 sm:gap-7 lg:grid-cols-[1fr_360px] lg:mt-10 lg:gap-10">
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-5">
          <section className="rounded-xl border border-line bg-surface p-3.5 sm:rounded-2xl sm:p-5">
            <h2 className="font-serif text-base text-white sm:text-xl">Datos de contacto</h2>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 sm:gap-3 sm:mt-4">
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted sm:text-xs">Nombre y apellido *</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-muted sm:text-xs">WhatsApp *</span>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ej: 11 1234 5678"
                  className={inputCls}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-[11px] text-muted sm:text-xs">Email (opcional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: juan@correo.com"
                  className={inputCls}
                />
              </label>
            </div>
          </section>

          <ShippingForm
            items={items.map((item) => ({
              slug: item.slug,
              size: item.size,
              qty: item.qty,
            }))}
            subtotal={subtotal}
            freeShippingMin={80000}
            onChange={setShipping}
          />

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300 sm:rounded-xl">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Iniciando pago…" : "Ir a pagar"}
            <CreditCardIcon className="h-4 w-4" />
          </button>
          <p className="text-center text-[11px] text-faint sm:text-xs">
            Serás redirigido a Mercado Pago para completar el pago de forma segura.
          </p>
        </form>

        <aside className="h-fit rounded-xl border border-line bg-surface p-3.5 sm:rounded-2xl sm:p-5 lg:sticky lg:top-24">
          <h2 className="font-serif text-base text-white sm:text-xl">Tu pedido</h2>
          <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
            {items.map((item) => (
              <li key={`${item.slug}-${item.size}`} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-white">{item.name}</p>
                  <p className="text-[10px] text-faint sm:text-xs">
                    {item.size} ml · {item.qty} × {formatARS(item.price)}
                  </p>
                </div>
                <p className="shrink-0 text-white">{formatARS(item.price * item.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm sm:mt-4 sm:space-y-2.5 sm:pt-4">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="text-white">{formatARS(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Envío</dt>
              <dd className="text-white">
                {shipping && shippingCost === 0 ? (
                  <span className="text-emerald-400">Gratis</span>
                ) : shipping ? (
                  formatARS(shippingCost)
                ) : (
                  <span className="text-faint">Calcular</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex justify-between border-t border-line pt-3 sm:mt-4 sm:pt-4">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="font-serif text-lg text-white sm:text-xl">{formatARS(total)}</span>
          </div>
          {shipping && (
            <p className="mt-3 rounded-lg border border-line bg-background p-2.5 text-[11px] text-muted sm:rounded-xl sm:text-xs">
              {shipping.deliveryType === "S" ? "Retiro en sucursal" : "Envío a domicilio"}
              {shipping.deliveryType === "D" && shipping.street
                ? ` · ${shipping.street} ${shipping.number}`
                : ""}
              {shipping.deliveryTimeMin && shipping.deliveryTimeMax
                ? ` · ${shipping.deliveryTimeMin}-${shipping.deliveryTimeMax} días hábiles`
                : ""}
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
