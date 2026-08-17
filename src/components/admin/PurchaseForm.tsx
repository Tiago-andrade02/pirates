"use client";

import { useRef, useState } from "react";
import { createPurchase } from "@/app/admin/actions";
import type { AdminProduct } from "@/lib/admin-data";
import { PlusIcon, TrashIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-white placeholder:text-faint focus:border-gold focus:outline-none";

type Row = { key: number };

export function PurchaseForm({ products }: { products: AdminProduct[] }) {
  const [rows, setRows] = useState<Row[]>([{ key: 0 }]);
  const nextKey = useRef(1);

  const addRow = () => {
    const key = nextKey.current;
    nextKey.current += 1;
    setRows((r) => [...r, { key }]);
  };
  const removeRow = (key: number) =>
    setRows((r) => (r.length === 1 ? r : r.filter((x) => x.key !== key)));

  return (
    <form
      action={createPurchase}
      className="space-y-4 rounded-2xl border border-line bg-surface p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
            Proveedor
          </span>
          <input
            name="supplier"
            required
            placeholder="Ej: Importadora Al Fayed"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
            Fecha
          </span>
          <input
            type="date"
            name="date"
            className={inputCls}
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
            Nota (opcional)
          </span>
          <input name="note" placeholder="Ej: 2do pedido del mes" className={inputCls} />
        </label>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.key} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_90px_90px_130px_40px]">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Perfume
              </span>
              <select name={`perfume_id_${i}`} defaultValue="" required className={inputCls}>
                <option value="" disabled>
                  Seleccionar…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.brandName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Tamaño
              </span>
              <select name={`size_${i}`} defaultValue="100" className={inputCls}>
                <option value="30">30 ml</option>
                <option value="50">50 ml</option>
                <option value="100">100 ml</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Cantidad
              </span>
              <input
                type="number"
                min="1"
                step="1"
                name={`qty_${i}`}
                required
                defaultValue="10"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Costo unitario
              </span>
              <input
                type="text"
                inputMode="decimal"
                name={`cost_${i}`}
                placeholder="Ej: 145000"
                className={inputCls}
              />
            </label>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              aria-label="Quitar fila"
              className="flex h-9 items-center justify-center rounded-xl border border-line text-muted transition hover:border-red-500/40 hover:text-red-300"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition hover:bg-line/40 hover:text-white"
        >
          <PlusIcon className="h-4 w-4" />
          Agregar producto
        </button>
        <button
          type="submit"
          className="rounded-xl bg-gold px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90"
        >
          Cargar compra
        </button>
      </div>
    </form>
  );
}
