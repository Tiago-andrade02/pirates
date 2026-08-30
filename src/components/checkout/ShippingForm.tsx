"use client";

import { useEffect, useRef, useState } from "react";
import { formatARS } from "@/lib/format";
import { PROVINCES, isValidPostalCode } from "@/lib/shipping/provinces";
import { StoreIcon, TruckIcon, CheckIcon } from "@/components/icons";

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
  rawPrice: number;
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

interface Agency {
  code: string;
  name: string;
  address: string | null;
  locality: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
}

interface ShippingFormProps {
  items: { slug: string; size: string; qty: number }[];
  subtotal: number;
  freeShippingMin: number;
  onChange: (selection: ShippingSelection | null) => void;
}

const inputCls =
  "w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-white placeholder:text-faint outline-none transition-colors focus:border-white/40";

export function ShippingForm({
  items,
  subtotal,
  freeShippingMin,
  onChange,
}: ShippingFormProps) {
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");
  const [apartment, setApartment] = useState("");
  const [deliveryType, setDeliveryType] = useState<"D" | "S">("D");
  const [agencyCode, setAgencyCode] = useState("");
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [options, setOptions] = useState<QuoteOption[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingAgencies, setLoadingAgencies] = useState(false);
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
    const raw = option.price;
    const price = subtotal >= freeShippingMin ? 0 : raw;
    onChange({
      deliveryType: option.deliveryType,
      postalCode: postalCode.trim(),
      province,
      locality,
      street,
      number,
      floor,
      apartment,
      agencyCode,
      service: option.productType,
      productName: option.productName,
      price,
      rawPrice: raw,
      deliveryTimeMin: option.deliveryTimeMin,
      deliveryTimeMax: option.deliveryTimeMax,
    });
  }

  async function loadAgencies(provinceName: string) {
    const code = PROVINCES.find((p) => p.name === provinceName)?.code;
    if (!code) {
      setAgencies([]);
      return;
    }
    setLoadingAgencies(true);
    try {
      const res = await fetch(
        `/api/shipping/agencies?province=${encodeURIComponent(provinceName)}`
      );
      const data = (await res.json()) as { agencies?: Agency[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las sucursales");
      setAgencies(data.agencies ?? []);
      setAgencyCode((current) =>
        current && (data.agencies ?? []).some((a) => a.code === current) ? current : ""
      );
    } catch {
      setAgencies([]);
    } finally {
      setLoadingAgencies(false);
    }
  }

  // Cotización real: se dispara al cambiar provincia/código postal o el carrito.
  useEffect(() => {
    if (!provinceCode || !postalValid) return;

    // Si solo cambió la modalidad o los campos de dirección, no hace falta re-cotizar.
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
        const opts = (data.options as QuoteOption[]) ?? [];
        lastQuoteKey.current = key;
        setOptions(opts);
        emitSelection(opts.find((o) => o.deliveryType === deliveryType) ?? null);
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
  }, [nonce, provinceCode, postalValid, deliveryType, itemsKey]);

  function handleProvinceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    setProvince(next);
    setOptions([]);
    emitSelection(null);
    lastQuoteKey.current = "";
    if (deliveryType === "S") {
      void loadAgencies(next);
    }
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
  function handleAddressFieldChange(
    setter: (v: string) => void
  ) {
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

  function handleAgencyChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const code = e.target.value;
    setAgencyCode(code);
    emitSelection(options.find((o) => o.deliveryType === deliveryType) ?? null);
  }

  function handleOptionPick(option: QuoteOption) {
    if (option.deliveryType === "S" && agencies.length === 0) {
      void loadAgencies(province);
    }
    setDeliveryType(option.deliveryType);
    emitSelection(option);
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-serif text-xl text-white">Envío</h2>
      <p className="mt-1 text-xs text-muted">
        Cotización real de Correo Argentino según tu código postal y el peso del pedido.
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

        {deliveryType === "D" ? (
          <>
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
              <span className="mb-1.5 block text-xs text-muted">Departamento (opcional)</span>
              <input
                value={apartment}
                onChange={handleAddressFieldChange(setApartment)}
                placeholder="Ej: D"
                className={inputCls}
              />
            </label>
          </>
        ) : (
          <label className="block sm:col-span-1">
            <span className="mb-1.5 block text-xs text-muted">Sucursal *</span>
            <select
              required
              value={agencyCode}
              onChange={handleAgencyChange}
              className={inputCls}
            >
              <option value="" disabled>
                {loadingAgencies ? "Cargando sucursales…" : "Seleccioná una sucursal"}
              </option>
              {agencies.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} · {a.locality ?? a.city ?? ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {deliveryType === "S" && !province && (
        <p className="mt-4 rounded-xl border border-line bg-background p-3 text-xs text-muted">
          Seleccioná primero la provincia para cargar las sucursales.
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = option.deliveryType === deliveryType;
          const price = subtotal >= freeShippingMin ? 0 : option.price;
          return (
            <button
              key={option.deliveryType}
              type="button"
              onClick={() => handleOptionPick(option)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? "border-white/60 bg-white/5"
                  : "border-line bg-background hover:border-white/30"
              }`}
            >
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-line">
                {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
              </span>
              {option.deliveryType === "D" ? (
                <TruckIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              ) : (
                <StoreIcon className="mt-0.5 h-5 w-5 shrink-0 text-faint" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">
                  {option.deliveryType === "D" ? "A domicilio" : "Retiro en sucursal"}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {option.deliveryTimeMin && option.deliveryTimeMax
                    ? `Entre ${option.deliveryTimeMin} y ${option.deliveryTimeMax} días hábiles · `
                    : ""}
                  {subtotal >= freeShippingMin ? (
                    <span className="text-emerald-400">Envío gratis</span>
                  ) : (
                    formatARS(price)
                  )}
                  {subtotal >= freeShippingMin && (
                    <span className="ml-1 line-through opacity-60">
                      {formatARS(option.price)}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {quoting && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Cotizando envío…
        </p>
      )}

      {!quoting && options.length === 0 && postalValid && provinceCode && (
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
