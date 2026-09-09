import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import {
  createPreference,
  getPublicKey,
  hasCredentials,
} from "@/lib/mercadopago";
import { computePackageForItems } from "@/lib/shipping/packages";
import { getShippingProvider, applyFreeShipping } from "@/lib/shipping";
import { provinceCodeFor, isValidPostalCode } from "@/lib/shipping/provinces";
import type { ShippingProvider } from "@/lib/shipping/types";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";
import type { DeliveryType } from "@/lib/types";

const SIZE_PRICE: Record<string, "price_30" | "price_50" | "price_100" | null> = {
  "30": "price_30",
  "50": "price_50",
  "100": "price_100",
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

// URL base usada para backUrls / notificationUrl de Mercado Pago. NO se
// confía en el header "Origin" del cliente (un atacante podría poner su
// dominio y hacer que MP notifique/redirija ahí). Se usa SITE_URL, el host
// real de la request o, en última instancia, el origin de la propia URL.
function appOrigin(request: Request): string {
  const fromEnv = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const host = request.headers.get("host");
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    return `https://${host}`;
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
  agencyCode?: string;
}

interface CheckoutRequest {
  items: CheckoutItemInput[];
  customer: {
    name: string;
    phone: string;
    email?: string;
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
  if (name.length > 120 || phone.length > 30 || (body.customer?.email ?? "").length > 160) {
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
  const deliveryType: DeliveryType =
    shipping.deliveryType === "S" ? "S" : "D";

  // Provider de envío: en producción, si Correo Argentino no está configurado,
  // getShippingProvider() lanza un error y NO se aplica una tarifa plana
  // silenciosa (para no cobrar un precio incorrecto).
  let provider: ShippingProvider;
  try {
    provider = getShippingProvider();
  } catch (error) {
    console.error("[checkout/provider]", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "El envío no está disponible en este momento. Intentalo más tarde." },
      { status: 503 }
    );
  }

  // Localidad: el frontend la exige; el backend también valida que venga.
  const locality = (shipping.locality ?? "").trim();
  if (!locality || locality.length > 120) {
    return Response.json(
      { error: "Completá una localidad válida" },
      { status: 400 }
    );
  }

  const agencyCode = (shipping.agencyCode ?? "").trim();
  if (deliveryType === "S") {
    if (!agencyCode) {
      return Response.json(
        { error: "Seleccioná una sucursal de retiro" },
        { status: 400 }
      );
    }
    if (agencyCode.length > 40) {
      return Response.json({ error: "Sucursal inválida" }, { status: 400 });
    }
    // La sucursal debe existir y pertenecer a la provincia elegida: un código
    // inventado (o de otra provincia) se rechaza acá. Nunca se confía en el
    // cliente para validar sucursales.
    if (!provider.getAgencies) {
      return Response.json(
        { error: "El retiro en sucursal no está disponible para este proveedor" },
        { status: 400 }
      );
    }
    try {
      const agencies = await provider.getAgencies(provinceCode);
      const validAgency = agencies.some((a) => a.code === agencyCode);
      if (!validAgency) {
        return Response.json(
          { error: "La sucursal seleccionada no pertenece a la provincia indicada" },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error("[checkout/agencies]", error instanceof Error ? error.message : error);
      return Response.json(
        { error: "No se pudieron verificar las sucursales. Intentalo de nuevo." },
        { status: 502 }
      );
    }
  }
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
      sql: "SELECT id, name, price_30, price_50, price_100, stock FROM perfumes WHERE slug = ?",
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
    orderItems.push({
      perfumeId: perfume.id,
      name: perfume.name,
      size: Number(item.size),
      price: unitPrice,
      qty,
    });
    subtotal += unitPrice * qty;
  }

  // El costo de envío SIEMPRE se calcula en el backend consultando a Correo
  // Argentino. El cliente envía destino/modalidad, nunca un precio.
  let shippingCost = 0;
  let productType = "CP";
  try {
    const pkg = await computePackageForItems(body.items);
    const options = await provider.quote({
      postalCodeDestination: postalCode,
      provinceCode,
      deliveryType,
      package: pkg,
    });
    const match = options.find((o) => o.deliveryType === deliveryType);
    if (!match) {
      return Response.json(
        { error: "No hay servicios de envío disponibles para ese destino" },
        { status: 400 }
      );
    }
    productType = match.productType;
    shippingCost = applyFreeShipping(subtotal, match.price);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo calcular el envío";
    console.error("[checkout/shipping]", message);
    return Response.json(
      { error: "No se pudo calcular el envío. Intentalo de nuevo." },
      { status: 502 }
    );
  }
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
        title: provider.id === "flat_rate" ? "Envío" : "Envío Correo Argentino",
        quantity: 1,
        unit_price: shippingCost,
      });
    }
    preference = await createPreference({
      items,
      externalReference: code,
      payer: { name, phone, email: body.customer?.email },
      backUrls: {
        success: `${origin}/checkout/resultado`,
        pending: `${origin}/checkout/resultado`,
        failure: `${origin}/checkout/resultado`,
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
    args: [name, body.customer?.email?.trim() || null, phone, province, now],
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
