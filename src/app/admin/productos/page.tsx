import Link from "next/link";
import { getAdminProducts } from "@/lib/admin-data";
import { productImageUrl } from "@/lib/images";
import { deleteProduct } from "../actions";
import { formatARS } from "@/lib/format";
import { PageHeader, Th, Td } from "@/components/admin/ui";
import { PlusIcon, EditIcon, TrashIcon } from "@/components/icons";

function sizeBadge(price: number | null, size: string) {
  return price ? (
    <span className="rounded-md border border-line bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">
      {size} ml
    </span>
  ) : null;
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const products = getAdminProducts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Productos"
        description={`${products.length} productos en catálogo`}
      >
        <Link
          href="/admin/productos/nuevo"
          className="flex items-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo producto
        </Link>
      </PageHeader>

      {ok === "creado" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Producto creado correctamente.
        </p>
      )}
      {ok === "editado" && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          Cambios guardados.
        </p>
      )}
      {ok === "eliminado" && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          Producto eliminado.
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Faltan datos obligatorios (nombre y marca).
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-background/60">
              <tr>
                <Th>Producto</Th>
                <Th>Marca</Th>
                <Th>Medidas</Th>
                <Th>Precio desde</Th>
                <Th>Stock</Th>
                <Th>Flags</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {products.map((p) => {
                const from = [p.price30, p.price50, p.price100].find(
                  (v): v is number => v != null && v > 0
                );
                return (
                  <tr key={p.id} className="hover:bg-background/40">
                    <Td>
                      <Link
                        href={`/admin/productos/${p.id}`}
                        className="flex items-center gap-3"
                      >
                        <img
                          src={productImageUrl(p.image)}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg border border-line bg-background object-cover"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-white hover:text-gold">
                            {p.name}
                          </span>
                          <span className="block text-xs text-faint">
                            {p.slug}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{p.brandName}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {sizeBadge(p.price30, "30")}
                        {sizeBadge(p.price50, "50")}
                        {sizeBadge(p.price100, "100")}
                      </div>
                    </Td>
                    <Td>{from ? formatARS(from) : "—"}</Td>
                    <Td>
                      <span
                        className={
                          p.stock <= 0
                            ? "font-semibold text-red-300"
                            : p.stock <= 10
                              ? "font-semibold text-amber-300"
                              : "text-white"
                        }
                      >
                        {p.stock}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        {p.isNew && (
                          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                            Nuevo
                          </span>
                        )}
                        {p.bestSeller && (
                          <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold text-gold">
                            Destacado
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/admin/productos/${p.id}`}
                          aria-label={`Editar ${p.name}`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-line/40 hover:text-white"
                        >
                          <EditIcon className="h-4 w-4" />
                        </Link>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <button
                            type="submit"
                            aria-label={`Eliminar ${p.name}`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-300"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
