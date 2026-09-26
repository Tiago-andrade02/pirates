import { getShippingProvider } from "@/lib/shipping";
import type { ShippingProvider } from "@/lib/shipping/types";
import { provinceCodeFor } from "@/lib/shipping/provinces";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";

const AGENCIES_MAX_ATTEMPTS = 30;
const AGENCIES_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  if (
    !(await rateLimitConsume(
      `agencies:${clientIp(request.headers)}`,
      AGENCIES_MAX_ATTEMPTS,
      AGENCIES_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiadas solicitudes. Intentalo en un minuto." },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const province = (url.searchParams.get("province") ?? "").trim();
  const provinceCode = (url.searchParams.get("provinceCode") ?? "").trim() || provinceCodeFor(province) || "";

  if (!provinceCode) {
    return Response.json(
      { error: "Provincia inválida" },
      { status: 400 }
    );
  }

  let provider: ShippingProvider;
  try {
    provider = getShippingProvider();
  } catch (error) {
    console.error("[shipping/agencies]", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "No se pudieron obtener las sucursales. Intentalo de nuevo." },
      { status: 502 }
    );
  }
  if (!provider.getAgencies) {
    return Response.json({ agencies: [] });
  }

  try {
    const agencies = await provider.getAgencies(provinceCode);
    return Response.json({ agencies });
  } catch (error) {
    console.error("[shipping/agencies]", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "No se pudieron obtener las sucursales. Intentalo de nuevo." },
      { status: 502 }
    );
  }
}
