import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/admin-data";
import { formatARS, formatNumber } from "@/lib/format";
import { DELIVERY_TYPE_LABELS } from "@/lib/types";
import { PageHeader, StatusBadge, Money, Th, Td } from "@/components/admin/ui";
import { StatusSelect } from "@/components/admin/StatusSelect";
import { ShippingCard } from "@/components/admin/ShippingCard";
import {
  resendOrderEmail,
  resendOrderWhatsApp,
  resendCustomerEmail,
  resendStockAlert,
  requireAdminPage,
} from "@/app/admin/actions";

// Mensajes de las server actions, indexados por el código que viaja en la URL.
// Un mapa y no una cadena de ternarios: son muchos códigos y anidarlos dejaba el
// bloque ilegible.
const MESSAGES: Record<string, string> = {
  // Éxitos
  "email-enviado": "Detalle enviado por email.",
  "whatsapp-enviado": "Aviso del pedido enviado por WhatsApp.",
  "email-cliente-enviado": "Confirmación reenviada al cliente.",
  "alerta-enviada": "Alerta de pedido sin stock reenviada.",
  "tracking-guardado":
    "Seguimiento guardado. Si el número es nuevo, se le avisó al cliente por email.",
  "tracking-sin-cambios":
    "El número de seguimiento es el mismo que ya estaba guardado y el enlace no cambió: no se modificó nada ni se reenvió el aviso.",
  "aviso-seguimiento-enviado": "Aviso de despacho reenviado al cliente.",
  // Errores de seguimiento
  "tracking-no-pagado":
    "No se cargó el seguimiento: el pago del pedido todavía no está confirmado.",
  "tracking-cancelado":
    "No se cargó el seguimiento: el pedido ya no va a salir.",
  "tracking-sin-stock":
    "No se cargó el seguimiento: el pedido ya no va a salir.",
  "tracking-estado-invalido":
    "No se puede cargar el seguimiento en el estado actual del pedido.",
  "tracking-invalido":
    "El número de seguimiento no es válido. Usá letras, números y guiones (máx. 40 caracteres).",
  "tracking-url-invalida":
    "La URL de seguimiento no es válida. Usá un enlace http/https o dejalo vacío.",
  "sin-tracking":
    "Este pedido no tiene número de seguimiento, así que no hay aviso de despacho para reenviar.",
  // Errores del aviso por WhatsApp
  "whatsapp-no-configurado":
    "WhatsApp no configurado. Cargá WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_TO en .env.local.",
  "whatsapp-aviso-no-permitido":
    "Este pedido no se puede anunciar como venta cobrada por WhatsApp: solo se avisa de pedidos pagos o en preparación.",
  "whatsapp-fallo":
    "No se pudo enviar el aviso por WhatsApp. La API no lo confirmó: puede ser credenciales, plantilla no aprobada o límite de la API. El pedido no se modificó.",
  // Errores de despacho con courier
  "sucursal-manual":
    "Este pedido va a una sucursal de Correo Argentino: no se genera el envío online. Coordiná la sucursal por WhatsApp con el cliente y cargá el tracking a mano.",
  "aviso-no-permitido":
    "No se puede enviar el aviso de despacho en el estado actual del pedido.",
  "aviso-seguimiento-fallido":
    "El seguimiento quedó guardado, pero no se pudo avisar al cliente por email. Revisá las credenciales SMTP: el código y la fecha no se perdieron.",
  "aviso-reenvio-fallido":
    "No se pudo reenviar el aviso de despacho. Revisá las credenciales SMTP y volvé a intentar.",
  // Errores de email
  "email-no-configurado":
    "Email no configurado. Cargá SMTP_HOST, SMTP_USER, SMTP_PASS y ORDER_NOTIFY_TO en .env.local.",
  "smtp-no-configurado":
    "Email no configurado. Cargá SMTP_HOST, SMTP_USER y SMTP_PASS en .env.local.",
  "email-fallo": "No se pudo enviar el email. Revisá las credenciales SMTP.",
  "cliente-sin-email":
    "Este pedido no tiene email de cliente, así que no se le puede escribir.",
  "cliente-no-pagado":
    "Solo se envía la confirmación al cliente cuando el pedido está pagado.",
  "pedido-no-sin-stock":
    "Este pedido no quedó sin stock, así que no hay alerta que reenviar.",
};

export default async function DetallePedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderById(Number(id));
  if (!order) notFound();

  const message = MESSAGES[sp.ok ?? ""] ?? MESSAGES[sp.error ?? ""] ?? null;

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
      value: DELIVERY_TYPE_LABELS[order.deliveryType],
    },
    // En la modalidad sucursal el destino NO es una dirección: es la sucursal que
    // el cliente prefiere, si escribió alguna, o un recordatorio de que hay que
    // coordinarla por WhatsApp.
    ...(order.deliveryType === "S"
      ? [
          {
            label: "Sucursal preferida",
            value: order.preferredBranch || "No escribió ninguna — a coordinar por WhatsApp",
          },
        ]
      : [
          {
            label: "Destino",
            value:
              [order.addressStreet, order.addressNumber].filter(Boolean).join(" ") ||
              "—",
          },
        ]),
    ...(order.customerNotes
      ? [{ label: "Observaciones del cliente", value: order.customerNotes }]
      : []),
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

          <div className="space-y-2 rounded-2xl border border-line bg-surface p-5">
            <h2 className="font-serif text-lg text-white">Notificaciones</h2>
            <p className="text-xs leading-relaxed text-muted">
              Los avisos automáticos se envían una sola vez al confirmarse el pago. Si
              alguno falló, podés reenviarlo desde acá.
            </p>
            <form action={resendOrderEmail}>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                className="block w-full rounded-xl bg-gold px-4 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-gold/90"
              >
                Reenviar detalle al admin
              </button>
            </form>
            <form action={resendOrderWhatsApp}>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                disabled={order.status !== "pagado" && order.status !== "preparando"}
                className="block w-full rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reenviar aviso por WhatsApp
              </button>
            </form>
            <form action={resendCustomerEmail}>
              <input type="hidden" name="id" value={order.id} />
              <button
                type="submit"
                disabled={order.status !== "pagado"}
                className="block w-full rounded-xl border border-line px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:border-white/40 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reenviar confirmación al cliente
              </button>
            </form>
            {order.status === "sin_stock" && (
              <form action={resendStockAlert}>
                <input type="hidden" name="id" value={order.id} />
                <button
                  type="submit"
                  className="block w-full rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2.5 text-center text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                >
                  Reenviar alerta sin stock
                </button>
              </form>
            )}
          </div>

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
