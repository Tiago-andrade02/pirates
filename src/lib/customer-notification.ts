import { getDb } from "@/lib/db";

// Reclamos de la confirmación al comprador, uno por canal. Antes había una sola
// columna (customer_notified_at) compartida por email y WhatsApp, así que un
// envío parcial (por ejemplo el email falla y el WhatsApp sale) quedaba marcado
// como "todo enviado" o "nada enviado". Ahora cada canal tiene su propia marca.
export type CustomerChannel = "email" | "whatsapp";

// Mapa fijo canal -> columna. La columna NUNCA viene de input del usuario: sale
// de acá, así el nombre interpolado en el SQL no es inyectable.
const CHANNEL_COLUMN: Record<CustomerChannel, string> = {
  email: "customer_email_notified_at",
  whatsapp: "customer_whatsapp_notified_at",
};

// Marca UN canal como entregado. COALESCE: un valor ya puesto no se pisa (el
// primer envío confirmado gana). Idempotente y seguro ante reenvíos.
//
// Nunca lanza: el envío ya ocurrió y el pedido ya está pagado, así que un fallo
// al registrar la marca no puede tumbar la operación. Se loguea sin datos
// sensibles y el admin puede reenviar desde el panel.
export async function markCustomerChannelNotified(
  orderId: number,
  channel: CustomerChannel,
  at: string = new Date().toISOString()
): Promise<void> {
  const column = CHANNEL_COLUMN[channel];
  try {
    const db = await getDb();
    await db.execute({
      sql: `UPDATE orders SET ${column} = COALESCE(${column}, ?) WHERE id = ?`,
      args: [at, orderId],
    });
  } catch {
    console.error(
      "[customer-notification] no se pudo registrar la confirmación al cliente; se puede reenviar desde el panel"
    );
  }
}

// Marca, en una sola sentencia, los canales que el proveedor confirmó como
// enviados. Un canal en false queda con su columna sin tocar (no se marca algo
// que no se entregó). Si no hay nada para marcar, no se ejecuta SQL. Igual que
// arriba, nunca lanza.
export async function markCustomerChannels(
  orderId: number,
  delivered: { email: boolean; whatsapp: boolean },
  at: string = new Date().toISOString()
): Promise<void> {
  if (!delivered.email && !delivered.whatsapp) return;
  try {
    const db = await getDb();
    await db.execute({
      sql: `UPDATE orders
            SET customer_email_notified_at =
                  CASE WHEN ? THEN COALESCE(customer_email_notified_at, ?) ELSE customer_email_notified_at END,
                customer_whatsapp_notified_at =
                  CASE WHEN ? THEN COALESCE(customer_whatsapp_notified_at, ?) ELSE customer_whatsapp_notified_at END
            WHERE id = ?`,
      args: [
        delivered.email ? 1 : 0,
        at,
        delivered.whatsapp ? 1 : 0,
        at,
        orderId,
      ],
    });
  } catch {
    console.error(
      "[customer-notification] no se pudo registrar la confirmación al cliente; se puede reenviar desde el panel"
    );
  }
}
