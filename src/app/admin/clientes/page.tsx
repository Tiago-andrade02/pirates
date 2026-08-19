import { getCustomers } from "@/lib/admin-data";
import { PageHeader, Money, Th, Td } from "@/components/admin/ui";

export default async function AdminClientesPage() {
  const customers = await getCustomers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${customers.length} clientes registrados`}
      />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-background/60">
              <tr>
                <Th>Cliente</Th>
                <Th>Contacto</Th>
                <Th>Provincia</Th>
                <Th>Pedidos</Th>
                <Th>Total gastado</Th>
                <Th>Último pedido</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                    Aún no hay clientes registrados
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-background/40">
                    <Td className="font-medium text-white">{c.name}</Td>
                    <Td>
                      {c.email && <span className="block text-xs">{c.email}</span>}
                      {c.phone && <span className="block text-xs text-faint">{c.phone}</span>}
                      {!c.email && !c.phone && <span className="text-faint">—</span>}
                    </Td>
                    <Td>{c.province || "—"}</Td>
                    <Td>{c.ordersCount}</Td>
                    <Td>
                      <Money value={c.totalSpent} />
                    </Td>
                    <Td className="whitespace-nowrap text-muted">
                      {c.lastOrderAt
                        ? new Date(c.lastOrderAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })
                        : "—"}
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
