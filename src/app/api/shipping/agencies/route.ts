import { PICKUP_DISABLED_MESSAGE, pickupEnabled } from "@/lib/shipping/pickup";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";

// El retiro en persona esta desactivado, asi que ya no hay sucursales que
// listar. La ruta se conserva (y sigue con su rate limit) en lugar de
// eliminarse: si algun cliente guardado la llama, recibe un motivo claro en vez
// de un 404 de Next que el checkout interpretaria como un fallo de red.
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

  if (!pickupEnabled()) {
    return Response.json(
      { agencies: [], error: PICKUP_DISABLED_MESSAGE },
      { status: 410 }
    );
  }

  return Response.json({ agencies: [], error: PICKUP_DISABLED_MESSAGE });
}
