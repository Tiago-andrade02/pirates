// Mensaje de despacho para el cliente. Modulo puro (sin process.env ni fetch)
// para poder importarlo desde el servidor, desde un componente y desde los
// tests del runner node --test.

export interface DispatchOrderInfo {
  customerName: string;
  code: string;
  trackingNumber: string;
  trackingUrl: string;
}

// Cantidad y orden EXACTO de las variables de la plantilla de WhatsApp:
// {{1}} nombre, {{2}} pedido, {{3}} seguimiento, {{4}} enlace.
// Si cambia el orden acá, hay que recrear la plantilla aprobada en Meta:
// los parametros posicionales no llevan nombre y un desfasaje manda el dato
// equivocado al cliente.
export const DISPATCH_WHATSAPP_TEMPLATE_VARS = 4;

export interface DispatchMessageParams {
  name: string;
  code: string;
  tracking: string;
  link: string;
}

export function dispatchMessageParams(
  order: DispatchOrderInfo
): DispatchMessageParams {
  return {
    name: (order.customerName || "").trim() || "cliente",
    code: order.code,
    tracking: order.trackingNumber || "",
    link: order.trackingUrl || "",
  };
}

// Texto listo para pegar en WhatsApp (o prellenar un link wa.me). Corto, sin
// promesas que no podamos cumplir: solo informa el despacho y el seguimiento.
export function dispatchMessageText(order: DispatchOrderInfo): string {
  const { name, code, tracking, link } = dispatchMessageParams(order);
  const firstName = name.split(/\s+/)[0] || "cliente";
  const lines = [
    `¡Hola ${firstName}! Tu pedido ${code} de PIRATES ya fue despachado por Correo Argentino.`,
  ];
  if (tracking) {
    lines.push(`Código de seguimiento: ${tracking}`);
  }
  if (link) {
    lines.push(`Seguilo acá: ${link}`);
  }
  lines.push("Cualquier consulta, respondé este mensaje.");
  return lines.join("\n");
}

// Normaliza un telefono argentino al formato de WhatsApp (solo digitos con
// prefijo 549). Devuelve "" si no parece un numero valido, para no armar un
// link wa.me roto ni mandar un mensaje a un destinatario equivocado.
export function normalizeWhatsAppPhone(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  if (digits.startsWith("549")) {
    // Ya viene con pais + 9.
  } else if (digits.startsWith("54")) {
    digits = "549" + digits.slice(2);
  } else if (digits.startsWith("9")) {
    digits = "54" + digits;
  } else {
    digits = "549" + digits;
  }
  if (digits.length < 12 || digits.length > 15) return "";
  return digits;
}

export function waMeLink(phone: string, text: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}
