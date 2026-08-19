import Link from "next/link";
import { getOrders } from "@/lib/admin-data";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { PageHeader, Money, Th, Td } from "@/components/admin/ui";
import { StatusSelect } from "@/components/admin/StatusSelect";

const inputCls =
  "rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white focus:border-gold focus:outline-none";

const OK_MESSAGES: Record<string, string> = {
  estado: "Estado actualizado.",
  despachado: "Envío generado con Correo Argentino.",
  "ya-despachado": "El pedido ya había sido despachado.",
  "tracking-actualizado": "Seguimiento actualizado.",
  "tracking-registrado": "Número de seguimiento registrado.",
  cancelado: "Envío cancelado.",
  "cancelacion-no-soportada":
    "Correo Argentino no permite cancelar envíos por API. Se debe gestionar desde el panel de MiCorreo.",
};

const ERROR_MESSAGES: Record<string, string> = {
  "pago-no-confirmado":
    "El pago del pedido no está confirmado. Solo se despachan pedidos pagados o en preparación.",
  "provincia-invalida": "La provincia del pedido no es válida para Correo Argentino.",
  "cp-faltante": "El pedido no tiene código postal.",
  empaque: "No se pudo calcular el empaque del pedido.",
  "despacho-fallido":
    "Correo Argentino rechazó el envío. Revisá los datos del pedido y las credenciales.",
  "sin-tracking": "El pedido todavía no tiene número de seguimiento.",
  "cancelacion-fallida": "No se pudo cancelar el envío. Intentalo de nuevo.",
};

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const status = (ORDER_STATUSES.includes(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : null) as OrderStatus | null;
  const q = sp.q?.trim() || null;
  const orders = await getOrders(status, q);

  const okMessage = sp.ok ? OK_MESSAGES[sp.ok] : null;
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos" description={`${orders.length} pedidos`} />

      {okMessage && (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {okMessage}
        </p>
      )}
      {errorMessage && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      <form method="GET" className="flex flex-wrap items-center gap-3">
        <select name="status" defaultValue={status ?? ""} className={inputCls}>
          <option value="">Todos los estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por código, cliente o provincia"
          className={`${inputCls} min-w-56 flex-1`}
        />
        <button
          type="submit"
          className="rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90"
        >
          Filtrar
        </button>
        {(status || q) && (
          <Link
            href="/admin/pedidos"
            className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted transition hover:bg-line/40 hover:text-white"
          >
            Limpiar
          </Link>
        )}
      </form>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-background/60">
              <tr>
                <Th>Código</Th>
                <Th>Cliente</Th>
                <Th>Provincia</Th>
                <Th>Envio</Th>
                <Th>Total</Th>
                <Th>Pago</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted">
                    No hay pedidos con esos filtros
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-background/40">
                    <Td>
                      <Link
                        href={`/admin/pedidos/${o.id}`}
                        className="font-mono font-semibold text-gold hover:underline"
                      >
                        {o.code}
                      </Link>
                    </Td>
                    <Td>
                      <span className="block">{o.customerName}</span>
                      {o.customerEmail && (
                        <span className="block text-xs text-faint">{o.customerEmail}</span>
                      )}
                    </Td>
                    <Td>{o.province || "—"}</Td>
                    <Td>
                      <span className="block text-xs">
                        {o.deliveryType === "S" ? "Sucursal" : "Domicilio"}
                      </span>
                      {o.trackingNumber ? (
                        <span className="block font-mono text-[11px] text-gold">
                          {o.trackingNumber}
                        </span>
                      ) : o.shippingProvider ? (
                        <span className="block text-[11px] text-faint">Sin tracking</span>
                      ) : null}
                    </Td>
                    <Td>
                      <Money value={o.total} />
                    </Td>
                    <Td className="text-xs capitalize">{o.paymentMethod}</Td>
                    <Td>
                      <StatusSelect id={o.id} current={o.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {new Date(o.createdAt).toLocaleDateString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
