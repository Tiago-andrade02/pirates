import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode } from "@/lib/admin-data";
import { formatARS, formatNumber } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  DELIVERY_TYPE_LABELS,
  type OrderStatus,
  type TrackingEvent,
} from "@/lib/types";
import {
  TruckIcon,
  CheckIcon,
  StoreIcon,
  MapPinIcon,
  ArrowRightIcon,
  WhatsAppIcon,
} from "@/components/icons";

const CONTACT_MAIL = "pirates.arg@hotmail.com";
const CONTACT_WHATSAPP = "https://wa.me/5491172919482";

function Timeline({ events }: { events: TrackingEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.date > b.date ? -1 : 1));
  const delivered = sorted.some((e) => /entreg/i.test(e.event + " " + e.status));
  return (
    <div className="space-y-5">
      {delivered && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <CheckIcon className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-emerald-300">
            Tu pedido fue entregado. ¡Gracias por comprar con nosotros!
          </p>
        </div>
      )}
      {sorted.map((ev, i) => (
        <div key={i} className="relative flex gap-3">
          <span
            className={`mt-1.5 flex h-2.5 w-2.5 shrink-0 rounded-full border ${
              delivered && i === 0
                ? "border-emerald-400 bg-emerald-400/60"
                : "border-gold/60 bg-background"
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{ev.event}</p>
            <p className="text-xs text-muted">
              {new Date(ev.date).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {ev.branch ? ` · ${ev.branch}` : ""}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pendiente: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  pagado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  preparando: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  enviado: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  entregado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  cancelado: "border-red-500/40 bg-red-500/10 text-red-300",
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await getOrderByCode(code.trim().toUpperCase());
  if (!order || !ORDER_STATUSES.includes(order.status)) notFound();

  const statusStyle = STATUS_STYLES[order.status];
  const shipped = Boolean(order.shippingProvider);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-white">Tu pedido</h1>
          <p className="mt-1 text-sm text-muted">
            Código <span className="font-mono text-white">{order.code}</span> ·{" "}
            {new Date(order.createdAt).toLocaleDateString("es-AR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${statusStyle}`}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="flex items-center gap-2 font-serif text-xl text-white">
          <TruckIcon className="h-5 w-5 text-faint" />
          Seguimiento del envío
        </h2>

        {order.status === "cancelado" ? (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Este pedido fue cancelado. Si tenés dudas, escribinos por WhatsApp.
          </p>
        ) : !shipped ? (
          <div className="mt-4 rounded-xl border border-line bg-background p-4">
            <p className="text-sm leading-relaxed text-muted">
              {order.status === "pagado" || order.status === "preparando"
                ? "Tu pago fue confirmado. Estamos preparando y despachando tu pedido; en cuanto Correo Argentino lo reciba te vamos a mostrar el seguimiento acá."
                : "Estamos esperando la confirmación del pago para empezar a preparar tu pedido. Te avisaremos por WhatsApp cuando esté en camino."}
            </p>
          </div>
        ) : order.trackingNumber ? (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-background px-4 py-3">
              <span className="text-xs uppercase tracking-widest text-faint">
                Número de seguimiento
              </span>
              <span className="font-mono text-sm font-semibold text-white">
                {order.trackingNumber}
              </span>
              <a
                href="https://www.correoargentino.com.ar/formularios/seguimiento"
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-gold hover:underline"
              >
                Seguimiento oficial <ArrowRightIcon className="h-3 w-3" />
              </a>
            </div>
            {order.trackingEvents.length > 0 ? (
              <Timeline events={order.trackingEvents} />
            ) : (
              <p className="text-sm text-muted">
                Tu paquete ya fue entregado a Correo Argentino. Los movimientos del
                envío aparecerán acá cuando estén disponibles.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-line bg-background p-4">
            <p className="text-sm leading-relaxed text-muted">
              Tu pedido fue despachado con Correo Argentino. Estamos a la espera
              del número de seguimiento para mostrártelo acá. Te avisaremos por
              WhatsApp apenas esté disponible.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-serif text-xl text-white">Detalle</h2>
        <ul className="mt-5 space-y-3">
          {order.items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p className="text-white">{item.name}</p>
                <p className="text-xs text-faint">
                  {item.size ? `${item.size} ml · ` : ""}
                  {formatNumber(item.qty)} × {formatARS(item.price)}
                </p>
              </div>
              <p className="shrink-0 text-white">{formatARS(item.price * item.qty)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="text-white">{formatARS(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Envío</dt>
            <dd className="text-white">
              {order.shipping === 0 ? (
                <span className="text-emerald-400">Gratis</span>
              ) : (
                formatARS(order.shipping)
              )}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted">Modalidad</dt>
            <dd className="flex items-center gap-1.5 text-white">
              {order.deliveryType === "S" ? (
                <StoreIcon className="h-4 w-4 text-faint" />
              ) : (
                <MapPinIcon className="h-4 w-4 text-faint" />
              )}
              {DELIVERY_TYPE_LABELS[order.deliveryType]}
              {order.deliveryType === "S" && order.agencyCode
                ? ` · Suc. ${order.agencyCode}`
                : ""}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-5">
          <span className="text-sm font-semibold text-white">Total</span>
          <span className="font-serif text-2xl text-white">{formatARS(order.total)}</span>
        </div>
      </section>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <a
          href={`${CONTACT_WHATSAPP}?text=${encodeURIComponent(`Hola PIRATES, tengo una consulta sobre mi pedido ${order.code}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Escribinos por WhatsApp
        </a>
        <a
          href={`mailto:${CONTACT_MAIL}?subject=Pedido%20${encodeURIComponent(order.code)}`}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line px-7 text-sm font-semibold text-white transition-colors hover:bg-surface"
        >
          Escribinos por mail
        </a>
        <Link
          href="/perfumes"
          className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          Seguir explorando
        </Link>
      </div>
    </div>
  );
}
