// Ruta relativa con extension: el runner de los tests (node --test) no resuelve
// el alias "@/", que solo entiende Next.
import { resolveSmtpSecure } from "./notify.ts";

// Diagnostico de la conexion SMTP. NO envia ningun correo: solo abre la
// conexion y autentica (equivalente a nodemailer transporter.verify()).
//
// Este modulo NO toca pedidos, stock ni pagos: no importa la base de datos.
//
// Todos los textos que devuelve son fijos y estan escritos aqui a mano. Nunca
// se devuelve ni se registra el valor de SMTP_USER, SMTP_PASS, SMTP_HOST ni de
// ORDER_NOTIFY_TO: un error de SMTP puede traer el servidor, el usuario o el
// remitente en su mensaje, y filtrar eso a un log o a una respuesta HTTP lo
// convertiria en una fuga. El mensaje real del proveedor se descarta y se
// reemplaza por una explicacion acotada de la causa probable.

export type SmtpDiagnosticStatus = "ok" | "missing_config" | "auth_failed" | "connection_failed";

export interface SmtpDiagnosticResult {
  status: SmtpDiagnosticStatus;
  // Mensaje fijo, seguro de mostrar. Nunca incluye el error original.
  message: string;
  // Solo datos NO sensibles, utiles para diagnosing.
  checks: {
    configured: boolean;
    port: number;
    secure: boolean;
  };
  // Nombres de las variables que faltan (nunca sus valores). Para corregir la
  // configuracion alcanza con saber cual falta.
  missing: string[];
}

// Puerto y modo de cifrado que se leen del entorno, sin exponer host ni
// credenciales.
function smtpSettings(): { port: number; secure: boolean } {
  const port = Number(process.env.SMTP_PORT ?? 587);
  return { port, secure: resolveSmtpSecure(port, process.env.SMTP_SECURE) };
}

function missingVars(): string[] {
  const missing: string[] = [];
  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASS) missing.push("SMTP_PASS");
  return missing;
}

// Traduce un error de nodemailer a una categoria estable.
//
// Se mira SOLO el codigo y un fragmento del mensaje, y en ningun caso se
// devuelve el mensaje original: puede contener el usuario, el host o el
// remitente rechazado.
export function classifySmtpError(error: unknown): Exclude<
  SmtpDiagnosticStatus,
  "ok" | "missing_config"
> {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "").toUpperCase()
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  // El proveedor acepto la conexion pero rechazo las credenciales. Es el caso
  // tipico de Brevo cuando se confunde la API key con la SMTP key.
  if (
    code === "EAUTH" ||
    code === "EENVELOPE" ||
    message.includes("535") ||
    message.includes("authentication failed") ||
    message.includes("invalid credentials") ||
    message.includes("bad username or password")
  ) {
    return "auth_failed";
  }

  // Todo lo demas es fallo de conexion: host inaccesible, puerto bloqueado,
  // DNS mal resuelto, TLS incompatible, timeout. Se agrupa en una sola categoria
  // porque el codigo util ya se filtro para no filtrar datos.
  return "connection_failed";
}

const MESSAGES: Record<SmtpDiagnosticStatus, string> = {
  ok: "Conexion SMTP correcta: el servidor acepto la conexion y las credenciales.",
  missing_config: "Falta completar la configuracion SMTP en el entorno del servidor.",
  auth_failed:
    "El servidor SMTP rechazo las credenciales. Revisa SMTP_USER y SMTP_PASS: en Brevo la contrasena es una SMTP key generada en el panel, no la API key ni la contrasena de la cuenta.",
  connection_failed:
    "No se pudo conectar al servidor SMTP. Revisa SMTP_HOST, SMTP_PORT y SMTP_SECURE: en Brevo el puerto 587 usa STARTTLS, asi que SMTP_SECURE debe ser false (con 465 es true).",
};

// Verifica la conexion. Inyectable para poder testear los tres casos
// (exito, faltantes, error) sin abrir un socket real.
export async function diagnoseSmtp(
  verify: () => Promise<unknown>
): Promise<SmtpDiagnosticResult> {
  const { port, secure } = smtpSettings();
  const missing = missingVars();
  const checks = { configured: missing.length === 0, port, secure };

  // No se intenta conectar si falta configuracion: el error seria confuso y no
  // aportaria nada.
  if (missing.length > 0) {
    return {
      status: "missing_config",
      message: MESSAGES.missing_config,
      checks,
      missing,
    };
  }

  try {
    await verify();
    return { status: "ok", message: MESSAGES.ok, checks, missing: [] };
  } catch (error) {
    return {
      status: classifySmtpError(error),
      message: MESSAGES[classifySmtpError(error)],
      checks,
      missing: [],
    };
  }
}
