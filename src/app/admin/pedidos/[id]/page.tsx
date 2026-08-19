import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/admin-data";
import { formatARS, formatNumber } from "@/lib/format";
import { PageHeader, StatusBadge, Money, Th, Td } from "@/components/admin/ui";
import { StatusSelect } from "@/components/admin/StatusSelect";
import { ShippingCard } from "@/components/admin/ShippingCard";
import { resendOrderEmail } from "@/app/admin/actions";

export default async function DetallePedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderById(Number(id));
  if (!order) notFound();

  const message =
    sp.ok === "email-enviado"
      ? "Detalle enviado por email."
      : sp.error === "email-no-configurado"
        ? "Email no configurado. Cargá SMTP_HOST, SMTP_USER, SMTP_PASS y ORDER_NOTIFY_TO en .env.local."
        : sp.error === "email-fallo"
          ? "No se pudo enviar el email. Revisá las credenciales SMTP."
          : null;

  const detail = [
    { label: "Cliente", value: order.customerName },
    { label: "Email", value: order.customerEmail ?? "—" },
    { label: "Provincia", value: order.province || "—" },
    {
      label: "CP / Localidad",
      value: [order.postalCode, order.locality].filter(Boolean).join(" · ") || "—",
    },
    {
      label: "Modalidad",
      value: order.deliveryType === "S" ? "Retiro en sucursal" : "A domicilio",
    },
    {
      label: "Destino",
      value:
        order.deliveryType === "S"
          ? order.agencyCode || "—"
          : [order.addressStreet, order.addressNumber].filter(Boolean).join(" ") ||
            "—",
    },
    { label: "Método de pago", value: order.paymentMethod },
    { label: "Fecha", value: new Date(order.createdAt).toLocaleString("es-AR") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pedido ${order.code}`}
        description={`#${order.id} · ${order.customerName}`}
      >
        <StatusBadge status={order.status} />
      </PageHeader>

      {message && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            sp.ok
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-serif text-lg text-white">Productos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-background/60">
                  <tr>
                    <Th>Producto</Th>
                    <Th>Tamaño</Th>
                    <Th>Cant.</Th>
                    <Th>Precio</Th>
                    <Th className="text-right">Subtotal</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <Td className="font-medium text-white">{item.name}</Td>
                      <Td>{item.size ? `${item.size} ml` : "—"}</Td>
                      <Td>{formatNumber(item.qty)}</Td>
                      <Td>{formatARS(item.price)}</Td>
                      <Td className="text-right">
                        <Money value={item.price * item.qty} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 px-5 py-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{formatARS(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Envío</span>
                <span>{formatARS(order.shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-white">
                <span>Total</span>
                <Money value={order.total} />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-4 font-serif text-lg text-white">Datos</h2>
            <dl className="space-y-3 text-sm">
              {detail.map((d) => (
                <div key={d.label}>
                  <dt className="text-xs uppercase tracking-widest text-faint">{d.label}</dt>
                  <dd className="mt-0.5 capitalize text-white">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-3 font-serif text-lg text-white">Estado</h2>
            <StatusSelect id={order.id} current={order.status} />
          </div>

          <ShippingCard order={order} />

          <form action={resendOrderEmail}>
            <input type="hidden" name="id" value={order.id} />
            <button
              type="submit"
              className="block w-full rounded-xl bg-gold px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-gold/90"
            >
              Reenviar detalle por email
            </button>
          </form>

          <Link
            href="/admin/pedidos"
            className="block rounded-xl border border-line px-4 py-2.5 text-center text-sm text-muted transition hover:bg-line/40 hover:text-white"
          >
            ← Volver a pedidos
          </Link>
        </div>
      </div>
    </div>
  );
}
