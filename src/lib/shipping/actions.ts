"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { isAdmin } from "@/app/admin/actions";
import { getShippingProvider } from "./index";
import { computePackageForItems } from "./packages";
import { provinceCodeFor } from "./provinces";
import type { DeliveryType, TrackingEvent } from "@/lib/types";

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
  tracking_events: string;
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
              tracking_number, tracking_events
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
  const provider = getShippingProvider();

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

  const provider = getShippingProvider();
  let events: TrackingEvent[] = parseEvents(order.tracking_events);
  try {
    const result = await provider.getTracking(order.tracking_number);
    if (result.events.length > 0) {
      events = result.events;
    }
  } catch (error) {
    logError("refreshTracking", error);
  }

  const db = await getDb();
  await db.execute({
    sql: "UPDATE orders SET tracking_events = ? WHERE id = ?",
    args: [JSON.stringify(events), id],
  });

  orderPath(id);
  redirect(`/admin/pedidos?ok=tracking-actualizado&id=${id}`);
}

// Permite registrar el número de seguimiento asignado por Correo Argentino
// (la API /shipping/import no lo devuelve; aparece en el panel de MiCorreo).
export async function updateTrackingNumber(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const number = String(formData.get("tracking_number") ?? "").trim();
  if (!Number.isFinite(id) || !number) {
    redirect("/admin/pedidos");
  }

  const db = await getDb();
  await db.execute({
    sql: "UPDATE orders SET tracking_number = ? WHERE id = ?",
    args: [number, id],
  });

  orderPath(id);
  redirect(`/admin/pedidos?ok=tracking-registrado&id=${id}`);
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

  const provider = getShippingProvider();
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
