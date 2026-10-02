"use client";

import { useEffect, useState } from "react";
import { PROVINCES, isValidPostalCode } from "@/lib/shipping/provinces";
import { TruckIcon, CheckIcon, StoreIcon } from "@/components/icons";

export interface ShippingSelection {
  deliveryType: "D" | "S";
  postalCode: string;
  province: string;
  locality: string;
  street: string;
  number: string;
  floor: string;
  apartment: string;
  // Sucursal de Correo Argentino que el cliente prefiere. Texto libre y
  // opcional: no hay desplegable ni validación contra un padrón de agencias.
  preferredBranch: string;
  service: string;
  productName: string;
  price: number;
  deliveryTimeMin: string | null;
  deliveryTimeMax: string | null;
}

interface QuoteOption {
  provider: string;
  deliveryType: "D" | "S";
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin: string | null;
  deliveryTimeMax: string | null;
  validTo: string | null;
}

interface ShippingFormProps {
  items: { slug: string; size: string; qty: number }[];
  onChange: (selection: ShippingSelection | null) => void;
}

const inputCls =
  "w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-white placeholder:text-faint outline-none transition-colors focus:border-white/40";

// Modalidades ofrecidas. Son exactamente dos y las dos son gratuitas. La de
// sucursal NO tiene selector: no hay catálogo de sucursales de Correo Argentino,
// así que el cliente escribe la que prefiere y se coordina por WhatsApp.
const MODALITIES = [
  {
    value: "D" as const,
    title: "Envío a domicilio",
    detail: "Te lo mandamos a tu dirección por Correo Argentino.",
  },
  {
    value: "S" as const,
    title: "Envío a sucursal de Correo Argentino",
    detail: "Retirás en la sucursal que elijas. Gratis.",
  },
];

export function ShippingForm({ items, onChange }: ShippingFormProps) {
  const [deliveryType, setDeliveryType] = useState<"D" | "S">("D");
  const [preferredBranch, setPreferredBranch] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  // Opción real cotizada por el carrier. Solo aplica a domicilio: en la modalidad
  // de sucursal no se cotiza contra la API (no hay código de agencia).
  const [option, setOption] = useState<QuoteOption | null>(null);
  // `destinoOk` = provincia + CP válidos y cotización sin error. Es la condición
  // para habilitar el pago en ambas modalidades.
  const [destinoOk, setDestinoOk] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemsKey = items.map((i) => `${i.slug}-${i.size}-${i.qty}`).join("|");
  const provinceCode = PROVINCES.find((p) => p.name === province)?.code;
  const postalValid = isValidPostalCode(postalCode);

  // Cotización real: se dispara al cambiar provincia/código postal o el carrito.
  // Se usa como validación del destino (que haya servicio para ese CP), no como
  // precio: el envío es siempre gratis.
  useEffect(() => {
    if (!provinceCode || !postalValid) {
      // Sin destino válido no hay nada que cotizar. El estado ya se limpia en los
      // handlers (handleProvinceChange / handlePostalCodeChange), que son los
      // únicos caminos por los que el destino puede dejar de ser válido.
      return;
    }

    let cancelled = false;

    // El estado se toca adentro del timer, no en el cuerpo del efecto: un
    // setState síncrono acá dispara un render en cascada.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setQuoting(true);
      setError(null);
      try {
        const res = await fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            postalCode: postalCode.trim(),
            province,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cotizar el envío");
        const opts = ((data.options as QuoteOption[]) ?? []).filter(
          (o) => o.deliveryType === "D"
        );
        if (cancelled) return;
        setOption(opts[0] ?? null);
        setDestinoOk(true);
      } catch (err) {
        if (cancelled) return;
        setOption(null);
        setDestinoOk(false);
        setError(err instanceof Error ? err.message : "No se pudo cotizar el envío");
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceCode, postalValid, postalCode, province, itemsKey]);

  // Emite la selección vigente. El precio siempre es 0: el backend ni siquiera
  // lee este campo (calcula el envío en el servidor), pero se manda en 0 para
  // que ningún cliente antiguo pueda cobrar.
  useEffect(() => {
    if (!destinoOk) {
      onChange(null);
      return;
    }
    const isHome = deliveryType === "D";
    onChange({
      deliveryType,
      postalCode: postalCode.trim(),
      province,
      locality,
      // En sucursal no se pide ni se guarda dirección.
      street: isHome ? street : "",
      number: isHome ? number : "",
      floor: isHome ? floor : "",
      apartment: isHome ? apartment : "",
      preferredBranch: isHome ? "" : preferredBranch,
      service: isHome ? (option?.productType ?? "") : "",
      productName: isHome ? (option?.productName ?? "") : "",
      price: 0,
      deliveryTimeMin: isHome ? (option?.deliveryTimeMin ?? null) : null,
      deliveryTimeMax: isHome ? (option?.deliveryTimeMax ?? null) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destinoOk,
    deliveryType,
    province,
    postalCode,
    locality,
    street,
    number,
    floor,
    apartment,
    preferredBranch,
    option,
  ]);

  // Invalida la cotización vigente. Vive en los handlers, no en el efecto: un
  // setState síncrono adentro del efecto dispara un render en cascada.
  function invalidateQuote() {
    setOption(null);
    setDestinoOk(false);
    setError(null);
    // Sin esto, completar provincia+CP y después vaciar uno de los dos dejaría el
    // spinner girando para siempre: el efecto ya no tiene nada que cotizar.
    setQuoting(false);
  }

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setProvince(e.target.value);
    invalidateQuote();
  }

  // El código postal cambia la cotización: se limpia y se re-cotiza.
  function handlePostalCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPostalCode(e.target.value);
    invalidateQuote();
  }

  function handleTextFieldChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
    };
  }

  const deliveryWindow =
    option?.deliveryTimeMin && option?.deliveryTimeMax
      ? `Entre ${option.deliveryTimeMin} y ${option.deliveryTimeMax} días hábiles`
      : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-serif text-xl text-white">Envío</h2>
      <p className="mt-1 text-xs text-muted">
        Envío gratis a todo el país. Elegí cómo lo querés recibir.
      </p>

      {/* Modalidades: dos botones de radio, sin desplegable de sucursales. */}
      <div className="mt-5 space-y-3" role="radiogroup" aria-label="Método de envío">
        {MODALITIES.map((m) => {
          const active = deliveryType === m.value;
          return (
            <label
              key={m.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                active
                  ? "border-white/60 bg-white/5"
                  : "border-line bg-background hover:border-white/30"
              }`}
            >
              <input
                type="radio"
                name="metodoEnvio"
                value={m.value}
                checked={active}
                onChange={() => setDeliveryType(m.value)}
                className="sr-only"
              />
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  active ? "border-white" : "border-line"
                }`}
              >
                {active && <CheckIcon className="h-3.5 w-3.5 text-white" />}
              </span>
              {m.value === "S" ? (
                <StoreIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              ) : (
                <TruckIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">
                  {m.title}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {m.detail}{" "}
                  <span className="text-emerald-400">Envío gratis</span>
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {/* Datos de destino: los dos modality necesitan provincia, CP y localidad
          (el CP es el que define la sucursal y el courier de la modalidad). */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Provincia *</span>
          <select
            required
            value={province}
            onChange={handleProvinceChange}
            className={inputCls}
          >
            <option value="" disabled>
              Seleccioná tu provincia
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Código postal *</span>
          <input
            required
            value={postalCode}
            onChange={handlePostalCodeChange}
            placeholder="Ej: 1704"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Localidad *</span>
          <input
            required
            value={locality}
            onChange={handleTextFieldChange(setLocality)}
            placeholder="Ej: Monte Grande"
            className={inputCls}
          />
        </label>
      </div>

      {/* Dirección: solo en la modalidad a domicilio. */}
      {deliveryType === "D" && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Calle *</span>
            <input
              required
              value={street}
              onChange={handleTextFieldChange(setStreet)}
              placeholder="Ej: Av. Corrientes"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Número *</span>
            <input
              required
              inputMode="numeric"
              value={number}
              onChange={handleTextFieldChange(setNumber)}
              placeholder="Ej: 1234"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">Piso (opcional)</span>
            <input
              value={floor}
              onChange={handleTextFieldChange(setFloor)}
              placeholder="Ej: 3"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">
              Departamento (opcional)
            </span>
            <input
              value={apartment}
              onChange={handleTextFieldChange(setApartment)}
              placeholder="Ej: D"
              className={inputCls}
            />
          </label>
        </div>
      )}

      {/* Sucursal: sin desplegable. Se explica que se coordina por WhatsApp y se
          ofrece escribir una preferencia como ayuda, nunca como requisito. */}
      {deliveryType === "S" && (
        <div className="mt-4 space-y-3">
          <p className="rounded-xl border border-line bg-background p-3 text-xs leading-relaxed text-muted">
            No publicamos el listado de sucursales. Si elegís esta modalidad,
            apenas confirmes el pedido te escribimos por WhatsApp para
            coordinar la sucursal de Correo Argentino según la disponibilidad en tu
            zona. La dirección no hace falta: retirás en la sucursal.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted">
              ¿Preferís alguna sucursal en particular? (opcional)
            </span>
            <input
              value={preferredBranch}
              onChange={(e) => setPreferredBranch(e.target.value)}
              maxLength={120}
              placeholder="Escribí la sucursal o zona que te queda cómoda"
              className={inputCls}
            />
          </label>
        </div>
      )}

      {deliveryType === "D" && deliveryWindow && destinoOk && (
        <p className="mt-4 text-xs text-muted">{deliveryWindow}</p>
      )}

      {quoting && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Buscando opciones de entrega…
        </p>
      )}

      {!quoting && !destinoOk && postalValid && provinceCode && !error && (
        <p className="mt-4 rounded-xl border border-line bg-background p-3 text-xs text-muted">
          Ingresá tu código postal para calcular el envío real.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
