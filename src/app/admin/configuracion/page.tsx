import { requireAdminPage } from "../actions";
import { PageHeader } from "@/components/admin/ui";
import { SmtpTestButton } from "@/components/admin/SmtpTestButton";

// Seccion de herramientas del panel: aca viven los chequeos del estado de la
// configuracion del servidor. Es la unica pagina que no muestra datos de
// negocio, solo diagnostico.
export default async function ConfiguracionPage() {
  await requireAdminPage();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuración"
        description="Chequeos de la configuración del servidor"
      />

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-serif text-lg text-white">Notificaciones por email</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          Verifica que el servidor pueda conectarse al proveedor SMTP y que las
          credenciales sean correctas. No envía ningún correo y no modifica
          pedidos, stock ni pagos.
        </p>
        <div className="mt-4">
          <SmtpTestButton />
        </div>
        <p className="mt-4 max-w-prose text-xs leading-relaxed text-faint">
          Esta comprobación no puede confirmar que el remitente esté verificado en
          el proveedor. Para eso hace falta un envío real o revisar el panel del
          proveedor.
        </p>
      </section>
    </div>
  );
}
