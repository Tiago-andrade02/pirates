import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import {
  createPreference,
  getPublicKey,
  hasCredentials,
} from "@/lib/mercadopago";
import {
  getShippingProviderForOrder,
  CUSTOMER_SHIPPING_COST,
} from "@/lib/shipping";
import { provinceCodeFor, isValidPostalCode } from "@/lib/shipping/provinces";
import { resolveDeliveryType } from "@/lib/shipping/pickup";
import type { ShippingProvider } from "@/lib/shipping/types";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import type { DeliveryType } from "@/lib/types";

const SIZE_PRICE: Record<string, "price_30" | "price_50" | "price_100" | null> = {
  "30": "price_30",
  "50": "price_50",
  "100": "price_100",
};

// Whitelist de tallas para el stock por presentación. Los únicos valores válidos
// son 30/50/100 (como parseSize en admin), de modo que la columna SQL se arma
// solo desde el mapa, nunca desde el input del cliente.
const SIZE_STOCK: Record<string, "stock_30" | "stock_50" | "stock_100" | null> = {
  "30": "stock_30",
  "50": "stock_50",
  "100": "stock_100",
};

// Límite de pedidos por IP: evita que un bot genere órdenes y preferencias
// de pago en bucle.
const CHECKOUT_MAX_ATTEMPTS = 20;
const CHECKOUT_WINDOW_MS = 15 * 60 * 1000;

function orderCode(): string {
  // Código con alta entropía (64 bits) para que no se pueda enumerar
  // /pedido/[code] ni /api/shipping/tracking.
  return `PIR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

// Protocolo publico real segun el proxy de confianza. Si no viene
// x-forwarded-proto, se deduce de la propia URL de la request en vez de
// forzar https: en desarrollo local el server corre por http y forzar https
// rompia backUrls y notificationUrl.
function forwardedProto(request: Request): "http" | "https" {
  const raw = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (raw === "http" || raw === "https") return raw;
  try {
    return new URL(request.url).protocol === "http:" ? "http" : "https";
  } catch {
    return "https";
  }
}

// URL base usada para backUrls / notificationUrl de Mercado Pago. NO se
// confía en el header "Origin" del cliente (un atacante podría poner su
// dominio y hacer que MP notifique/redirija ahí). Se usa SITE_URL, el host
// público que reporta el proxy de confianza, el host de la request o, en última
// instancia, el origin de la propia URL.
function appOrigin(request: Request): string {
  const fromEnv = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const candidates = [
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim(),
    request.headers.get("host"),
  ];
  for (const candidate of candidates) {
    if (candidate && /^[a-z0-9.-]+(:\d+)?$/i.test(candidate)) {
      return `${forwardedProto(request)}://${candidate}`;
    }
  }
  return new URL(request.url).origin;
}

interface CheckoutItemInput {
  slug: string;
  size: string;
  qty: number;
}

interface ShippingInput {
  deliveryType?: string;
  postalCode?: string;
  province?: string;
  locality?: string;
  street?: string;
  number?: string;
  floor?: string;
  apartment?: string;
}

interface CheckoutRequest {
  items: CheckoutItemInput[];
  customer: {
    name: string;
      phone: string;
      email: string;
    };
  shipping?: ShippingInput;
}

type PerfumeRow = {
  id: number;
  name: string;
  price_30: number | null;
  price_50: number | null;
  price_100: number | null;
  stock: number;
  stock_30: number;
  stock_50: number;
  stock_100: number;
};

export async function POST(request: Request) {
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  const name = (body.customer?.name ?? "").trim();
  const phone = (body.customer?.phone ?? "").trim();
  if (!name || !phone) {
    return Response.json(
      { error: "Completá nombre y teléfono" },
      { status: 400 }
    );
  }
  // El email es OBLIGATORIO: es el único canal para mandarle la confirmación de
  // compra al comprador. Sin el, el cliente no recibe el resumen de su pedido.
  // Se valida con la misma regla que el formulario (email-validation.ts), para
  // que el navegador no deje pasar una dirección que la API va a rechazar.
  const email = normalizeEmail(body.customer?.email);
  if (!isValidEmail(email)) {
    return Response.json(
      { error: "Ingresá un email válido" },
      { status: 400 }
    );
  }
  if (name.length > 120 || phone.length > 30) {
    return Response.json({ error: "Datos de contacto inválidos" }, { status: 400 });
  }

  if (
    !(await rateLimitConsume(
      `checkout:${clientIp(request.headers)}`,
      CHECKOUT_MAX_ATTEMPTS,
      CHECKOUT_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiados pedidos en poco tiempo. Intentalo más tarde." },
      { status: 429 }
    );
  }

  const shipping = body.shipping ?? {};
  const postalCode = (shipping.postalCode ?? "").trim();
  const province = (shipping.province ?? "").trim();
  if (!postalCode || !province) {
    return Response.json(
      { error: "Completá provincia y código postal para el envío" },
      { status: 400 }
    );
  }
  if (!isValidPostalCode(postalCode)) {
    return Response.json(
      { error: "Ingresá un código postal válido" },
      { status: 400 }
    );
  }
  const provinceCode = provinceCodeFor(province);
  if (!provinceCode) {
    return Response.json({ error: "Provincia inválida" }, { status: 400 });
  }
  // ÚNICA modalidad disponible: envío a domicilio. El retiro en persona está
  // desactivado (ver lib/shipping/pickup.ts), así que un "S" enviado por un
  // cliente guardado se rechaza acá en vez de crear un pedido que no se puede
  // despachar ni mostrar.
  const deliveryTypeResolution = resolveDeliveryType(shipping.deliveryType);
  if (!deliveryTypeResolution.ok) {
    return Response.json(
      { error: deliveryTypeResolution.error },
      { status: 400 }
    );
  }
  const deliveryType: DeliveryType = deliveryTypeResolution.deliveryType;

  // Provider de envío. En el lanzamiento el envío es GRATIS para todos, así que
  // el provider NO se consulta para calcular el precio: se sigue resolviendo
  // para persistir el proveedor/servicio en la orden, pero un provider sin
  // credenciales ya no bloquea el checkout.
  const provider: ShippingProvider = getShippingProviderForOrder();

  // Localidad: el frontend la exige; el backend también valida que venga.
  const locality = (shipping.locality ?? "").trim();
  if (!locality || locality.length > 120) {
    return Response.json(
      { error: "Completá una localidad válida" },
      { status: 400 }
    );
  }

  // No hay retiro, así que no se guarda ni se valida ninguna sucursal. La columna
  // `agency_code` se escribe vacía para no dejar un código interno suelto en la
  // orden (los pedidos históricos con "S" la conservan: la base no se toca).
  const agencyCode = "";
  if (deliveryType === "D" && !(shipping.street ?? "").trim()) {
    return Response.json(
      { error: "Completá la dirección de entrega" },
      { status: 400 }
    );
  }
  if (
    deliveryType === "D" &&
    ((shipping.street ?? "").trim().length > 150 ||
      (shipping.number ?? "").trim().length > 20 ||
      (shipping.floor ?? "").trim().length > 12 ||
      (shipping.apartment ?? "").trim().length > 12)
  ) {
    return Response.json(
      { error: "Dirección de entrega inválida" },
      { status: 400 }
    );
  }

  const db = await getDb();

  const orderItems: { perfumeId: number; name: string; size: number; price: number; qty: number }[] = [];
  let subtotal = 0;

  for (const item of body.items) {
    const qty = Math.floor(item.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      return Response.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    const perfumeResult = await db.execute({
      sql: "SELECT id, name, price_30, price_50, price_100, stock, stock_30, stock_50, stock_100 FROM perfumes WHERE slug = ?",
      args: [item.slug],
    });
    const perfume = perfumeResult.rows[0] as unknown as PerfumeRow | undefined;
    if (!perfume) {
      return Response.json({ error: `Producto no encontrado: ${item.slug}` }, { status: 400 });
    }
    const col = SIZE_PRICE[String(item.size)];
    const unitPrice = col ? perfume[col] : null;
    if (!unitPrice) {
      return Response.json({ error: `Tamaño no disponible para ${perfume.name}` }, { status: 400 });
    }
    if (perfume.stock < qty) {
      return Response.json({ error: `No hay stock suficiente de ${perfume.name}` }, { status: 400 });
    }
    // Disponibilidad por presentación: la talla EXACTA pedida debe alcanzar,
    // no solo el stock total. Solo se arma la columna desde SIZE_STOCK (whitelist),
    // nunca desde el input del cliente. Evita que se pague por una variante agotada.
    const sizeStockCol = SIZE_STOCK[String(item.size)];
    const sizeStock = sizeStockCol ? perfume[sizeStockCol] : null;
    if (sizeStock === null || sizeStock < qty) {
      return Response.json(
        { error: `No hay stock de ${perfume.name} en ${item.size} ml. Elegí otra presentación.` },
        { status: 400 }
      );
    }
    orderItems.push({
      perfumeId: perfume.id,
      name: perfume.name,
      size: Number(item.size),
      price: unitPrice,
      qty,
    });
    subtotal += unitPrice * qty;
  }

  // El costo de envío al cliente es SIEMPRE 0 (ver CUSTOMER_SHIPPING_COST).
  // No se llama a provider.quote() porque:
  //   1. el precio no depende de la cotización, y
  //   2. evita exigir credenciales de PAQ.AR/Correo Argentino para cobrar.
  // El provider se sigue usando para sucursales, despacho y tracking.
  //
  // OJO: `productType` NO es el precio, es el código de servicio que se le pasa
  // al transportista al generar la etiqueta (ver lib/shipping/actions.ts). Se
  // fija "CP", que es el valor por defecto que ya usan paqar.ts y
  // correo-argentino.ts. PAQ.AR exige un código de 2 caracteres y Correo
  // Argentino lo manda verbatim en el body del alta, así que un valor libre
  // tipo "FREE" haría fallar el despacho. El precio nunca sale de acá.
  const shippingCost = CUSTOMER_SHIPPING_COST;
  const productType = "CP";
  const total = subtotal + shippingCost;

  if (!hasCredentials()) {
    return Response.json(
      {
        error:
          "Mercado Pago no está configurado todavía. Cargá MERCADO_PAGO_ACCESS_TOKEN en .env.local.",
      },
      { status: 500 }
    );
  }

  const code = orderCode();
  const origin = appOrigin(request);

  let preference;
  try {
    const items = orderItems.map((item) => ({
      id: `${item.perfumeId}-${item.size}`,
      title: `${item.name} ${item.size} ml`,
      quantity: item.qty,
      unit_price: item.price,
    }));
    if (shippingCost > 0) {
      items.push({
        id: "envio",
        title:
          provider.id === "paq_ar"
            ? "Envío PAQ.AR"
            : provider.id === "correo_argentino"
              ? "Envío Correo Argentino"
              : "Envío",
        quantity: 1,
        unit_price: shippingCost,
      });
    }
    preference = await createPreference({
      items,
      externalReference: code,
        payer: { name, phone, email },
      backUrls: {
        // external_reference va explicito ademas de existir en la preferencia:
        // la pagina de resultado necesita el codigo del pedido para verificar
        // el pago contra Mercado Pago, y no puede depender de que MP lo anexe a
        // la redireccion.
        success: `${origin}/checkout/resultado?external_reference=${encodeURIComponent(code)}`,
        pending: `${origin}/checkout/resultado?external_reference=${encodeURIComponent(code)}`,
        failure: `${origin}/checkout/resultado?external_reference=${encodeURIComponent(code)}`,
      },
      notificationUrl: `${origin}/api/mercadopago/webhook`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando preferencia de pago";
    return Response.json({ error: message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const customerResult = await db.execute({
    sql: "INSERT INTO customers (name, email, phone, province, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [name, email, phone, province, now],
  });
  const customerId = Number(customerResult.lastInsertRowid);

  const orderResult = await db.execute({
    sql: `INSERT INTO orders (
         code, customer_id, status, subtotal, shipping, total, payment_method,
         province, postal_code, locality, address_street, address_number,
         address_floor, address_apartment, delivery_type, agency_code,
         shipping_provider, shipping_service, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      code,
      customerId,
      "pendiente",
      subtotal,
      shippingCost,
      total,
      "mercadopago",
      province,
      postalCode,
      locality,
      (shipping.street ?? "").trim(),
      (shipping.number ?? "").trim(),
      (shipping.floor ?? "").trim(),
      (shipping.apartment ?? "").trim(),
      deliveryType,
      agencyCode,
      provider.id,
      productType,
      now,
    ],
  });
  const orderId = Number(orderResult.lastInsertRowid);

  for (const item of orderItems) {
    await db.execute({
      sql: "INSERT INTO order_items (order_id, perfume_id, name, size, price, qty) VALUES (?, ?, ?, ?, ?, ?)",
      args: [orderId, item.perfumeId, item.name, item.size, item.price, item.qty],
    });
  }

  return Response.json({
    code,
    total,
    subtotal,
    shipping: shippingCost,
    preferenceId: preference.id,
    publicKey: getPublicKey(),
    initPoint: preference.initPoint,
    sandboxInitPoint: preference.sandboxInitPoint,
  });
}
