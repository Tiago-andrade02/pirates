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
  "w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-white placeholder:text-faint outline-none transition-colors focus:border-white/40";

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
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border border-line bg-surface text-muted">
          <CartIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-3xl text-white">No hay nada para pagar</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Tu carrito está vacío. Agregá fragancias y volvé para finalizar la compra.
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-serif text-3xl text-white sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-sm text-muted">
        {count} {count === 1 ? "producto" : "productos"} · Pago seguro con Mercado Pago
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="font-serif text-xl text-white">Datos de contacto</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs text-muted">Nombre y apellido *</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs text-muted">WhatsApp *</span>
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
                <span className="mb-1.5 block text-xs text-muted">Email (opcional)</span>
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
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300">
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
          <p className="text-center text-xs text-faint">
            Serás redirigido a Mercado Pago para completar el pago de forma segura.
          </p>
        </form>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-24">
          <h2 className="font-serif text-xl text-white">Tu pedido</h2>
          <ul className="mt-5 space-y-3">
            {items.map((item) => (
              <li key={`${item.slug}-${item.size}`} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <p className="text-white">{item.name}</p>
                  <p className="text-xs text-faint">
                    {item.size} ml · {item.qty} × {formatARS(item.price)}
                  </p>
                </div>
                <p className="shrink-0 text-white">{formatARS(item.price * item.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
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
          <div className="mt-5 flex justify-between border-t border-line pt-5">
            <span className="text-sm font-semibold text-white">Total</span>
            <span className="font-serif text-2xl text-white">{formatARS(total)}</span>
          </div>
          {shipping && (
            <p className="mt-4 rounded-xl border border-line bg-background p-3 text-xs text-muted">
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
