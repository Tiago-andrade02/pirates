import { getDb } from "@/lib/db";
import { getOrderById } from "@/lib/admin-data";
import { notifyNewOrder } from "@/lib/notify";

// Finaliza una orden ya paga: marca 'pagado', valida y descuenta stock y envía
// el email del pedido (fire-and-forget). Idempotente: no re-procesa ordenes ya
// pagadas. Se usa tanto en el webhook de Mercado Pago como sincrónicamente
// tras un pago aprobado, para que la orden se genere aunque el webhook no
// llegue.

// La validación de stock se hace DENTRO de la transacción, al finalizar: dos
// pagos simultáneos no pueden vender las mismas unidades porque aquí se
// relee el stock real y se lo descuenta de forma atómica (write lock de la
// fila). Si no alcanza el stock se marca la orden como 'sin_stock' sin
// descontar nada y se informa (nunca se aplica MAX(0, stock - qty), que
// ocultaría filas vendidas de más).
export async function finalizePaidOrderByCode(code: string): Promise<boolean> {
  const db = await getDb();

  const orderResult = await db.execute({
    sql: "SELECT id, status, notified_at FROM orders WHERE code = ?",
    args: [code],
  });
  const order = orderResult.rows[0] as unknown as
    | { id: number; status: string; notified_at: string | null }
    | undefined;
  if (!order) return false;
  // Ya pagada (o ya sin stock): nada que re-procesar. La primera finalización
  // gana y el stock se descuenta una sola vez.
  if (order.status === "pagado") return false;
  if (order.status === "sin_stock") return false;
  const alreadyNotified = Boolean(order.notified_at);

  // IMPORTANTE (Turso/LibSQL): NO usar BEGIN / COMMIT / ROLLBACK sueltos con
  // db.execute(): en la base remota cada statement puede ejecutarse en una
  // conexión distinta, por lo que el ROLLBACK del catch se ejecuta sin
  // transacción activa ("cannot rollback - no transaction is active") y
  // reemplaza/enmascara el error real. Se usa la transacción del cliente:
  // db.transaction("write") + tx.commit()/tx.rollback(), que gestiona el
  // estado de la transacción por nosotros. El write lock se toma en el primer
  // UPDATE de la transacción, serializando finalizaciones concurrentes.
  const tx = await db.transaction("write");
  let stockShortage: boolean;
  try {
    // Relee el estado DENTRO de la transacción. La combined-claim (la segunda
    // transacción vea ya 'pagado'/'sin_stock') convierte las finalizaciones
    // duplicadas o concurrentes en no-op: solo la primera descuenta stock.
    const recheck = await tx.execute({
      sql: "SELECT status FROM orders WHERE id = ?",
      args: [order.id],
    });
    const rechecked = recheck.rows[0] as unknown as { status: string } | undefined;
    const alreadyFinalized = ["pagado", "sin_stock"].includes(rechecked?.status ?? "");
    if (alreadyFinalized) {
      await tx.rollback();
      return false;
    }

    // "Reclama" el aviso de forma atómica y marca 'pagado'. Si luego no hay
    // stock suficiente, la orden pasa a 'sin_stock' y el aviso NO se envía.
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

    // Validación de stock dentro de la transacción: se relee cada producto y
    // se compara contra la cantidad pedida ANTES de descontar. Si algo no
    // alcanza, se aborta (rollback) y se marca la orden 'sin_stock'.
    stockShortage = false;
    for (const item of items) {
      if (item.perfume_id === null) continue;
      const pResult = await tx.execute({
        sql: "SELECT stock, stock_30, stock_50, stock_100 FROM perfumes WHERE id = ?",
        args: [item.perfume_id],
      });
      const prod = pResult.rows[0] as unknown as
        | { stock: number; stock_30: number; stock_50: number; stock_100: number }
        | undefined;
      if (!prod) {
        // Producto borrado: tampoco se puede cumplir.
        stockShortage = true;
        break;
      }
      // Validación por tamaño: la talla pedida también debe alcanzar, no solo
      // el stock total (una talla agotada no se puede vender aunque sobre stock
      // de otra). Así el UPDATE de debajo no puede llevar stock_<size> a negativo.
      const size = [30, 50, 100].includes(item.size) ? item.size : 100;
      const sizeCol = `stock_${size}` as "stock_30" | "stock_50" | "stock_100";
      if (
        Number(prod.stock) < Number(item.qty) ||
        Number(prod[sizeCol]) < Number(item.qty)
      ) {
        stockShortage = true;
        break;
      }
    }

    if (!stockShortage) {
      for (const item of items) {
        if (item.perfume_id === null) continue;
        const size = [30, 50, 100].includes(item.size) ? item.size : 100;
        // Se descuenta sin MAX(0,...): el stock (total y por tamaño) ya se
        // validó antes, de modo que el UPDATE no puede dejar stock negativo.
        await tx.execute({
          sql: `UPDATE perfumes SET stock_${size} = stock_${size} - ?, stock = stock - ? WHERE id = ?`,
          args: [item.qty, item.qty, item.perfume_id],
        });
      }
    } else {
      // No alcanza el stock: deshace el estado 'pagado' y marca 'sin_stock'.
      // No descuenta nada y no se notifica.
      await tx.execute({
        sql: "UPDATE orders SET status = 'sin_stock', notified_at = NULL WHERE id = ?",
        args: [order.id],
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

  if (stockShortage) {
    console.warn(`[checkout-finalize] Pedido ${code} marcado 'sin_stock'`);
    return false;
  }

  const fullOrder = await getOrderById(order.id);
  if (fullOrder && !alreadyNotified) {
    notifyNewOrder(fullOrder).catch((error) => {
      console.error("[notify] No se pudieron enviar los avisos del pedido", error);
    });
  }

  return true;
}