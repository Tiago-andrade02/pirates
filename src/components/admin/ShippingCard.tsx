import { updateTrackingNumber, resendTrackingEmail } from "@/lib/shipping/actions";
import {
  canManualTrack,
  canNotifyDispatch,
  safeTrackingHref,
  MANUAL_TRACKING_BLOCKED_MESSAGE,
} from "@/lib/shipping/manual-tracking";
import {
  DELIVERY_TYPE_LABELS,
  ORDER_STATUS_LABELS,
  type Order,
  type TrackingEvent,
} from "@/lib/types";
import { formatARS } from "@/lib/format";
import { TruckIcon, ArrowRightIcon } from "@/components/icons";

const inputCls =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-white placeholder:text-faint focus:border-gold focus:outline-none";

function TrackingTimeline({ events }: { events: TrackingEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.date > b.date ? -1 : 1));
  return (
    <ol className="space-y-4">
      {sorted.map((ev, i) => (
        <li key={i} className="relative flex gap-3 pl-1">
          <span className="mt-1.5 flex h-2.5 w-2.5 shrink-0 rounded-full border border-gold/60 bg-background" />
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
        </li>
      ))}
    </ol>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShippingCard({ order }: { order: Order }) {
  const hasTracking = Boolean(order.trackingNumber);
  // El enlace que ve el cliente: el cargado a mano o, si no hay, el oficial. Si
  // la URL guardada no es http/https (fila histórica/importada), queda null y no
  // se genera el enlace.
  const trackingHref = safeTrackingHref(order.trackingUrl);
  // Solo se puede cargar/corregir el seguimiento de un pedido que puede salir
  // (pagado/preparando/enviado/entregado). Un pedido pendiente, cancelado o sin
  // stock no admite seguimiento ni aviso de despacho.
  const allowTracking = canManualTrack(order.status);
  const allowResend = canNotifyDispatch(order.status);
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 flex items-center gap-2 font-serif text-lg text-white">
          <TruckIcon className="h-5 w-5 text-faint" />
          Envío
        </h2>

        <dl className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Modalidad</dt>
            <dd className="text-right text-white">
              {DELIVERY_TYPE_LABELS[order.deliveryType]}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Provincia</dt>
            <dd className="text-right capitalize text-white">
              {order.province || "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Dirección</dt>
            <dd className="text-right text-white">
              {[order.addressStreet, order.addressNumber].filter(Boolean).join(" ") ||
                "—"}
              {order.addressFloor ? ` · Piso ${order.addressFloor}` : ""}
              {order.addressApartment ? ` · Dpto ${order.addressApartment}` : ""}
            </dd>
          </div>
          {order.locality && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Localidad</dt>
              <dd className="text-right text-white">{order.locality}</dd>
            </div>
          )}
          {order.postalCode && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">CP</dt>
              <dd className="text-right text-white">{order.postalCode}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Costo</dt>
            <dd className="text-right text-white">
              {order.shipping === 0 ? "Gratis" : formatARS(order.shipping)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-4 font-serif text-lg text-white">Seguimiento</h2>

        {hasTracking ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-muted">
                Estado del envío:{" "}
                <span className="font-medium text-white">
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </span>
              <span className="text-muted">
                Despachado:{" "}
                <span className="font-medium text-white">
                  {formatDate(order.shippedAt)}
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-line bg-background px-3 py-2.5">
              <span className="text-xs uppercase tracking-widest text-faint">
                Tracking
              </span>
              <span className="font-mono text-sm font-semibold text-white">
                {order.trackingNumber}
              </span>
              {trackingHref && (
                <a
                  href={trackingHref}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs text-gold hover:underline"
                >
                  Seguir en la web <ArrowRightIcon className="h-3 w-3" />
                </a>
              )}
            </div>

            {allowResend && (
              <form action={resendTrackingEmail}>
                <input type="hidden" name="id" value={order.id} />
                <button className="h-10 rounded-xl border border-line px-4 text-sm font-semibold text-white transition hover:bg-line/40">
                  Reenviar aviso de despacho
                </button>
              </form>
            )}

            {allowTracking ? (
              <details className="rounded-xl border border-line bg-background p-3">
                <summary className="cursor-pointer text-xs font-semibold text-white">
                  Editar número / URL de seguimiento
                </summary>
                <form action={updateTrackingNumber} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={order.id} />
                  <input
                    name="tracking_number"
                    required
                    defaultValue={order.trackingNumber}
                    placeholder="Ej: 123456789AR"
                    className={inputCls}
                  />
                  <input
                    name="tracking_url"
                    type="url"
                    defaultValue={order.trackingUrl}
                    placeholder="URL de seguimiento (opcional)"
                    className={inputCls}
                  />
                  <p className="text-[11px] leading-relaxed text-faint">
                    Si la dejás vacía se usa el enlace oficial de Correo Argentino.
                    Recién guardado, si el número cambia se le avisa al cliente por
                    email; si es el mismo, no se reenvía nada.
                  </p>
                  <button className="h-10 rounded-xl border border-line px-4 text-sm font-semibold text-white transition hover:bg-line/40">
                    Guardar seguimiento
                  </button>
                </form>
              </details>
            ) : (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
                {MANUAL_TRACKING_BLOCKED_MESSAGE}
              </p>
            )}

            {order.trackingEvents.length > 0 && (
              <div className="rounded-xl border border-line bg-background p-4">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-faint">
                  Historial del envío
                </h3>
                <TrackingTimeline events={order.trackingEvents} />
              </div>
            )}
          </div>
        ) : allowTracking ? (
          <form action={updateTrackingNumber} className="space-y-3">
            <input type="hidden" name="id" value={order.id} />
            <p className="rounded-xl border border-line bg-background p-3 text-xs leading-relaxed text-muted">
              Cargá a mano el número de seguimiento de Correo Argentino. Al
              guardarlo, el pedido queda marcado como despachado, se registra la
              fecha y se agrega el evento de despacho al historial. Si el número es
              nuevo, se le avisa al cliente por email.
            </p>
            <div className="space-y-2">
              <input
                name="tracking_number"
                required
                placeholder="Ej: 123456789AR"
                className={inputCls}
              />
              <input
                name="tracking_url"
                type="url"
                placeholder="URL de seguimiento (opcional)"
                className={inputCls}
              />
              <button className="h-10 w-full rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200">
                Guardar seguimiento
              </button>
            </div>
          </form>
        ) : (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-300">
            {MANUAL_TRACKING_BLOCKED_MESSAGE}
          </p>
        )}
      </div>
    </div>
  );
}
