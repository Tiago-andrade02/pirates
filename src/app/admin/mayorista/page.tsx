import { getAdminProducts, getPurchases } from "@/lib/admin-data";
import { deletePurchase } from "../actions";
import { formatARS, formatNumber } from "@/lib/format";
import { PageHeader, EmptyState, Money, Th, Td } from "@/components/admin/ui";
import { PurchaseForm } from "@/components/admin/PurchaseForm";
import { TrashIcon } from "@/components/icons";

export default async function AdminMayoristaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const purchases = getPurchases();
  const products = getAdminProducts();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mayorista"
        description="Cargas de stock de proveedores"
      />

      {ok === "cargada" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Compra cargada y stock actualizado.
        </p>
      )}
      {ok === "borrada" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Compra eliminada y stock descontado.
        </p>
      )}
      {error === "datos" && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Completá el proveedor y al menos un producto.
        </p>
      )}

      <section>
        <h2 className="mb-3 font-serif text-lg text-white">Nueva compra a proveedor</h2>
        <PurchaseForm products={products} />
      </section>

      <section>
        <h2 className="mb-3 font-serif text-lg text-white">
          Historial ({purchases.length})
        </h2>
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <EmptyState message="Todavía no cargaste compras a proveedores." />
          ) : (
            purchases.map(({ purchase, items }) => (
              <div key={purchase.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div>
                    <p className="font-medium text-white">{purchase.supplier}</p>
                    <p className="text-xs text-faint">
                      {new Date(purchase.date).toLocaleDateString("es-AR")}
                      {purchase.note ? ` · ${purchase.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Money value={purchase.totalCost} />
                    <form action={deletePurchase}>
                      <input type="hidden" name="id" value={purchase.id} />
                      <button
                        type="submit"
                        aria-label="Eliminar compra"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-300"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-line bg-background/60">
                      <tr>
                        <Th>Producto</Th>
                        <Th>Formato</Th>
                        <Th>Cant.</Th>
                        <Th>Costo unitario</Th>
                        <Th className="text-right">Línea</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {items.map((item) => (
                        <tr key={item.id}>
                          <Td className="text-white">{item.perfumeName}</Td>
                          <Td>{item.size} ml</Td>
                          <Td>{formatNumber(item.qty)}</Td>
                          <Td>{formatARS(item.unitCost)}</Td>
                          <Td className="text-right">
                            <Money value={item.line} />
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
