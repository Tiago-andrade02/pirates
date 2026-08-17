import { getAdminProducts, getLowStockItems } from "@/lib/admin-data";
import { productImageUrl } from "@/lib/images";
import { updateProductStock, restockLow } from "../actions";
import { formatARS } from "@/lib/format";
import { PageHeader, Th, Td } from "@/components/admin/ui";
import { CheckIcon } from "@/components/icons";

export default async function AdminStockPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const products = getAdminProducts();
  const lowStock = getLowStockItems();
  const outOfStock = products.filter((p) => p.stock <= 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock"
        description={`${lowStock.length} productos bajo mínimos · ${outOfStock.length} agotados`}
      >
        <form action={restockLow}>
          <button
            type="submit"
            className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
          >
            Reponer stock bajo (→ 20)
          </button>
        </form>
      </PageHeader>

      {ok === "1" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Stock actualizado.
        </p>
      )}
      {ok === "restock" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Productos bajo mínimos repuestos.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-background/60">
              <tr>
                  <Th>Producto</Th>
                  <Th>Marca</Th>
                  <Th>Precio 50 ml</Th>
                  <Th>Costo</Th>
                  <Th>Stock por tamaño</Th>
                  <Th className="text-right">Actualizar</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className={p.stock <= 10 ? "bg-red-500/5" : "hover:bg-background/40"}
                >
                  <Td>
                    <span className="flex items-center gap-3">
                      <img
                        src={productImageUrl(p.image)}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg border border-line bg-background object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-white">{p.name}</span>
                        {p.stock <= 0 && (
                          <span className="text-xs font-semibold text-red-300">Agotado</span>
                        )}
                        {p.stock > 0 && p.stock <= 10 && (
                          <span className="text-xs font-semibold text-amber-300">Stock bajo</span>
                        )}
                      </span>
                    </span>
                  </Td>
                  <Td>{p.brandName}</Td>
                  <Td>{p.price50 ? formatARS(p.price50) : "—"}</Td>
                  <Td>{p.cost ? formatARS(p.cost) : "—"}</Td>
                  <Td>
                    <form action={updateProductStock} className="flex items-end gap-3">
                      <input type="hidden" name="id" value={p.id} />
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { k: "30", v: p.stock30 },
                          { k: "50", v: p.stock50 },
                          { k: "100", v: p.stock100 },
                        ].map((size) => (
                          <label key={size.k} className="block">
                            <span className="mb-1 block text-center text-[10px] font-semibold uppercase text-faint">
                              {size.k} ml
                            </span>
                            <input
                              type="number"
                              name={`stock_${size.k}`}
                              min="0"
                              step="1"
                              defaultValue={size.v}
                              className="w-16 rounded-lg border border-line bg-background px-2 py-1.5 text-center text-sm text-white focus:border-gold focus:outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="submit"
                        aria-label={`Guardar stock de ${p.name}`}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition hover:border-emerald-500/40 hover:text-emerald-300"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
