import {
  getDashboardStats,
  getMonthlyRevenue,
  getTopSellers,
  getTopBrands,
  getSalesByProvince,
  getRepeatCustomers,
} from "@/lib/admin-data";
import { formatARS, formatNumber } from "@/lib/format";
import { PageHeader, StatCard } from "@/components/admin/ui";

export default function AdminEstadisticasPage() {
  const stats = getDashboardStats();
  const monthly = getMonthlyRevenue(6);
  const topSellers = getTopSellers(8);
  const topBrands = getTopBrands(8);
  const byProvince = getSalesByProvince();
  const repeat = getRepeatCustomers();

  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);
  const maxBrand = Math.max(...topBrands.map((b) => b.revenue), 1);
  const repeatRate =
    repeat.totalCustomers > 0
      ? Math.round((repeat.repeatCustomers / repeat.totalCustomers) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Estadísticas" description="Métricas de ventas y rendimiento" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ticket promedio" value={formatARS(stats.averageTicket)} accent />
        <StatCard
          label="Recompra"
          value={`${repeatRate}%`}
          hint={`${repeat.repeatCustomers} de ${repeat.totalCustomers} clientes repiten`}
        />
        <StatCard label="Clientes nuevos / mes" value={String(stats.newCustomersMonth)} />
        <StatCard label="Ganancia neta / mes" value={formatARS(stats.monthProfit)} accent />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-6 font-serif text-lg text-white">Ingresos por mes</h2>
          <div className="flex h-56 items-end gap-3">
            {monthly.map((m) => (
              <div key={m.month} className="group flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-muted opacity-0 transition group-hover:opacity-100">
                  {formatARS(m.revenue)}
                </span>
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-gold/40 to-gold transition group-hover:from-gold/60 group-hover:to-gold"
                  style={{ height: `${Math.max((m.revenue / maxRevenue) * 100, 3)}%` }}
                />
                <span className="text-xs capitalize text-faint">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="mb-6 font-serif text-lg text-white">Ingresos por marca</h2>
          <div className="space-y-4">
            {topBrands.map((b) => (
              <div key={b.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-white">{b.name}</span>
                  <span className="text-muted">{formatARS(b.revenue)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-gold/80"
                    style={{ width: `${(b.revenue / maxBrand) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <h2 className="font-serif text-lg text-white">Top productos</h2>
          </div>
          <ul className="divide-y divide-line">
            {topSellers.map((item, i) => (
              <li key={item.name} className="flex items-center gap-3 px-6 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-faint">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{item.name}</span>
                <span className="text-xs text-muted">{formatNumber(item.units)} u.</span>
                <span className="text-xs text-muted">{formatARS(item.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line px-6 py-4">
            <h2 className="font-serif text-lg text-white">Ventas por provincia</h2>
          </div>
          <ul className="divide-y divide-line">
            {byProvince.length === 0 ? (
              <li className="px-6 py-10 text-center text-sm text-muted">Sin datos todavía</li>
            ) : (
              byProvince.map((p) => (
                <li key={p.province} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span className="text-white">{p.province}</span>
                  <span className="text-xs text-muted">
                    {p.orders} pedidos · {formatARS(p.revenue)}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
