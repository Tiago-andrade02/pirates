import { clientIp, rateLimitConsume } from "@/lib/rate-limit";

// NO hay catálogo de sucursales.
//
// La modalidad de envío a sucursal de Correo Argentino existe, pero se coordina
// por WhatsApp: no hay integración con el padrón de sucursales, así que no se
// puede saber qué sucursales existen, si atienden un CP o si tienen stock. Por
// eso NO se listan agencias y el cliente escribe a mano la que prefiere (texto
// libre, sin validación).
//
// La ruta se conserva (con su rate limit) en lugar de eliminarse: si un cliente
// guardado la llama, recibe un motivo claro en vez de un 404 de Next que el
// checkout interpretaría como un fallo de red.
const AGENCIES_MAX_ATTEMPTS = 30;
const AGENCIES_WINDOW_MS = 60_000;

const NO_AGENCIES_MESSAGE =
  "No publicamos el listado de sucursales de Correo Argentino. Si elegís envío a sucursal, escribinos por WhatsApp después de tu compra y coordinamos laSucursal según disponibilidad.";

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

  // 410 Gone: la ruta existe pero ya no cumple un propósito. Siempre devuelve
  // una lista vacía, jamás datos inventados de sucursales.
  return Response.json({ agencies: [], error: NO_AGENCIES_MESSAGE }, { status: 410 });
}