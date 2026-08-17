import {
  createShipment,
  refreshTracking,
  updateTrackingNumber,
  cancelShipment,
} from "@/lib/shipping/actions";
import {
  DELIVERY_TYPE_LABELS,
  type Order,
  type TrackingEvent,
} from "@/lib/types";
import { formatARS } from "@/lib/format";
import { TruckIcon, BoxIcon, ArrowRightIcon } from "@/components/icons";

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

export function ShippingCard({ order }: { order: Order }) {
  const notShipped = !order.shippingProvider;
  const canDispatch =
    notShipped && (order.status === "pagado" || order.status === "preparando");

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
            <dd className="text-right capitalize text-white">{order.province}</dd>
          </div>
          {order.postalCode && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">CP</dt>
              <dd className="text-right text-white">{order.postalCode}</dd>
            </div>
          )}
          {order.deliveryType === "S" ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Sucursal</dt>
              <dd className="text-right font-mono text-white">
                {order.agencyCode || "—"}
              </dd>
            </div>
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Dirección</dt>
                <dd className="text-right text-white">
                  {order.addressStreet} {order.addressNumber}
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
            </>
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
        <h2 className="mb-4 font-serif text-lg text-white">Despacho</h2>

        {notShipped ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-line bg-background p-3 text-xs leading-relaxed text-muted">
              El pedido todavía no fue despachado. Cuando el pago esté confirmado
              y el paquete esté armado, generá el envío con Correo Argentino.
            </p>
            {canDispatch ? (
              <form action={createShipment}>
                <input type="hidden" name="id" value={order.id} />
                <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-neutral-200">
                  <BoxIcon className="h-4 w-4" />
                  Despachar con Correo Argentino
                </button>
              </form>
            ) : (
              <p className="text-xs text-faint">
                El despacho se habilita cuando el pedido está pagado o en preparación.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-muted">
                Servicio:{" "}
                <span className="font-medium text-white">
                  {order.shippingService || "—"}
                </span>
              </span>
              {order.shippedAt && (
                <span className="text-muted">
                  Despachado:{" "}
                  <span className="font-medium text-white">
                    {new Date(order.shippedAt).toLocaleString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              )}
            </div>

            {order.trackingNumber ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-background px-3 py-2.5">
                <span className="text-xs uppercase tracking-widest text-faint">
                  Tracking
                </span>
                <span className="font-mono text-sm font-semibold text-white">
                  {order.trackingNumber}
                </span>
                {order.trackingUrl && (
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-gold hover:underline"
                  >
                    Seguir en la web <ArrowRightIcon className="h-3 w-3" />
                  </a>
                )}
              </div>
            ) : (
              <form action={updateTrackingNumber} className="space-y-2">
                <p className="text-xs text-muted">
                  Correo Argentino asigna el número de seguimiento en el panel de
                  MiCorreo. Registralo acá para poder consultar el estado.
                </p>
                <div className="flex gap-2">
                  <input
                    type="hidden"
                    name="id"
                    value={order.id}
                  />
                  <input
                    name="tracking_number"
                    required
                    placeholder="Ej: 123456789AR"
                    className={inputCls}
                  />
                  <button className="h-10 shrink-0 rounded-xl border border-line px-4 text-sm font-semibold text-white transition hover:bg-line/40">
                    Guardar
                  </button>
                </div>
              </form>
            )}

            <div className="flex flex-wrap gap-2">
              {order.trackingNumber && (
                <form action={refreshTracking}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="inline-flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-white transition hover:bg-line/40">
                    Actualizar seguimiento
                  </button>
                </form>
              )}
              <form action={cancelShipment}>
                <input type="hidden" name="id" value={order.id} />
                <button className="inline-flex h-10 items-center rounded-xl border border-red-500/30 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/10">
                  Cancelar envío
                </button>
              </form>
            </div>

            {order.trackingEvents.length > 0 && (
              <div className="rounded-xl border border-line bg-background p-4">
                <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-faint">
                  Seguimiento del paquete
                </h3>
                <TrackingTimeline events={order.trackingEvents} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
