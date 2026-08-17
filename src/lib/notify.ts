import nodemailer from "nodemailer";
import type { Order } from "./types";

function money(value: number): string {
  return "$" + Math.round(value).toLocaleString("es-AR");
}

function deliveryLabel(order: Order): string {
  return order.deliveryType === "S"
    ? `Retiro en sucursal (${order.agencyCode || "—"})`
    : `A domicilio: ${[order.addressStreet, order.addressNumber]
        .filter(Boolean)
        .join(" ")}`;
}

export function orderEmailSubject(order: Order): string {
  return `Nuevo pedido pagado ${order.code} — ${order.customerName}`;
}

export function orderEmailText(order: Order): string {
  const lines = [
    `PEDIDO ${order.code}`,
    `Fecha: ${new Date(order.createdAt).toLocaleString("es-AR")}`,
    "",
    "CLIENTE",
    `  Nombre: ${order.customerName}`,
    `  Teléfono: ${order.customerPhone || "—"}`,
    `  Email: ${order.customerEmail || "—"}`,
    `  Provincia: ${order.province || "—"}`,
    `  Envío: ${deliveryLabel(order)}`,
    "",
    "PRODUCTOS",
    ...order.items.map((i) => {
      const line = `${i.name} — ${i.size ? `${i.size} ml` : "—"} x${i.qty}`;
      return `  ${line}  →  ${money(i.price * i.qty)}`;
    }),
    "",
    `Subtotal: ${money(order.subtotal)}`,
    `Envío: ${money(order.shipping)}`,
    `TOTAL: ${money(order.total)}`,
  ];
  return lines.join("\n");
}

export function orderEmailHtml(order: Order): string {
  const rows = order.items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.size ? `${i.size} ml` : "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${i.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${money(i.price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${money(i.price * i.qty)}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222;">
      <h2 style="margin:0 0 4px;">Pedido <span style="color:#b8860b;">${order.code}</span></h2>
      <p style="margin:0 0 16px;color:#888;font-size:13px;">${new Date(order.createdAt).toLocaleString("es-AR")}</p>

      <h3 style="margin:16px 0 6px;font-size:14px;text-transform:uppercase;color:#555;">Cliente</h3>
      <table style="font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Nombre</td><td style="font-weight:600;">${order.customerName}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Teléfono</td><td>${order.customerPhone || "—"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Email</td><td>${order.customerEmail || "—"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Provincia</td><td>${order.province || "—"}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#888;">Envío</td><td>${deliveryLabel(order)}</td></tr>
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

export function hasEmailConfig(): boolean {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.ORDER_NOTIFY_TO
  );
}

export async function sendOrderEmail(order: Order): Promise<void> {
  if (!hasEmailConfig()) {
    console.warn("[notify] Email no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS/ORDER_NOTIFY_TO).");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: String(process.env.SMTP_SECURE ?? "").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });

  await transporter.sendMail({
    from: process.env.ORDER_NOTIFY_FROM || process.env.SMTP_USER,
    to: process.env.ORDER_NOTIFY_TO,
    subject: orderEmailSubject(order),
    text: orderEmailText(order),
    html: orderEmailHtml(order),
  });
}
