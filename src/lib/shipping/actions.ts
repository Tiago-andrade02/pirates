"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/app/admin/actions";
import { getOrderById } from "@/lib/admin-data";
import { getShippingProvider, getShippingProviderById } from "./index";
import { computePackageForItems } from "./packages";
import { provinceCodeFor } from "./provinces";
import {
  applyManualTracking,
  canNotifyDispatch,
  isValidTrackingNumber,
  manualTrackingBlockedReason,
  normalizeTrackingNumber,
  resolveTrackingUrlInput,
} from "./manual-tracking";
import { canNotifyCustomer, sendCustomerTrackingEmail } from "@/lib/notify";
import type { ShippingProvider, ShippingProviderId } from "./types";
import type { DeliveryType, OrderStatus, TrackingEvent } from "@/lib/types";

interface OrderRow {
  id: number;
  code: string;
  customer_id: number | null;
  status: string;
  subtotal: number;
  province: string;
  postal_code: string;
  locality: string;
  address_street: string;
  address_number: string;
  address_floor: string;
  address_apartment: string;
  delivery_type: string;
  agency_code: string;
  shipping_provider: string;
  shipping_service: string;
  tracking_number: string;
  tracking_url: string;
  tracking_events: string;
  shipped_at: string | null;
}

async function requireAdmin() {
  if (!(await isAdmin())) {
    redirect("/admin");
  }
}

async function getOrder(id: number): Promise<OrderRow | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id, code, customer_id, status, subtotal, province, postal_code, locality,
              address_street, address_number, address_floor, address_apartment,
              delivery_type, agency_code, shipping_provider, shipping_service,
              tracking_number, tracking_url, tracking_events, shipped_at
       FROM orders WHERE id = ?`,
    args: [id],
  });
  const row = result.rows[0] as unknown as OrderRow | undefined;
  return row ?? null;
}

function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[shipping/${context}]`, message);
}

function parseEvents(json: string): TrackingEvent[] {
  try {
    const parsed = JSON.parse(json) as TrackingEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function orderPath(id: number) {
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath("/admin");
}

// Resuelve el provider con el que se despachó el pedido (si ya hay uno) para
// operar tracking/cancelación de forma estable aunque la config cambie.
function providerFor(order: { shipping_provider: string }): ShippingProvider {
  if (order.shipping_provider) {
    return getShippingProviderById(order.shipping_provider as ShippingProviderId);
  }
  return getShippingProvider();
}

// Genera el envío en Correo Argentino una vez confirmado el pago.
// Idempotente: si el pedido ya fue despachado (shipping_provider set) no se
// vuelve a llamar a la API. Adicionalmente Correo Argentino rechaza el
// extOrderId duplicado ("La orden ya fue importada con anterioridad").
export async function createShipment(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/pedidos");

  const db = await getDb();
  const order = await getOrder(id);
  if (!order) redirect("/admin/pedidos");

  if (order.shipping_provider) {
    redirect(`/admin/pedidos?ok=ya-despachado&id=${id}`);
  }

  // El pago debe estar confirmado en el backend (nunca confiar en el cliente).
  if (!["pagado", "preparando"].includes(order.status)) {
    redirect(`/admin/pedidos?error=pago-no-confirmado&id=${id}`);
  }

  const provinceCode = provinceCodeFor(order.province);
  if (!provinceCode) {
    redirect(`/admin/pedidos?error=provincia-invalida&id=${id}`);
  }
  if (!order.postal_code) {
    redirect(`/admin/pedidos?error=cp-faltante&id=${id}`);
  }

  const itemsResult = await db.execute({
    sql: `SELECT p.slug, oi.qty
       FROM order_items oi
       JOIN perfumes p ON p.id = oi.perfume_id
       WHERE oi.order_id = ?`,
    args: [id],
  });
  const items = itemsResult.rows as unknown as { slug: string; qty: number }[];

  let pkg;
  try {
    pkg = await computePackageForItems(items);
  } catch (error) {
    logError("createShipment/package", error);
    redirect(`/admin/pedidos?error=empaque&id=${id}`);
  }

  const customerResult = await db.execute({
    sql: "SELECT name, email, phone FROM customers WHERE id = ?",
    args: [order.customer_id],
  });
  const customer = customerResult.rows[0] as unknown as { name: string; email: string | null; phone: string | null } | undefined;

  const deliveryType: DeliveryType = order.delivery_type === "S" ? "S" : "D";

  let provider;
  try {
    provider = getShippingProvider();
  } catch (error) {
    logError("createShipment/provider", error);
    redirect(`/admin/pedidos?error=despacho-fallido&id=${id}`);
  }

  let result;
  try {
    result = await provider.createShipment({
      extOrderId: order.code,
      orderNumber: String(order.id),
      recipient: {
        name: customer?.name ?? "Cliente",
        phone: customer?.phone ?? "",
        email: customer?.email ?? "",
      },
      deliveryType,
      agencyCode: deliveryType === "S" ? order.agency_code || undefined : undefined,
      address:
        deliveryType === "D"
          ? {
              streetName: order.address_street,
              streetNumber: order.address_number,
              floor: order.address_floor,
              apartment: order.address_apartment,
              city: order.locality || order.province,
              provinceCode,
              postalCode: order.postal_code,
            }
          : undefined,
      package: pkg,
      declaredValue: Math.round(order.subtotal),
      productType: order.shipping_service || "CP",
    });
  } catch (error) {
    logError("createShipment", error);
    redirect(`/admin/pedidos?error=despacho-fallido&id=${id}`);
  }

  await db.execute({
    sql: `UPDATE orders SET
       shipping_provider = ?, shipping_service = ?, tracking_number = ?,
       tracking_url = ?, shipped_at = ?, status = 'enviado'
     WHERE id = ?`,
    args: [
      result.provider,
      result.service,
      result.trackingNumber ?? "",
      result.trackingUrl ?? "",
      result.shippedAt,
      id,
    ],
  });

  orderPath(id);
  redirect(`/admin/pedidos?ok=despachado&id=${id}`);
}

// Consulta el estado real del envío en Correo Argentino y guarda los eventos.
export async function refreshTracking(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/pedidos");

  const order = await getOrder(id);
  if (!order) redirect("/admin/pedidos");
  if (!order.tracking_number) {
    redirect(`/admin/pedidos?error=sin-tracking&id=${id}`);
  }

  let provider;
  try {
    provider = providerFor(order);
  } catch (error) {
    logError("refreshTracking/provider", error);
  }
  let events: TrackingEvent[] = parseEvents(order.tracking_events);
  if (provider) {
    try {
      const result = await provider.getTracking(order.tracking_number);
      if (result.events.length > 0) {
        events = result.events;
      }
    } catch (error) {
      logError("refreshTracking", error);
    }
  }

  const db = await getDb();
  await db.execute({
    sql: "UPDATE orders SET tracking_events = ? WHERE id = ?",
    args: [JSON.stringify(events), id],
  });

  orderPath(id);
  redirect(`/admin/pedidos?ok=tracking-actualizado&id=${id}`);
}

// Permite registrar a mano el código de seguimiento de Correo Argentino.
//
// No se llama a ninguna API ni se requieren credenciales. El orden importa:
//   1. se calcula el cambio con lógica pura (manual-tracking.ts),
//   2. se PERSISTE el pedido (código, URL, fecha, estado y evento),
//   3. recién después se intenta avisar al cliente.
//
// Si el aviso falla, el seguimiento ya quedó guardado: se muestra el error de
// notificación en el panel pero no se pierden los datos. Si se vuelve a guardar
// el mismo código sin cambios, no se reescribe ni se vuelve a avisar.
export async function updateTrackingNumber(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/pedidos");

  const order = await getOrder(id);
  if (!order) redirect("/admin/pedidos");

  const trackingNumber = normalizeTrackingNumber(formData.get("tracking_number"));
  if (!isValidTrackingNumber(trackingNumber)) {
    redirect(`/admin/pedidos/${id}?error=tracking-invalido`);
  }

  const urlResolution = resolveTrackingUrlInput(formData.get("tracking_url"));
  if (!urlResolution.ok) {
    redirect(`/admin/pedidos/${id}?error=tracking-url-invalida`);
  }

  const now = new Date().toISOString();
  const result = applyManualTracking({
    trackingNumber,
    trackingUrl: urlResolution.value,
    currentNumber: order.tracking_number,
    currentUrl: order.tracking_url,
    currentShippedAt: order.shipped_at ?? null,
    currentEvents: parseEvents(order.tracking_events),
    currentStatus: order.status as OrderStatus,
    now,
  });

  // Pago no confirmado o estado terminal (pendiente/cancelado/sin_stock): no se
  // toca el pedido ni el stock. Se vuelve con el motivo para mostrarlo.
  if (!result.ok) {
    redirect(
      `/admin/pedidos/${id}?error=${manualTrackingBlockedReason(order.status as OrderStatus)}`
    );
  }

  // Sin cambios: no se toca el pedido ni se vuelve a avisar (evita duplicados).
  if (!result.changed) {
    redirect(`/admin/pedidos/${id}?ok=tracking-sin-cambios`);
  }

  const db = await getDb();
  await db.execute({
    sql: `UPDATE orders SET
       tracking_number = ?, tracking_url = ?, tracking_events = ?,
       shipping_provider = ?, shipping_service = ?, shipped_at = ?, status = ?
     WHERE id = ?`,
    args: [
      result.trackingNumber,
      result.trackingUrl,
      JSON.stringify(result.events),
      result.provider,
      result.service,
      result.shippedAt,
      result.status,
      id,
    ],
  });

  orderPath(id);
  revalidatePath(`/pedido/${order.code}`);

  if (!result.notifyCustomer) {
    redirect(`/admin/pedidos/${id}?ok=tracking-guardado`);
  }

  // El aviso va DESPUÉS del commit. Un fallo de SMTP no revierte el seguimiento.
  try {
    const fullOrder = await getOrderById(id);
    if (!fullOrder) throw new Error("no se pudo releer el pedido");
    await sendCustomerTrackingEmail(fullOrder);
  } catch (error) {
    logError("updateTrackingNumber/notify", error);
    redirect(`/admin/pedidos/${id}?error=aviso-seguimiento-fallido`);
  }

  redirect(`/admin/pedidos/${id}?ok=tracking-guardado`);
}

// Reenvía a mano el aviso de despacho al cliente.
//
// Solo para admins. Reutiliza el código y la URL YA guardados: no modifica el
// pedido, ni el estado, ni el stock, ni agrega eventos. Es la válvula de escape
// cuando el primer envío (SMTP caído, mail mal tipeado en el checkout) falló:
// el seguimiento queda intacto y el admin puede reintentar sin duplicar datos.
export async function resendTrackingEmail(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/pedidos");

  const order = await getOrder(id);
  if (!order) redirect("/admin/pedidos");

  if (!order.tracking_number) {
    redirect(`/admin/pedidos/${id}?error=sin-tracking`);
  }

  // No se dice "salió" de un pedido que no puede salir (pendiente/cancelado/
  // sin_stock/entregado). El estado no se toca, solo se bloquea el reenvío.
  if (!canNotifyDispatch(order.status as OrderStatus)) {
    redirect(`/admin/pedidos/${id}?error=aviso-no-permitido`);
  }

  const fullOrder = await getOrderById(id);
  if (!fullOrder) redirect("/admin/pedidos");

  if (!canNotifyCustomer(fullOrder)) {
    redirect(`/admin/pedidos/${id}?error=cliente-sin-email`);
  }

  // Reenvío: no se persiste nada antes ni después. Si SMTP falla, el pedido
  // sigue exactamente igual y el admin puede volver a intentar.
  try {
    await sendCustomerTrackingEmail(fullOrder);
  } catch (error) {
    logError("resendTrackingEmail/notify", error);
    redirect(`/admin/pedidos/${id}?error=aviso-reenvio-fallido`);
  }

  redirect(`/admin/pedidos/${id}?ok=aviso-seguimiento-enviado`);
}

// Cancelación de envío. La API oficial de Correo Argentino (MiCorreo) no
// expone un endpoint de cancelación, por lo que se informa y no se cambia el
// estado. Si el proveedor contratado lo permite, se llamará aquí.
export async function cancelShipment(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) redirect("/admin/pedidos");

  const order = await getOrder(id);
  if (!order) redirect("/admin/pedidos");

  let provider;
  try {
    provider = providerFor(order);
  } catch (error) {
    logError("cancelShipment/provider", error);
    redirect(`/admin/pedidos?error=cancelacion-fallida&id=${id}`);
  }

  if (provider.cancelShipment && order.tracking_number) {
    try {
      await provider.cancelShipment(order.tracking_number);
    } catch (error) {
      logError("cancelShipment", error);
      redirect(`/admin/pedidos?error=cancelacion-fallida&id=${id}`);
    }
  } else {
    redirect(`/admin/pedidos?ok=cancelacion-no-soportada&id=${id}`);
  }

  orderPath(id);
  redirect(`/admin/pedidos?ok=cancelado&id=${id}`);
}
