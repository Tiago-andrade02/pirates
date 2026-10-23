// Mensaje de confirmacion de compra para el cliente (WhatsApp). Modulo puro (sin
// process.env ni fetch) para poder importarlo desde el servidor, desde un
// componente y desde los tests del runner node --test.

export interface OrderConfirmationOrderInfo {
  customerName: string;
  code: string;
  total: number;
  link: string;
}

// Cantidad y orden EXACTO de las variables de la plantilla de WhatsApp:
// {{1}} nombre, {{2}} pedido, {{3}} total, {{4}} enlace.
// Si cambia el orden aca, hay que recrear la plantilla aprobada en Meta: los
// parametros posicionales no llevan nombre y un desfasaje manda el dato
// equivocado al cliente.
export const ORDER_CONFIRM_WHATSAPP_TEMPLATE_VARS = 4;

export interface OrderConfirmationMessageParams {
  name: string;
  code: string;
  amount: string;
  link: string;
}

// Formatea igual que el resto del sitio: pesos ARS redondeados con separador de
// miles (p.ej. "$51.000").
function money(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-AR");
}

export function orderConfirmationMessageParams(
  order: OrderConfirmationOrderInfo
): OrderConfirmationMessageParams {
  return {
    name: (order.customerName || "").trim() || "cliente",
    code: order.code,
    amount: money(order.total),
    link: order.link || "",
  };
}

// Texto listo para previsualizar y testear. NO se manda por Graph API (Meta exige
// la plantilla aprobada): solo sirve para revisar el contenido sin enviar nada.
export function orderConfirmationMessageText(
  order: OrderConfirmationOrderInfo
): string {
  const { name, code, amount, link } = orderConfirmationMessageParams(order);
  const firstName = name.split(/\s+/)[0] || "cliente";
  const lines = [
    `¡Hola ${firstName}! Recibimos tu pago de la compra ${code} (${amount}) en PIRATES.`,
    "Tu pedido está confirmado y en producción.",
  ];
  if (link) {
    lines.push(`Seguilo desde acá: ${link}`);
  }
  lines.push("Cualquier consulta, respondé este mensaje.");
  return lines.join("\n");
}