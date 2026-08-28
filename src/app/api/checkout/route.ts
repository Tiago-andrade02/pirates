import { getDb } from "@/lib/db";
import { createPreference, hasCredentials } from "@/lib/mercadopago";
import { computePackageForItems } from "@/lib/shipping/packages";
import { getShippingProvider, applyFreeShipping } from "@/lib/shipping";
import { provinceCodeFor, isValidPostalCode } from "@/lib/shipping/provinces";
import type { DeliveryType } from "@/lib/types";

const SIZE_PRICE: Record<string, "price_30" | "price_50" | "price_100" | null> = {
  "30": "price_30",
  "50": "price_50",
  "100": "price_100",
};

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
  if (deliveryType === "S" && !(shipping.agencyCode ?? "").trim()) {
    return Response.json(
      { error: "Seleccioná una sucursal de retiro" },
      { status: 400 }
    );
  }
  if (deliveryType === "D" && !(shipping.street ?? "").trim()) {
    return Response.json(
      { error: "Completá la dirección de entrega" },
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
    const provider = getShippingProvider();
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

  const code = `PIR-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

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
        title: "Envío Correo Argentino",
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
         shipping_service, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      (shipping.locality ?? "").trim(),
      (shipping.street ?? "").trim(),
      (shipping.number ?? "").trim(),
      (shipping.floor ?? "").trim(),
      (shipping.apartment ?? "").trim(),
      deliveryType,
      (shipping.agencyCode ?? "").trim(),
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
    initPoint: preference.initPoint,
    sandboxInitPoint: preference.sandboxInitPoint,
  });
}
