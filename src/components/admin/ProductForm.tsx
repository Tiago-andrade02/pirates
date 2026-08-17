import type { Brand } from "@/lib/types";
import Link from "next/link";
import {
  GENDER_OPTIONS,
  AROMA_OPTIONS,
  SEASON_OPTIONS,
  OCCASION_OPTIONS,
} from "@/lib/data";
import type { AdminProduct } from "@/lib/admin-data";
import { ProductSizes } from "./ProductSizes";
import { TagPicker } from "./TagPicker";

function parseNotes(json: string): string {
  try {
    return (JSON.parse(json) as string[]).join(", ");
  } catch {
    return "";
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder:text-faint focus:border-gold focus:outline-none";

export function ProductForm({
  product,
  brands,
  action,
}: {
  product: AdminProduct | null;
  brands: Brand[];
  action: (formData: FormData) => Promise<void>;
}) {
  const p = product;

  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-2xl border border-line bg-surface p-6 sm:grid-cols-2"
    >
      {p && <input type="hidden" name="id" value={p.id} />}

      <Field label="Nombre" className="sm:col-span-2">
        <input name="name" required defaultValue={p?.name ?? ""} placeholder="Ej: Asad Bourbon" className={inputCls} />
      </Field>

      <Field label="Marca">
        <select name="brand_id" defaultValue={p?.brandId ?? ""} className={inputCls}>
          <option value="" disabled>
            Seleccionar marca
          </option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Género">
        <select name="gender" defaultValue={p?.gender ?? "unisex"} className={inputCls}>
          {GENDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <TagPicker
        label="Familias olfativas (varias)"
        name="aroma"
        options={AROMA_OPTIONS}
        initial={p?.aromas}
      />

      <TagPicker
        label="Estaciones (varias)"
        name="season"
        options={SEASON_OPTIONS}
        initial={p?.seasons}
      />

      <TagPicker
        label="Ocasiones (varias)"
        name="occasion"
        options={OCCASION_OPTIONS}
        initial={p?.occasions}
      />

      <ProductSizes
        initial={{
          "30": p?.price30 ?? null,
          "50": p?.price50 ?? null,
          "100": p?.price100 ?? null,
        }}
        initialStock={{
          "30": p?.stock30 ?? 0,
          "50": p?.stock50 ?? 0,
          "100": p?.stock100 ?? 0,
        }}
      />

      <Field label="Costo unitario (referencia)">
        <input
          type="text"
          inputMode="decimal"
          name="cost"
          defaultValue={p?.cost ?? ""}
          placeholder="Automático: 45% del precio"
          className={inputCls}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="Duración (1-5)">
          <input
            type="number"
            min="1"
            max="5"
            name="duration"
            defaultValue={p?.duration ?? 3}
            className={inputCls}
          />
        </Field>
        <Field label="Proyección (1-5)">
          <input
            type="number"
            min="1"
            max="5"
            name="projection"
            defaultValue={p?.projection ?? 3}
            className={inputCls}
          />
        </Field>
        <Field label="Dulzura (1-5)">
          <input
            type="number"
            min="1"
            max="5"
            name="sweetness"
            defaultValue={p?.sweetness ?? 3}
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Inspirado en" className="sm:col-span-2">
        <input
          name="inspired_by"
          defaultValue={p?.inspiredBy ?? ""}
          placeholder="Ej: Dior Sauvage Elixir"
          className={inputCls}
        />
      </Field>

      <Field label="Descripción" className="sm:col-span-2">
        <textarea
          name="description"
          rows={4}
          defaultValue={p?.description ?? ""}
          placeholder="Descripción comercial del perfume"
          className={inputCls}
        />
      </Field>

      <Field label="Notas de salida (separadas por coma)">
        <input name="notes_top" defaultValue={p ? parseNotes(p.notesTop) : ""} className={inputCls} />
      </Field>
      <Field label="Notas de corazón">
        <input name="notes_heart" defaultValue={p ? parseNotes(p.notesHeart) : ""} className={inputCls} />
      </Field>
      <Field label="Notas de fondo" className="sm:col-span-2">
        <input name="notes_base" defaultValue={p ? parseNotes(p.notesBase) : ""} className={inputCls} />
      </Field>

      <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="is_new"
            defaultChecked={p?.isNew ?? false}
            className="h-4 w-4 accent-[#c9a05f]"
          />
          Nuevo
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="best_seller"
            defaultChecked={p?.bestSeller ?? false}
            className="h-4 w-4 accent-[#c9a05f]"
          />
          Destacado
        </label>
      </div>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          className="rounded-xl bg-gold px-6 py-3 text-sm font-semibold text-black transition hover:bg-gold/90"
        >
          {p ? "Guardar cambios" : "Crear producto"}
        </button>
        <Link
          href="/admin/productos"
          className="rounded-xl border border-line px-6 py-3 text-sm text-muted transition hover:bg-line/40 hover:text-white"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
