import nodemailer from "nodemailer";
// Las extensiones son explicitas porque los tests del runner node --test
// importan este archivo directamente y Node no resuelve rutas sin extensión.
import type { Order } from "./types.ts";
import { ORDER_STATUS_LABELS, DELIVERY_TYPE_LABELS } from "./types.ts";
import { planNotifications, type NotificationPlan } from "./notification-plan.ts";
import { isValidEmail } from "./email-validation.ts";
import { adminOrderMessageParams } from "./order-message.ts";
import { OFFICIAL_CORREO_ARGENTINO_TRACKING_URL } from "./shipping/manual-tracking.ts";
import {
  dispatchMessageParams,
  normalizeWhatsAppPhone,
} from "./shipping/dispatch-message.ts";

function money(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-AR");
}

// Escapa HTML en valores controlados por el usuario (nombre, tel/email,
// provincia, direccion, tamanos). Sin esto, un dato tipo "<img src=x onerror=...>"
// o "A&B" en linea de un pedido se inyecta como HTML en el correo de
// notificacion (HTML injection expuesta al admin que recibe el email).
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function deliveryLabel(order: Order): string {
  // Nunca se imprime el código interno de agencia: no es una sucursal real y
  // confunde al comprador. Para la modalidad sucursal sí se muestra la sucursal
  // que el propio cliente escribió (texto libre), o se avisa que hay que
  // coordinarla.
  if (order.deliveryType === "S") {
    const branch = (order.preferredBranch ?? "").trim();
    return branch
      ? `${DELIVERY_TYPE_LABELS.S}: ${branch}`
      : `${DELIVERY_TYPE_LABELS.S} (a coordinar por WhatsApp)`;
  }
  const street = [order.addressStreet, order.addressNumber]
    .filter(Boolean)
    .join(" ");
  return `${DELIVERY_TYPE_LABELS.D}: ${street || "-"}`;
}

function statusLabel(order: Order): string {
  return ORDER_STATUS_LABELS[order.status] ?? order.status;
}

function paymentMethodLabel(order: Order): string {
  const method = order.paymentMethod.trim().toLowerCase();
  if (method === "mercadopago" || method === "") return "Mercado Pago";
  return order.paymentMethod;
}

// ---------------------------------------------------------------------------
// Envio de correo
// ---------------------------------------------------------------------------

// Credenciales SMTP. No incluye ORDER_NOTIFY_TO: el email al cliente no necesita
// ningun destinatario de administracion, asi que esa clave se chequea aparte.
export function hasSmtpConfig(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

// Configuracion completa del aviso al administrador. La mantiene el panel admin
// para decidir si mostrar el boton de reenvio manual.
export function hasEmailConfig(): boolean {
  return hasSmtpConfig() && Boolean(process.env.ORDER_NOTIFY_TO);
}

// Resuelve el modo de cifrado a partir del puerto y del valor de SMTP_SECURE.
// Vive suelto y exportado para que el diagnostico SMTP muestre exactamente el
// modo con el que se va a enviar de verdad. Si se duplicara la regla, el
// diagnostico podria decir STARTTLS mientras el envio real usa otra cosa.
export function resolveSmtpSecure(port: number, secureValue: string | undefined): boolean {
  const raw = (secureValue ?? "").trim();
  return raw.toLowerCase() === "true" || (raw === "" && port === 465);
}

// SMTP_SECURE solo debe ser true para TLS implicito (465). Con 587 el
// cifrado se negocia por STARTTLS y secure debe ser false: ponerlo en true
// hace que nodemailer intente TLS implicito en un puerto que no lo soporta y
// la conexion falla. Si no se define, se decide por el puerto.
//
// Exportado para el diagnostico (que solo hace transporter.verify(), nunca
// envia). No cambia el comportamiento del envio.
export function createSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = resolveSmtpSecure(port, process.env.SMTP_SECURE);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
}

interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  from: string;
}

// NUNCA se loguea el contenido del mensaje ni las credenciales: si nodemailer
// falla, el error puede traer portions de la respuesta del servidor SMTP. Solo
// se registra el motivo generico.
async function sendMail(message: MailMessage): Promise<void> {
  if (!hasSmtpConfig()) {
    console.warn("[notify] Email no enviado: SMTP_HOST/SMTP_USER/SMTP_PASS no configurados.");
    return;
  }
  const transporter = createSmtpTransporter();
  await transporter.sendMail({
    from: message.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function adminFrom(): string {
  return process.env.ORDER_NOTIFY_FROM || process.env.SMTP_USER!;
}

function customerFrom(): string {
  return (
    process.env.ORDER_CUSTOMER_FROM || process.env.ORDER_NOTIFY_FROM || process.env.SMTP_USER!
  );
}

// ---------------------------------------------------------------------------
// Email al administrador: pedido pagado con stock
// ---------------------------------------------------------------------------

export function orderEmailSubject(order: Order): string {
  return `Nueva orden PIRATES - ${order.code}`;
}

export function orderEmailText(order: Order): string {
  const lines = [
    `PEDIDO ${order.code}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString("es-AR")}`,
    "",
    "PAGO",
    `  Estado: ${statusLabel(order)}`,
    `  Medio de pago: ${paymentMethodLabel(order)}`,
    "",
    "CLIENTE",
    `  Nombre: ${order.customerName}`,
    `  Teléfono: ${order.customerPhone || "-"}`,
    `  Email: ${order.customerEmail || "-"}`,
    `  Provincia: ${order.province || "-"}`,
    `  Envío: ${deliveryLabel(order)}`,
    "",
    "PRODUCTOS",
    ...order.items.map((i) => {
      const line = `${i.name} — ${i.size ? `${i.size} ml` : "-"} x${i.qty}`;
      return `  ${line}  →  ${money(i.price * i.qty)}`;
    }),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Envío: ${money(order.shipping)}`,
    `TOTAL: ${money(order.total)}`,
  ];
  return lines.join("\n");
}

function paymentBlockHtml(order: Order): string {
  return `
      <h3 style="margin:20px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Pago</h3>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Estado</td><td style="font-weight:600;">${escapeHtml(statusLabel(order))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Medio de pago</td><td>${escapeHtml(paymentMethodLabel(order))}</td></tr>
      </table>`;
}

export function orderEmailHtml(order: Order): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.size ? `${escapeHtml(String(i.size))} ml` : "-"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${money(i.price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <h2 style="margin:0 0 4px;">Pedido <span style="color:#b8860b;">${escapeHtml(order.code)}</span></h2>
      <p style="margin:0 0 16px;color:#888;font-size:13px;">${escapeHtml(new Date(order.createdAt).toLocaleString("es-AR"))}</p>

      ${paymentBlockHtml(order)}

      <h3 style="margin:16px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Cliente</h3>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Nombre</td><td style="font-weight:600;">${escapeHtml(order.customerName)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Teléfono</td><td>${escapeHtml(order.customerPhone || "-")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Email</td><td>${escapeHtml(order.customerEmail || "-")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Provincia</td><td>${escapeHtml(order.province || "-")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Envío</td><td>${escapeHtml(deliveryLabel(order))}</td></tr>
      </table>

      <h3 style="margin:20px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Productos</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#f7f7f7;text-align:left;">
            <th style="padding:8px 12px;">Producto</th>
            <th style="padding:8px 12px;text-align:center;">Tamaño</th>
            <th style="padding:8px 12px;text-align:center;">Cant.</th>
            <th style="padding:8px 12px;text-align:right;">Precio</th>
            <th style="padding:8px 12px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="margin-top:12px;width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
        <tr><td style="padding:3px 0;color:#555;">Envío</td><td style="text-align:right;">${money(order.shipping)}</td></tr>
        <tr><td style="padding:8px 0;border-top:2px solid #eee;font-weight:700;">TOTAL</td><td style="text-align:right;font-weight:700;font-size:16px;">${money(order.total)}</td></tr>
      </table>
    </div>
  `;
}

export async function sendOrderEmail(order: Order): Promise<void> {
  const to = (process.env.ORDER_NOTIFY_TO ?? "").trim();
  if (!to) {
    console.warn("[notify] Email al admin no enviado: ORDER_NOTIFY_TO no configurado.");
    return;
  }
  await sendMail({
    to,
    from: adminFrom(),
    subject: orderEmailSubject(order),
    text: orderEmailText(order),
    html: orderEmailHtml(order),
  });
}

// ---------------------------------------------------------------------------
// Alerta urgente: pedido cobrado SIN stock
// ---------------------------------------------------------------------------

// Se dispara cuando Mercado Pago aprobo el pago pero el stock no alcanza. El
// cliente ya fue debitado y la orden quedo en 'sin_stock', sin descontar nada.
// Antes esta situacion no notificaba a nadie y el admin se enteraba por el
// panel. Es el aviso que mas dinero en juego hay.
export function stockAlertSubject(order: Order): string {
  return `[URGENTE] PIRATES - pedido ${order.code} cobrado SIN STOCK`;
}

export function stockAlertText(order: Order): string {
  const url = orderUrl(order);
  const lines = [
    "PEDIDO COBRADO SIN STOCK",
    "",
    `  Código: ${order.code}`,
    `  Importe cobrado: ${money(order.total)}`,
    `  Estado: ${statusLabel(order)}`,
    `  Medio de pago: ${paymentMethodLabel(order)}`,
    "",
    "PRODUCTOS SIN STOCK",
    ...order.items.map((i) => `  ${i.name} — ${i.size ? `${i.size} ml` : "-"} x${i.qty}  →  ${money(i.price * i.qty)}`),
    "",
    `Cliente: ${order.customerName}`,
    `Teléfono: ${order.customerPhone || "-"}`,
    `Email: ${order.customerEmail || "-"}`,
    `Envío: ${deliveryLabel(order)}`,
    "",
    "El pago fue cobrado y el pedido no se puede cumplir. Hay que contactar al",
    "cliente para resolverlo (reposición de stock, canje o devolución).",
  ];
  if (url) lines.push(`Detalle: ${url}`);
  return lines.join("\n");
}

export function stockAlertHtml(order: Order): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.size ? `${escapeHtml(String(i.size))} ml` : "-"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <div style="background:#b91c1c;color:#fff;padding:12px 16px;border-radius:6px;font-weight:700;">
        URGENTE: pedido cobrado sin stock
      </div>
      <h2 style="margin:16px 0 4px;">Pedido <span style="color:#b8860b;">${escapeHtml(order.code)}</span></h2>

      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Importe cobrado</td><td style="font-weight:700;font-size:16px;">${money(order.total)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Estado</td><td style="font-weight:600;">${escapeHtml(statusLabel(order))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Medio de pago</td><td>${escapeHtml(paymentMethodLabel(order))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Fecha</td><td>${escapeHtml(new Date(order.createdAt).toLocaleString("es-AR"))}</td></tr>
      </table>

      <h3 style="margin:16px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Productos sin stock</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#f7f7f7;text-align:left;">
            <th style="padding:8px 12px;">Producto</th>
            <th style="padding:8px 12px;text-align:center;">Tamaño</th>
            <th style="padding:8px 12px;text-align:center;">Cant.</th>
            <th style="padding:8px 12px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <h3 style="margin:20px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Cliente</h3>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Nombre</td><td style="font-weight:600;">${escapeHtml(order.customerName)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Teléfono</td><td>${escapeHtml(order.customerPhone || "-")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Email</td><td>${escapeHtml(order.customerEmail || "-")}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Envío</td><td>${escapeHtml(deliveryLabel(order))}</td></tr>
      </table>

      <p style="margin:20px 0 0;font-size:14px;">
        El pago fue cobrado y el pedido no se puede cumplir. Hay que contactar al cliente
        para resolverlo (reposición de stock, canje o devolución).
      </p>
      ${orderUrl(order) ? `<p style="margin:8px 0 0;font-size:13px;"><a href="${escapeHtml(orderUrl(order))}">Ver detalle del pedido</a></p>` : ""}
    </div>
  `;
}

export async function sendStockAlertEmail(order: Order): Promise<void> {
  const to = (process.env.ORDER_NOTIFY_TO ?? "").trim();
  if (!to) {
    console.warn("[notify] Alerta sin stock no enviada: ORDER_NOTIFY_TO no configurado.");
    return;
  }
  await sendMail({
    to,
    from: adminFrom(),
    subject: stockAlertSubject(order),
    text: stockAlertText(order),
    html: stockAlertHtml(order),
  });
}

// ---------------------------------------------------------------------------
// Email al cliente: confirmacion de compra
// ---------------------------------------------------------------------------

// Solo se construye y envia para pedidos PAGADOS. Para un pedido pendiente o sin
// stock no hay nada que confirmar, y ningun texto de este archivo afirma que un
// pago fue aprobado: esa afirmacion ("Recibimos tu pago y tu pedido está
// confirmado") aparece solo en este bloque, que se usa unicamente cuando
// order.status === "pagado" (lo garantiza notifyNewOrder y vuelve a verificarlo
// sendCustomerOrderEmail).
export function customerOrderEmailSubject(order: Order): string {
  return `Confirmación de tu compra PIRATES - ${order.code}`;
}

export function customerOrderEmailText(order: Order): string {
  const url = customerOrderUrl(order);
  const lines = [
    `Hola ${order.customerName},`,
    "",
    "Recibimos tu pago y tu pedido está confirmado.",
    "",
    `  Código de pedido: ${order.code}`,
    `  Estado: ${statusLabel(order)}`,
    `  Medio de pago: ${paymentMethodLabel(order)}`,
    `  Fecha: ${new Date(order.createdAt).toLocaleString("es-AR")}`,
    "",
    "PRODUCTOS",
    ...order.items.map((i) => {
      const line = `${i.name} — ${i.size ? `${i.size} ml` : "-"} x${i.qty}`;
      return `  ${line}  →  ${money(i.price * i.qty)}`;
    }),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Envío: ${money(order.shipping)}`,
    `TOTAL: ${money(order.total)}`,
    "",
    `Entrega: ${deliveryLabel(order)}`,
    "",
    "Te contactaremos para coordinar la entrega.",
  ];
  if (url) lines.push(`Seguimiento: ${url}`);
  return lines.join("\n");
}

export function customerOrderEmailHtml(order: Order): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(i.name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.size ? `${escapeHtml(String(i.size))} ml` : "-"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <h2 style="margin:0 0 4px;">Gracias por tu compra, ${escapeHtml(order.customerName)}</h2>
      <p style="margin:0 0 16px;color:#555;">Recibimos tu pago y tu pedido está confirmado.</p>

      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Código</td><td style="font-weight:700;">${escapeHtml(order.code)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Estado</td><td style="font-weight:600;">${escapeHtml(statusLabel(order))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Medio de pago</td><td>${escapeHtml(paymentMethodLabel(order))}</td></tr>
      </table>

      <h3 style="margin:16px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Productos</h3>
      <table style="width:100%;font-size:14px;border-collapse:collapse;border:1px solid #eee;">
        <thead>
          <tr style="background:#f7f7f7;text-align:left;">
            <th style="padding:8px 12px;">Producto</th>
            <th style="padding:8px 12px;text-align:center;">Tamaño</th>
            <th style="padding:8px 12px;text-align:center;">Cant.</th>
            <th style="padding:8px 12px;text-align:right;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="margin-top:12px;width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:3px 0;color:#555;">Subtotal</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
        <tr><td style="padding:3px 0;color:#555;">Envío</td><td style="text-align:right;">${money(order.shipping)}</td></tr>
        <tr><td style="padding:8px 0;border-top:2px solid #eee;font-weight:700;">TOTAL</td><td style="text-align:right;font-weight:700;font-size:16px;">${money(order.total)}</td></tr>
      </table>

      <p style="margin:16px 0 0;font-size:14px;">Entrega: <strong>${escapeHtml(deliveryLabel(order))}</strong></p>
      <p style="margin:12px 0 0;font-size:14px;">Te contactaremos para coordinar la entrega.</p>
      ${customerOrderUrl(order) ? `<p style="margin:12px 0 0;font-size:13px;"><a href="${escapeHtml(customerOrderUrl(order))}">Ver seguimiento de tu pedido</a></p>` : ""}
    </div>
  `;
}

export function canNotifyCustomer(order: Order): boolean {
  // Reusa la MISMA regla que el checkout: un "x@" o un "@x" invalido en la base
  // tiene que hacer que el aviso se omita, no que salga un email a una direccion
  // que nadie puede leer.
  return isValidEmail(order.customerEmail);
}

export async function sendCustomerOrderEmail(order: Order): Promise<void> {
  if (order.status !== "pagado") {
    console.warn(
      "[notify] Email al cliente omitido: el texto confirma el pago y este pedido no está pagado."
    );
    return;
  }
  if (!canNotifyCustomer(order)) {
    console.warn("[notify] Email al cliente omitido: el pedido no tiene email utilizable.");
    return;
  }
  await sendMail({
    to: order.customerEmail!.trim(),
    from: customerFrom(),
    subject: customerOrderEmailSubject(order),
    text: customerOrderEmailText(order),
    html: customerOrderEmailHtml(order),
  });
}

// ---------------------------------------------------------------------------
// Email al cliente: el pedido fue despachado (tracking manual)
// ---------------------------------------------------------------------------

// Se manda cuando el administrador carga el número de seguimiento. Es
// informativo: dice que el pedido FUE DESPACHADO, nunca que llegó. La orden ya
// tiene el código y el evento de despacho persistidos ANTES de llamar acá, así
// que si el envío falla no se pierde el seguimiento: solo queda el error para
// mostrarlo en el panel.
export function trackingUrlForEmail(order: Order): string {
  const stored = (order.trackingUrl ?? "").trim();
  return stored || OFFICIAL_CORREO_ARGENTINO_TRACKING_URL;
}

export function customerTrackingEmailSubject(order: Order): string {
  return `Tu pedido PIRATES está en camino - ${order.code}`;
}

export function customerTrackingEmailText(order: Order): string {
  const url = trackingUrlForEmail(order);
  const lines = [
    `Hola ${order.customerName},`,
    "",
    `Tu pedido ${order.code} ya fue despachado por Correo Argentino.`,
    "",
    `  Número de seguimiento: ${order.trackingNumber}`,
    `  Estado: ${statusLabel(order)}`,
    `  Fecha de despacho: ${new Date(order.shippedAt ?? order.createdAt).toLocaleString("es-AR")}`,
    "",
    "Consultá el estado del envío con tu número de seguimiento:",
    url,
  ];
  const orderPage = customerOrderUrl(order);
  if (orderPage) {
    lines.push("", `Seguimiento de tu pedido: ${orderPage}`);
  }
  return lines.join("\n");
}

export function customerTrackingEmailHtml(order: Order): string {
  const url = trackingUrlForEmail(order);
  const orderPage = customerOrderUrl(order);
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <h2 style="margin:0 0 4px;">Tu pedido está en camino, ${escapeHtml(order.customerName)}</h2>
      <p style="margin:0 0 16px;color:#555;">Tu pedido <strong>${escapeHtml(order.code)}</strong> ya fue despachado por Correo Argentino.</p>

      <table style="font-size:14px;border-collapse:collapse;margin-bottom:16px;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Número de seguimiento</td><td style="font-weight:700;font-family:monospace;">${escapeHtml(order.trackingNumber)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Estado</td><td style="font-weight:600;">${escapeHtml(statusLabel(order))}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Fecha de despacho</td><td>${escapeHtml(new Date(order.shippedAt ?? order.createdAt).toLocaleString("es-AR"))}</td></tr>
      </table>

      <p style="margin:0 0 8px;font-size:14px;">Consultá el estado del envío con tu número de seguimiento:</p>
      <p style="margin:0;font-size:14px;"><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
      ${orderPage ? `<p style="margin:16px 0 0;font-size:13px;"><a href="${escapeHtml(orderPage)}">Ver el detalle de tu pedido</a></p>` : ""}
    </div>
  `;
}

export async function sendCustomerTrackingEmail(order: Order): Promise<void> {
  if (!order.trackingNumber.trim()) {
    console.warn("[notify] Aviso de despacho omitido: el pedido no tiene número de seguimiento.");
    return;
  }
  // No se le dice "en camino" a un pedido cancelado o sin stock: no va a salir.
  if (order.status === "cancelado" || order.status === "sin_stock") {
    console.warn(
      `[notify] Aviso de despacho omitido: el pedido está en estado "${order.status}".`
    );
    return;
  }
  if (!canNotifyCustomer(order)) {
    console.warn("[notify] Aviso de despacho omitido: el pedido no tiene email utilizable.");
    return;
  }
  await sendMail({
    to: order.customerEmail!.trim(),
    from: customerFrom(),
    subject: customerTrackingEmailSubject(order),
    text: customerTrackingEmailText(order),
    html: customerTrackingEmailHtml(order),
  });
}

// ---------------------------------------------------------------------------
// Links y WhatsApp
// ---------------------------------------------------------------------------

// Dominio base del sitio, SIN valor inventado: si SITE_URL no esta definida se
// devuelve "" y los correos salen sin enlace en vez de apuntar a un dominio
// supuesto. Un link a un host equivocado manda al comprador (o al admin) a otro
// sitio o a un 404, y es peor que no poner ninguno.
export function siteBaseUrl(): string {
  return (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
}

export function orderUrl(order: Order): string {
  const base = siteBaseUrl();
  return base ? `${base}/admin/pedidos/${order.id}` : "";
}

// El link que ve el comprador NO puede apuntar al panel de administracion.
export function customerOrderUrl(order: Order): string {
  const base = siteBaseUrl();
  return base ? `${base}/pedido/${encodeURIComponent(order.code)}` : "";
}

function productsSummary(order: Order): string {
  return (
    order.items
      .map(
        (i) =>
          `${i.name}${i.size ? ` ${i.size}ml` : ""} x${i.qty} (${money(i.price * i.qty)})`
      )
      .join(", ") || "-"
  );
}

export function hasWhatsAppConfig(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TO
  );
}

// Unico POST a Graph API para los tres avisos salientes.
//
// Antes cada aviso repetia el mismo fetch con los mismos headers y el mismo
// manejo de `if (!res.ok) throw`, y solo cambiaban el destinatario, la plantilla
// y los parametros. Ademas, el numero emisor era `WHATSAPP_PHONE_NUMBER_ID` en
// los tres: la cuenta tiene un segundo numero (WHATSAPP_PHONE_NUMBER_ID_2) que
// hoy solo recibe. Al recibir el id como parametro, enviar desde el segundo es
// cambiar un argumento, no reescribir el request.
//
// Lanza con el status de Graph API en cualquier respuesta no-2xx: nunca se
// informa un envio que la API no confirmo.
async function sendWhatsAppTemplate(input: {
  // Si se omite, usa el numero primario (el de siempre).
  phoneNumberId?: string;
  to: string;
  template: string;
  // Posicionales, en el orden de la plantilla aprobada en Meta.
  params: string[];
  // Solo para el log interno de errores.
  label: string;
}): Promise<void> {
  const phoneNumberId =
    input.phoneNumberId?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID!;

  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.template,
        language: { code: "es" },
        components: [
          {
            type: "body",
            parameters: input.params.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    throw Object.assign(new Error(`WhatsApp ${input.label} error`), {
      status: res.status,
    });
  }
}

// Aviso de pedido nuevo para el WhatsApp DEL NEGOCIO (no el del cliente): el
// destinatario es WHATSAPP_TO, el numero del admin.
//
// WhatsApp Business Platform / Cloud API de Meta: un unico POST a Graph API, sin
// SDK. Meta exige una plantilla APROBADA para que el negocio inicie la
// conversacion (WHATSAPP_TEMPLATE_NAME), con 5 variables en el cuerpo, en este
// orden:
//   {{1}} cliente   {{2}} contacto (telefono + email)   {{3}} pedido (codigo,
//   productos, cantidades, precios y total)   {{4}} envio (modalidad, CP,
//   localidad/provincia y direccion o sucursal preferida)   {{5}} observaciones
//
// El contenido y el orden se arman en order-message.ts para poder testearlos sin
// llamar a la API. Si la plantilla no coincide, Meta devuelve 4xx y se lanza:
// nunca se informa un envio que la API no confirmo.
export async function sendWhatsAppOrderNotification(order: Order): Promise<void> {
  if (!hasWhatsAppConfig()) {
    console.warn(
      "[notify] WhatsApp no configurado (WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_TO)."
    );
    return;
  }

  const template = process.env.WHATSAPP_TEMPLATE_NAME || "nueva_orden_pirates";
  const params = adminOrderMessageParams(order);
  const link = orderUrl(order);

  await sendWhatsAppTemplate({
    to: process.env.WHATSAPP_TO!,
    template,
    label: "order",
    params: [
      params.customer,
      params.contact,
      params.order,
      params.shipping,
      // El enlace va pegado al bloque de notas: asi son 5 variables en total y no
      // hace falta una sexta solo para la URL.
      link ? `${params.notes}\n${link}` : params.notes,
    ],
  });
}

// Aviso urgente de pedido cobrado sin stock. Usa la plantilla configurada en
// WHATSAPP_STOCK_ALERT_TEMPLATE_NAME; si no hay ninguna, cae en
// WHATSAPP_TEMPLATE_NAME. Si no hay ninguna de las dos, se omite el canal de
// WhatsApp y el aviso igual sale por email.
//
// Plantilla con 7 variables: {{1}} pedido, {{2}} importe cobrado, {{3}}
// productos con cantidad, {{4}} envio, {{5}} estado, {{6}} cliente,
// {{7}} telefono. La variable de estado va explicita porque el motivo de este
// aviso es que el pago se cobro pero la compra no se puede cumplir: si la
// plantilla no lo dice, el aviso se lee como una orden normal.
export async function sendWhatsAppStockAlert(order: Order): Promise<void> {
  if (!hasWhatsAppConfig()) {
    console.warn("[notify] Alerta sin stock por WhatsApp omitida: WhatsApp no configurado.");
    return;
  }

  const template =
    process.env.WHATSAPP_STOCK_ALERT_TEMPLATE_NAME || process.env.WHATSAPP_TEMPLATE_NAME;
  if (!template) {
    console.warn(
      "[notify] Alerta sin stock por WhatsApp omitida: falta WHATSAPP_STOCK_ALERT_TEMPLATE_NAME."
    );
    return;
  }

  await sendWhatsAppTemplate({
    to: process.env.WHATSAPP_TO!,
    template,
    label: "stock alert",
    params: [
      order.code,
      money(order.total),
      productsSummary(order),
      deliveryLabel(order),
      statusLabel(order),
      order.customerName,
      order.customerPhone || "-",
    ],
  });
}

// ---------------------------------------------------------------------------
// Aviso de despacho al cliente (WhatsApp)
// ---------------------------------------------------------------------------

// Plantilla de WhatsApp para avisar el despacho. NO tiene fallback: si no esta
// definida no se envia. Mandar el aviso con la plantilla equivocada (p.ej. la
// de nueva orden) le llega al cliente un mensaje que no corresponde.
export function dispatchTemplateName(): string {
  return (process.env.WHATSAPP_DISPATCH_TEMPLATE_NAME ?? "").trim();
}

// El aviso de despacho usa el mismo numero emisor que el resto de los avisos,
// pero el destinatario es el TELEFONO DEL CLIENTE, no WHATSAPP_TO (que es el
// numero del admin). Por eso ademas de la config de WhatsApp hace falta que la
// plantilla de despacho este definida.
export function hasWhatsAppDispatchConfig(): boolean {
  return hasWhatsAppConfig() && Boolean(dispatchTemplateName());
}

// Aviso al cliente de que su pedido fue despachado, con codigo y enlace de
// seguimiento. Plantilla con 4 variables: {{1}} nombre, {{2}} pedido,
// {{3}} seguimiento, {{4}} enlace.
//
// Si WhatsApp o la plantilla no estan configurados, o el pedido no tiene un
// telefono/seguimiento validos, se OMITE con un warn y NO lanza: el despacho ya
// quedo guardado y el aviso por email sigue existiendo. El admin siempre puede
// avisar a mano con el link wa.me del panel.
export async function sendWhatsAppDispatchNotification(order: Order): Promise<void> {
  if (!hasWhatsAppConfig()) {
    console.warn("[notify] Aviso de despacho por WhatsApp omitido: WhatsApp no configurado.");
    return;
  }
  const template = dispatchTemplateName();
  if (!template) {
    console.warn(
      "[notify] Aviso de despacho por WhatsApp omitido: falta WHATSAPP_DISPATCH_TEMPLATE_NAME."
    );
    return;
  }
  const phone = normalizeWhatsAppPhone(order.customerPhone);
  if (!phone) {
    console.warn(
      "[notify] Aviso de despacho por WhatsApp omitido: el pedido no tiene un teléfono válido."
    );
    return;
  }
  if (!order.trackingNumber) {
    console.warn(
      "[notify] Aviso de despacho por WhatsApp omitido: el pedido no tiene código de seguimiento."
    );
    return;
  }

  const params = dispatchMessageParams({
    customerName: order.customerName,
    code: order.code,
    trackingNumber: order.trackingNumber,
    trackingUrl: order.trackingUrl,
  });
  await sendWhatsAppTemplate({
    to: phone,
    template,
    label: "dispatch",
    params: [params.name, params.code, params.tracking, params.link],
  });
}

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

// Resumen seguro de un error para logs. NUNCA se registra el error tal cual: el
// objeto de nodemailer puede traer la respuesta del servidor SMTP (que incluye
// el destinatario y a veces usuario/host), y el de Graph API trae el cuerpo con
// el detalle del rechazo. Eso es PII y datos de credenciales en los logs, así que
// solo queda el nombre del error y un codigo numerico de Graph.
function safeErrorSummary(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    const status = (error as { status?: unknown }).status;
    const parts = [error.name];
    if (typeof code === "string" || typeof code === "number") parts.push(`code=${code}`);
    if (typeof status === "number") parts.push(`status=${status}`);
    return parts.join(" ");
  }
  return "error desconocido";
}

// Reintenta una operacion de notificacion hasta `attempts` veces con backoff
// creciente. Un canal no configurado sale a la primera (no reintenta): los
// pre-checks de cada send cortan sin lanzar.
//
// Devuelve {ok:false} si se agotaron los intentos, para que el llamador pueda
// saber que ese canal fallo sin que la exception llegue al pedido (que ya esta
// pagado y no se revierte por un correo caido).
export interface ChannelResult {
  channel: string;
  ok: boolean;
}

async function withRetry(
  label: string,
  fn: () => Promise<void>,
  attempts = 3
): Promise<ChannelResult> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await fn();
      return { channel: label, ok: true };
    } catch (error) {
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      } else {
        console.error(
          `[notify] ${label}: fallo tras ${attempts} intentos (${safeErrorSummary(error)})`
        );
      }
    }
  }
  return { channel: label, ok: false };
}

// Avisos de un pedido recien finalizado. Cada canal se intenta hasta 3 veces de
// forma independiente y los fallos NO se propagan: el pago ya esta confirmado y
// un correo caido no puede deshacer una compra (el pedido ya quedo 'pagado' y el
// stock ya se desconto dentro de la transaccion, antes de esta llamada).
//
// La deduplicacion NO vive aqui: el plan lo decide checkout-finalize a partir de
// los reclamos leidos y escritos dentro de la transaccion de finalizacion.
export async function notifyNewOrder(
  order: Order,
  plan: NotificationPlan
): Promise<void> {
  const jobs: Promise<ChannelResult>[] = [];

  if (plan.adminNewOrder) {
    jobs.push(
      withRetry("email", () => sendOrderEmail(order)),
      withRetry("whatsapp", () => sendWhatsAppOrderNotification(order))
    );
  }

  if (plan.adminStockAlert) {
    jobs.push(
      withRetry("alerta-sin-stock-email", () => sendStockAlertEmail(order)),
      withRetry("alerta-sin-stock-whatsapp", () => sendWhatsAppStockAlert(order))
    );
  }

  // Se envia solo con el pedido pagado. El texto de este correo afirma que el
  // pago fue recibido, asi que nunca debe usarse para un pedido pendiente,
  // rechazado o sin stock.
  if (plan.customerConfirmation && order.status === "pagado") {
    jobs.push(withRetry("cliente-email", () => sendCustomerOrderEmail(order)));
  }

  if (jobs.length === 0) return;

  // withRetry nunca rechaza: devuelve el resultado de cada canal, asi que el
  // pedido nunca ve una exception por un correo caido.
  const results = await Promise.all(jobs);
  const failed = results.filter((r) => !r.ok).map((r) => r.channel);
  if (failed.length > 0) {
    // Solo los nombres de los canales, sin contenido del mensaje.
    console.error(
      `[notify] Pedido ${order.code}: aviso no entregado por ${failed.join(", ")}`
    );
  }
}

// Reexportado para que los tests puedan construir pedidos sin duplicar la
// definicion de las reglas de deduplicacion.
export { planNotifications };
export type { NotificationPlan, NotificationClaims } from "./notification-plan.ts";
