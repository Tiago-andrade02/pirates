// Aviso de NUEVO PEDIDO para el WhatsApp del negocio (no el del cliente).
//
// Módulo puro (sin process.env ni fetch) para poder testear el contenido y el
// ORDEN de los campos sin tocar la API.
//
// Los campos van agrupados en 5 bloques, no uno por dato. Las plantillas de
// WhatsApp usan variables POSICIONALES ({{1}}, {{2}}...): un bloque por dato
// multiplica las chances de que en Meta quede un {{n}}corrido y el negocio
// reciba el teléfono donde debía ir el total. Con 5 bloques, cada uno se lee
// completo y un desfaste se ve enseguida.
import { DELIVERY_TYPE_LABELS, type Order } from "./types.ts";

// Cantidad y orden EXACTO de las variables de la plantilla. Si cambia el cuerpo
// de la plantilla en Meta hay que cambiar esto con el mismo orden.
export const ADMIN_ORDER_WHATSAPP_TEMPLATE_VARS = 5;

// Límite por parámetro de texto de WhatsApp. Se recorta en vez de dejar que la
// API lo rechace: un pedido con muchos productos no puede dejar al negocio sin
// aviso.
const MAX_PARAM_CHARS = 900;

function money(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-AR");
}

// Nunca un campo vacío: un parámetro en blanco hace fallar el envío entero.
function dash(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? "-" : trimmed;
}

function clip(value: string): string {
  if (value.length <= MAX_PARAM_CHARS) return value;
  return value.slice(0, MAX_PARAM_CHARS - 3) + "...";
}

export function orderAddressLine(order: Order): string {
  const street = [order.addressStreet, order.addressNumber].filter(Boolean).join(" ");
  const extras = [
    street,
    order.addressFloor ? `Piso ${order.addressFloor}` : "",
    order.addressApartment ? `Dpto ${order.addressApartment}` : "",
  ].filter(Boolean);
  return extras.join(", ");
}

function productsBlock(order: Order): string {
  const lines = order.items.map(
    (i) =>
      `• ${i.name}${i.size ? ` ${i.size} ml` : ""} x${i.qty} — ${money(i.price * i.qty)} (${money(i.price)} c/u)`
  );
  return lines.length > 0 ? lines.join("\n") : "• (sin productos)";
}

function shippingBlock(order: Order): string {
  const lines = [`Modalidad: ${DELIVERY_TYPE_LABELS[order.deliveryType]}`];
  lines.push(`CP: ${dash(order.postalCode)}`);
  lines.push(`Localidad: ${dash(order.locality)} | Provincia: ${dash(order.province)}`);
  if (order.deliveryType === "S") {
    // En sucursal no hay dirección: se coordina por WhatsApp. Se distingue "no
    // escribió ninguna" de "no la conocemos todavía", porque el admin tiene que
    // saber si tiene que preguntar.
    lines.push(
      `Sucursal preferida: ${order.preferredBranch ? dash(order.preferredBranch) : "(no escribió ninguna, a coordinar)"}`
    );
  } else {
    lines.push(`Dirección: ${dash(orderAddressLine(order))}`);
  }
  return lines.join("\n");
}

export interface AdminOrderMessageParams {
  customer: string;
  contact: string;
  order: string;
  shipping: string;
  notes: string;
}

export function adminOrderMessageParams(order: Order): AdminOrderMessageParams {
  return {
    customer: dash(order.customerName),
    contact: `Tel: ${dash(order.customerPhone)} | Email: ${dash(order.customerEmail)}`,
    order: clip(
      [
        `Codigo: ${order.code}`,
        productsBlock(order),
        `Total: ${money(order.total)} (envio ${money(order.shipping)})`,
      ].join("\n")
    ),
    shipping: clip(shippingBlock(order)),
    notes: clip(dash(order.customerNotes)),
  };
}

// El mismo contenido en texto plano. Sirve para tests y para que el admin pueda
// ver exactamente lo que se va a mandar.
export function adminOrderMessageText(order: Order): string {
  const p = adminOrderMessageParams(order);
  return [
    "NUEVO PEDIDO PIRATES",
    `Cliente: ${p.customer}`,
    p.contact,
    p.order,
    p.shipping,
    `Observaciones: ${p.notes}`,
  ].join("\n");
}