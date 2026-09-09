import { computePackageForItems } from "@/lib/shipping/packages";
import { getShippingProvider } from "@/lib/shipping";
import { isValidPostalCode, provinceCodeFor } from "@/lib/shipping/provinces";
import type { QuoteOption, ShippingProvider } from "@/lib/shipping/types";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";
import type { DeliveryType } from "@/lib/types";

// Límite razonable por IP: cada quote dispara una consulta a Correo
// Argentino, y un bot podría quemarlas en bucle.
const QUOTE_MAX_ATTEMPTS = 60;
const QUOTE_WINDOW_MS = 60 * 1000;

interface QuoteBody {
  items?: { slug: string; size: string; qty: number }[];
  postalCode?: string;
  province?: string;
  deliveryType?: string;
}

const SIZES = ["30", "50", "100"];

export async function POST(request: Request) {
  let body: QuoteBody;
  try {
    body = (await request.json()) as QuoteBody;
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  if (
    !(await rateLimitConsume(
      `quote:${clientIp(request.headers)}`,
      QUOTE_MAX_ATTEMPTS,
      QUOTE_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiadas cotizaciones. Intentalo en un minuto." },
      { status: 429 }
    );
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  const postalCode = (body.postalCode ?? "").trim();
  if (!isValidPostalCode(postalCode)) {
    return Response.json(
      { error: "Ingresá un código postal válido" },
      { status: 400 }
    );
  }

  const provinceCode = provinceCodeFor(body.province);
  if (!provinceCode) {
    return Response.json(
      { error: "Seleccioná una provincia válida" },
      { status: 400 }
    );
  }

  const deliveryType = body.deliveryType as DeliveryType | undefined;
  if (deliveryType && deliveryType !== "D" && deliveryType !== "S") {
    return Response.json(
      { error: "Modalidad de entrega inválida" },
      { status: 400 }
    );
  }

  for (const item of body.items) {
    if (
      typeof item.slug !== "string" ||
      !SIZES.includes(String(item.size)) ||
      !Number.isFinite(Math.floor(item.qty)) ||
      Math.floor(item.qty) <= 0
    ) {
      return Response.json(
        { error: "Datos de productos inválidos" },
        { status: 400 }
      );
    }
  }

  let pkg;
  try {
    pkg = await computePackageForItems(body.items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error calculando el paquete";
    return Response.json({ error: message }, { status: 400 });
  }

  let provider: ShippingProvider;
  let options: QuoteOption[];
  try {
    provider = getShippingProvider();
    options = await provider.quote({
      postalCodeDestination: postalCode,
      provinceCode,
      deliveryType,
      package: pkg,
    });
  } catch (error) {
    console.error("[shipping/quote]", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "No se pudo obtener la cotización de envío. Intentalo de nuevo." },
      { status: 502 }
    );
  }

  if (options.length === 0) {
    return Response.json(
      { error: "No hay servicios de envío disponibles para ese destino" },
      { status: 404 }
    );
  }

  return Response.json({
    options,
    provider: provider.id,
    package: {
      weightGrams: pkg.weightGrams,
      lengthCm: pkg.lengthCm,
      widthCm: pkg.widthCm,
      heightCm: pkg.heightCm,
    },
    freeShippingMin: Number(process.env.SHIPPING_FREE_MIN ?? 80000),
  });
}
