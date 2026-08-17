import { getExpenses, getExpensesTotal, getDashboardStats } from "@/lib/admin-data";
import { createExpense, deleteExpense } from "../actions";
import { EXPENSE_CATEGORIES } from "@/lib/types";
import { formatARS } from "@/lib/format";
import { PageHeader, StatCard, EmptyState, Money, Th, Td } from "@/components/admin/ui";
import { TrashIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-xl border border-line bg-background px-3.5 py-2.5 text-sm text-white placeholder:text-faint focus:border-gold focus:outline-none";

export default function AdminCajaPage() {
  const expenses = getExpenses();
  const stats = getDashboardStats();
  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((acc, e) => acc + e.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Caja" description="Gastos y resumen financiero" />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos del mes" value={formatARS(stats.monthRevenue)} accent />
        <StatCard label="Ganancia del mes" value={formatARS(stats.monthProfit)} accent />
        <StatCard
          label="Gastos del mes"
          value={formatARS(monthExpenses)}
          hint={`${expenses.filter((e) => e.date.startsWith(new Date().toISOString().slice(0, 7))).length} registros`}
        />
        <StatCard label="Gastos totales" value={formatARS(getExpensesTotal())} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <h2 className="mb-3 font-serif text-lg text-white">Gastos</h2>
          {expenses.length === 0 ? (
            <EmptyState message="No hay gastos cargados todavía." />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-line bg-background/60">
                    <tr>
                      <Th>Categoría</Th>
                      <Th>Descripción</Th>
                      <Th>Monto</Th>
                      <Th>Fecha</Th>
                      <Th className="text-right">{"\u00A0"}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-background/40">
                        <Td>
                          <span className="rounded-full border border-line bg-background px-2.5 py-0.5 text-xs capitalize text-muted">
                            {EXPENSE_CATEGORIES.find((c) => c.value === e.category)?.label ??
                              e.category}
                          </span>
                        </Td>
                        <Td className="text-white">{e.description}</Td>
                        <Td>
                          <Money value={e.amount} />
                        </Td>
                        <Td className="whitespace-nowrap text-muted">
                          {new Date(e.date).toLocaleDateString("es-AR")}
                        </Td>
                        <Td>
                          <form action={deleteExpense} className="flex justify-end">
                            <input type="hidden" name="id" value={e.id} />
                            <button
                              type="submit"
                              aria-label="Eliminar gasto"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-500/10 hover:text-red-300"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </form>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-serif text-lg text-white">Nuevo gasto</h2>
          <form
            action={createExpense}
            className="space-y-4 rounded-2xl border border-line bg-surface p-5"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Categoría
              </span>
              <select name="category" defaultValue="otros" className={inputCls}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                Descripción
              </span>
              <input name="description" placeholder="Ej: Pauta en Instagram" className={inputCls} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                  Monto
                </span>
                <input type="text" inputMode="decimal" name="amount" required placeholder="Ej: 15000" className={inputCls} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-muted">
                  Fecha
                </span>
                <input
                  type="date"
                  name="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className={inputCls}
                />
              </label>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-black transition hover:bg-gold/90"
            >
              Registrar gasto
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
