import { getDb } from "@/lib/db";
import { getOrderById } from "@/lib/admin-data";
import { notifyNewOrder } from "@/lib/notify";

// Finaliza una orden ya paga: marca 'pagado', descuenta stock y envía el
// email del pedido (fire-and-forget). Idempotente: no re-procesa ordenes ya
// pagadas. Se usa tanto en el webhook de Mercado Pago como sincrónicamente
// tras un pago aprobado, para que la orden se genere aunque el webhook no
// llegue.
export async function finalizePaidOrderByCode(code: string): Promise<boolean> {
  const db = await getDb();

  const orderResult = await db.execute({
    sql: "SELECT id, status, notified_at FROM orders WHERE code = ?",
    args: [code],
  });
  const order = orderResult.rows[0] as unknown as
    | { id: number; status: string; notified_at: string | null }
    | undefined;
  if (!order || order.status === "pagado") return false;
  const alreadyNotified = Boolean(order.notified_at);

  // IMPORTANTE (Turso/LibSQL): NO usar BEGIN / COMMIT / ROLLBACK sueltos con
  // db.execute(): en la base remota cada statement puede ejecutarse en una
  // conexión distinta, por lo que el ROLLBACK del catch se ejecuta sin
  // transacción activa ("cannot rollback - no transaction is active") y
  // reemplaza/enmascara el error real. Se usa la transacción del cliente:
  // db.transaction("write") + tx.commit()/tx.rollback(), que gestiona el
  // estado de la transacción por nosotros.
  const tx = await db.transaction("write");
  try {
    // Reclama el aviso de forma atómica: notified_at se setea una sola vez
    // (COALESCE). Si un webhook de Mercado Pago se reenvía o el path síncrono
    // ya finalizó, este UPDATE vuelve a marcar 'pagado' pero no re-notifica.
    const notifiedAt = new Date().toISOString();
    await tx.execute({
      sql: "UPDATE orders SET status = 'pagado', notified_at = COALESCE(notified_at, ?) WHERE id = ?",
      args: [notifiedAt, order.id],
    });

    const itemsResult = await tx.execute({
      sql: "SELECT perfume_id, qty, size FROM order_items WHERE order_id = ?",
      args: [order.id],
    });
    const items = itemsResult.rows as unknown as {
      perfume_id: number;
      qty: number;
      size: number;
    }[];
    for (const item of items) {
      const size = [30, 50, 100].includes(item.size) ? item.size : 100;
      await tx.execute({
        sql: `UPDATE perfumes SET stock_${size} = MAX(0, stock_${size} - ?), stock = MAX(0, stock - ?) WHERE id = ?`,
        args: [item.qty, item.qty, item.perfume_id],
      });
    }
    await tx.commit();
  } catch (error) {
    // El rollback es secundario y no debe ocultar el error original: si
    // falla, se loguea y se relanza el error primario.
    if (!tx.closed) {
      try {
        await tx.rollback();
      } catch (rollbackError) {
        console.error("[checkout-finalize] rollback fallido", rollbackError);
      }
    }
    throw error;
  }

  const fullOrder = await getOrderById(order.id);
  if (fullOrder && !alreadyNotified) {
    notifyNewOrder(fullOrder).catch((error) => {
      console.error("[notify] No se pudieron enviar los avisos del pedido", error);
    });
  }

  return true;
}