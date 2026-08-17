import Link from "next/link";
import {
  getDashboardStats,
  getOrders,
  getLowStockItems,
  getTopSellers,
} from "@/lib/admin-data";
import { formatARS, formatNumber } from "@/lib/format";
import { PageHeader, StatCard, StatusBadge, Money, Th, Td } from "@/components/admin/ui";

const today = new Date();

export default function AdminDashboardPage() {
  const stats = getDashboardStats();
  const recentOrders = getOrders(null, null).slice(0, 6);
  const lowStock = getLowStockItems().slice(0, 5);
  const topSellers = getTopSellers(5);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={today.toLocaleDateString("es-AR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ventas hoy"
          value={formatARS(stats.todaySales)}
          hint={`${stats.todayOrders} pedidos`}
          accent
        />
        <StatCard
          label="Ingresos del mes"
          value={formatARS(stats.monthRevenue)}
          hint={`${stats.monthOrders} pedidos`}
          accent
        />
        <StatCard
          label="Ganancia del mes"
          value={formatARS(stats.monthProfit)}
          hint={`Costos ${formatARS(stats.monthCost)} · Gastos ${formatARS(stats.monthExpenses)}`}
          accent
        />
        <StatCard
          label="Ticket promedio"
          value={formatARS(stats.averageTicket)}
          hint={`${formatNumber(stats.newCustomersMonth)} clientes nuevos este mes`}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/admin/pedidos?status=pendiente" className="group">
          <StatCard
            label="Pedidos pendientes"
            value={String(stats.pendingOrders)}
            hint="Revisar y avanzar"
          />
        </Link>
        <Link href="/admin/stock" className="group">
          <StatCard
            label="Stock bajo"
            value={String(stats.lowStock)}
            hint={`${stats.outOfStock} agotados`}
          />
        </Link>
        <StatCard
          label="Producto top"
          value={stats.topProduct?.name ?? "Sin ventas"}
          hint={
            stats.topProduct
              ? `${formatNumber(stats.topProduct.qty)} unidades vendidas`
              : "Aún no hay ventas"
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-serif text-lg text-white">Últimos pedidos</h2>
              <Link
                href="/admin/pedidos"
                className="text-xs font-semibold uppercase tracking-widest text-gold hover:underline"
              >
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-y border-line bg-background/60">
                  <tr>
                    <Th>Código</Th>
                    <Th>Cliente</Th>
                    <Th>Total</Th>
                    <Th>Estado</Th>
                    <Th>Fecha</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {recentOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted">
                        Sin pedidos todavía
                      </td>
                    </tr>
                  ) : (
                    recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-background/40">
                        <Td className="font-mono text-gold">{order.code}</Td>
                        <Td>{order.customerName}</Td>
                        <Td>
                          <Money value={order.total} />
                        </Td>
                        <Td>
                          <StatusBadge status={order.status} />
                        </Td>
                        <Td className="whitespace-nowrap text-muted">
                          {new Date(order.createdAt).toLocaleDateString("es-AR", {
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

        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-serif text-lg text-white">Top ventas</h2>
              <Link
                href="/admin/estadisticas"
                className="text-xs font-semibold uppercase tracking-widest text-gold hover:underline"
              >
                Ver más
              </Link>
            </div>
            <ul className="divide-y divide-line px-5">
              {topSellers.map((item, i) => (
                <li key={item.name} className="flex items-center gap-3 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-faint">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {item.name}
                  </span>
                  <span className="text-xs text-muted">
                    {formatNumber(item.units)} u.
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-line bg-surface">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-serif text-lg text-white">Stock crítico</h2>
              <Link
                href="/admin/stock"
                className="text-xs font-semibold uppercase tracking-widest text-gold hover:underline"
              >
                Gestionar
              </Link>
            </div>
            <ul className="divide-y divide-line px-5 pb-2">
              {lowStock.length === 0 ? (
                <li className="py-3 text-sm text-muted">Todo en orden</li>
              ) : (
                lowStock.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-white">
                      {item.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        item.stock <= 0
                          ? "bg-red-500/10 text-red-300"
                          : "bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {item.stock <= 0 ? "Agotado" : `${item.stock} u.`}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
