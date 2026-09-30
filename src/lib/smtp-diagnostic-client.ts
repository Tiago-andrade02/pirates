// Interpretacion de la respuesta del endpoint de diagnostico SMTP, del lado del
// navegador.
//
// Modulo puro a proposito: NO importa nada del servidor (tampoco nodemailer) y
// no depende de React, para poder testearlo con el runner de node --test.
//
// Que garantiza: el mensaje que se ve en el panel sale SIEMPRE de una de las
// cadenas escritas aca. El texto del servidor se usa solo si tiene la forma
// esperada del endpoint; ante cualquier otra cosa (HTML de error de un proxy,
// 500, cuerpo vacio) se muestra un mensaje generico. Asi, un mensaje de error
// inesperado del proveedor no puede terminar pintado en pantalla.

export type SmtpUiTone = "ok" | "error" | "neutral";

export interface SmtpUiResult {
  tone: SmtpUiTone;
  message: string;
}

const MESSAGES = {
  ok: "Conexión SMTP correcta: el servidor aceptó la conexión y las credenciales.",
  missingConfig:
    "Falta completar la configuración SMTP en el servidor (variables SMTP_HOST, SMTP_USER o SMTP_PASS).",
  authFailed:
    "El servidor SMTP rechazó las credenciales. En Brevo, SMTP_PASS debe ser una SMTP key, no la API key.",
  connectionFailed:
    "No se pudo conectar al servidor SMTP. Revisá SMTP_HOST, SMTP_PORT y SMTP_SECURE (puerto 587 usa STARTTLS: SMTP_SECURE debe ser false).",
  unauthorized:
    "Tu sesión de administrador no es válida. Volvé a iniciar sesión en el panel.",
  network:
    "No se pudo contactar al servidor. Revisá tu conexión a internet o intentá de nuevo en unos segundos.",
  unexpected:
    "El diagnóstico devolvió una respuesta inesperada. Revisá los logs del servidor.",
} as const;

// Solo se acepta el `message` del endpoint si el `status` es uno de los cuatro
// que ese endpoint define. Cualquier otro body se descarta.
const KNOWN_STATUSES = new Set(["ok", "missing_config", "auth_failed", "connection_failed"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function interpretSmtpResponse(
  httpStatus: number,
  body: unknown
): SmtpUiResult {
  // 401: la sesion caduco. El body del endpoint no trae detalle util aca.
  if (httpStatus === 401) {
    return { tone: "error", message: MESSAGES.unauthorized };
  }

  if (isRecord(body) && typeof body.status === "string" && KNOWN_STATUSES.has(body.status)) {
    switch (body.status) {
      case "ok":
        return { tone: "ok", message: MESSAGES.ok };
      case "missing_config":
        return { tone: "error", message: MESSAGES.missingConfig };
      case "auth_failed":
        return { tone: "error", message: MESSAGES.authFailed };
      case "connection_failed":
        return { tone: "error", message: MESSAGES.connectionFailed };
    }
  }

  // 503 y 502 del endpoint caen tambien aca si el body no tiene la forma
  // esperada, y tambien cualquier status unforeseen.
  return { tone: "error", message: MESSAGES.unexpected };
}

// Error de red (DNS caido, servidor sin respuesta, CORS, aborted). Se maneja
// aparte porque en ese caso ni siquiera hay status HTTP.
export function interpretSmtpNetworkError(): SmtpUiResult {
  return { tone: "error", message: MESSAGES.network };
}
