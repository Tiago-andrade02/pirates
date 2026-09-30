"use client";

import { useEffect, useRef, useState } from "react";
import { PROVINCES, isValidPostalCode } from "@/lib/shipping/provinces";
import { TruckIcon, CheckIcon } from "@/components/icons";

export interface ShippingSelection {
  deliveryType: "D" | "S";
  postalCode: string;
  province: string;
  locality: string;
  street: string;
  number: string;
  floor: string;
  apartment: string;
  agencyCode: string;
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

// El retiro en persona está desactivado: el checkout solo ofrece envío a
// domicilio. No hay selector de modalidad ni de sucursal, así que no hay ningún
// campo obligatorio que pueda bloquear la compra.
export function ShippingForm({ items, onChange }: ShippingFormProps) {
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const lastQuoteKey = useRef("");
  const selectedOptionRef = useRef<QuoteOption | null>(null);

  const itemsKey = items.map((i) => `${i.slug}-${i.size}-${i.qty}`).join("|");
  const provinceCode = PROVINCES.find((p) => p.name === province)?.code;
  const postalValid = isValidPostalCode(postalCode);

  function emitSelection(option: QuoteOption | null) {
    selectedOptionRef.current = option;
    if (!option) {
      onChange(null);
      return;
    }
    // Envío gratis para todos los pedidos (launch): el precio siempre es 0.
    // El backend ni siquiera lee este campo (calcula el envío en el servidor),
    // pero se manda en 0 para que ningún cliente antiguo pueda cobrar.
    onChange({
      deliveryType: "D",
      postalCode: postalCode.trim(),
      province,
      locality,
      street,
      number,
      floor,
      apartment,
      agencyCode: "",
      service: option.productType,
      productName: option.productName,
      price: 0,
      deliveryTimeMin: option.deliveryTimeMin,
      deliveryTimeMax: option.deliveryTimeMax,
    });
  }

  // Cotización real: se dispara al cambiar provincia/código postal o el carrito.
  useEffect(() => {
    if (!provinceCode || !postalValid) return;

    const key = `${province}|${postalCode.trim()}|${itemsKey}`;
    if (lastQuoteKey.current === key) return;

    const timer = setTimeout(async () => {
      setQuoting(true);
      setError(null);
      setOptions([]);
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
        lastQuoteKey.current = key;
        setOptions(opts);
        emitSelection(opts[0] ?? null);
      } catch (err) {
        setOptions([]);
        setError(err instanceof Error ? err.message : "No se pudo cotizar el envío");
        onChange(null);
      } finally {
        setQuoting(false);
      }
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, provinceCode, postalValid, itemsKey]);

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setProvince(next);
    setOptions([]);
    emitSelection(null);
    lastQuoteKey.current = "";
  }

  // El código postal cambia la cotización: se limpia y se re-cotiza.
  function handlePostalCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setPostalCode(next);
    setOptions([]);
    emitSelection(null);
    lastQuoteKey.current = "";
    setNonce((n) => n + 1);
  }

  // Los campos de dirección no afectan el costo del envío: no se limpia la
  // selección vigente, solo se re-emite con los datos de dirección actualizados.
  function handleAddressFieldChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setNonce((n) => n + 1);
    };
  }

  useEffect(() => {
    if (selectedOptionRef.current) {
      emitSelection(selectedOptionRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-serif text-xl text-white">Envío</h2>
      <p className="mt-1 text-xs text-muted">
        Envío gratis a todo el país. Completá tus datos para calcular el envío.
      </p>

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
            onChange={handleAddressFieldChange(setLocality)}
            placeholder="Ej: Monte Grande"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Calle *</span>
          <input
            required
            value={street}
            onChange={handleAddressFieldChange(setStreet)}
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
            onChange={handleAddressFieldChange(setNumber)}
            placeholder="Ej: 1234"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted">Piso (opcional)</span>
          <input
            value={floor}
            onChange={handleAddressFieldChange(setFloor)}
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
            onChange={handleAddressFieldChange(setApartment)}
            placeholder="Ej: D"
            className={inputCls}
          />
        </label>
      </div>

      <div className="mt-6">
        {options.map((option) => (
          <div
            key={option.deliveryType}
            className="flex items-start gap-3 rounded-xl border border-white/60 bg-white/5 p-4"
          >
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-line">
              <CheckIcon className="h-3.5 w-3.5 text-white" />
            </span>
            <TruckIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">
                {option.deliveryType === "D" ? "A domicilio" : "Envío"}
              </span>
              <span className="mt-1 block text-xs text-muted">
                {option.deliveryTimeMin && option.deliveryTimeMax
                  ? `Entre ${option.deliveryTimeMin} y ${option.deliveryTimeMax} días hábiles · `
                  : ""}
                <span className="text-emerald-400">Envío gratis</span>
              </span>
            </span>
          </div>
        ))}
      </div>

      {quoting && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Buscando opciones de entrega…
        </p>
      )}

      {!quoting && options.length === 0 && postalValid && provinceCode && !error && (
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
