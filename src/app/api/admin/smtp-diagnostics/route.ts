import { isAdmin } from "@/app/admin/actions";
import { createSmtpTransporter } from "@/lib/notify";
import { diagnoseSmtp, type SmtpDiagnosticResult } from "@/lib/smtp-diagnostics";

// Diagnostico SMTP para el administrador.
//
// POST /api/admin/smtp-diagnostics
//
// Que hace: abre la conexion SMTP y autentica (nodemailer verify()). NO envia
// ningun correo, NO toca pedidos, stock ni pagos, no escribe en la base.
//
// Proteccion: reutiliza la MISMA sesion de administrador que el resto del panel
// (cookie pirates_admin, comparada en timingSafeEqual dentro de isAdmin()).
// No se inventa un header ni un token propio: si no hay sesion de admin, es 401.
//
// La respuesta nunca incluye SMTP_USER, SMTP_PASS, SMTP_HOST ni el mensaje
// original del error de SMTP, que puede traer usuario o remitente. Solo estados
// y mensajes fijos.

function statusCode(result: SmtpDiagnosticResult): number {
  switch (result.status) {
    case "ok":
      return 200;
    case "missing_config":
      // El servidor esta desplegado pero sin las variables: es un problema de
      // configuracion, no de la request.
      return 503;
    default:
      // auth_failed y connection_failed: el pedido fue invalido en el sentido
      // de que el chequeo fallo. 502 Bad Gateway delatan que el problema esta
      // del lado del proveedor, no del codigo.
      return 502;
  }
}

export async function POST() {
  if (!(await isAdmin())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const result = await diagnoseSmtp(async () => {
    // verify() autentica y cierra. Jamas llama a sendMail.
    await createSmtpTransporter().verify();
  });

  if (result.status !== "ok") {
    // Se registra el estado, no el error: el objeto de nodemailer puede traer la
    // respuesta del servidor SMTP con datos de conexion.
    console.warn(`[smtp-diagnostics] estado=${result.status}`);
  }

  return Response.json(result, { status: statusCode(result) });
}

// GET responde con el metodo correcto para que un link mal escrito no suggests
// que la ruta existe para cualquiera.
export async function GET() {
  return Response.json({ error: "Usar POST" }, { status: 405 });
}
