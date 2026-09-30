import { getDb } from "@/lib/db";
import { getOrderById } from "@/lib/admin-data";
import { notifyNewOrder } from "@/lib/notify";
import { planNotifications, type NotificationPlan } from "@/lib/notification-plan";
import { ATTACH_PAYMENT_SQL } from "@/lib/order-payment-link";
import type { OrderStatus } from "@/lib/types";
import { isOrderFinalized } from "@/lib/types";

// Asocia el id del pago de Mercado Pago al pedido. Idempotente: el primer
// payment_id gana y paid_at se fija una sola vez, asi que reintentar el webhook
// o volver a confirmar desde la pagina de resultado no pisa ni duplica nada.
// El SQL vive en order-payment-link.ts para que webhook, confirmacion y pago
// del Brick compartan exactamente la misma sentencia.
export async function attachPaymentToOrder(
  code: string,
  paymentId: string,
  paidAt: string = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  await db.execute({
    sql: ATTACH_PAYMENT_SQL,
    args: [paymentId, paidAt, code],
  });
}

// Finaliza una orden ya paga: marca 'pagado' (o 'sin_stock' si no alcanza el
// stock), valida y descuenta stock, y dispara los avisos. Idempotente: no
// re-procesa ordenes ya pagadas ni sin stock. Se usa tanto en el webhook de
// Mercado Pago como sincronicamente tras un pago aprobado, para que la orden se
// genere aunque el webhook no llegue.

// La validación de stock se hace DENTRO de la transaccion, al finalizar: dos
// pagos simultaneos no pueden vender las mismas unidades porque aqui se relee el
// stock real y se lo descuenta de forma atomica (write lock de la fila). Si no
// alcanza el stock se marca la orden como 'sin_stock' sin descontar nada y se
// avisa al administrador (nunca se aplica MAX(0, stock - qty), que ocultaria
// filas vendidas de mas).
//
// DEDUPLICACION DE AVISOS: el webhook y la confirmacion desde la pagina de
// resultado pueden llamar a esta funcion al mismo tiempo. La deduplicacion no
// depende de leer el pedido por fuera (esa lectura puede estar desactualizada)
// sino del write lock: "write" abre BEGIN IMMEDIATE y toma el lock de escritura
// de entrada, asi que solo una transaccion de escritura puede estar activa. La
// segunda ve el estado ya final y los reclamos de aviso ya puestos, y sale como
// no-op sin enviar nada.
export async function finalizePaidOrderByCode(code: string): Promise<boolean> {
  const db = await getDb();

  const orderResult = await db.execute({
    sql: "SELECT id, status FROM orders WHERE code = ?",
    args: [code],
  });
  const order = orderResult.rows[0] as unknown as
    | { id: number; status: string }
    | undefined;
  if (!order) return false;
  // Ya finalizada (pagado/preparando/enviado/entregado/sin_stock): nada que
  // re-procesar. La primera finalizacion gana, el stock se descuenta una sola
  // vez y un pedido que ya avanzo no retrocede a 'pagado'.
  if (isOrderFinalized(order.status as OrderStatus)) return false;

  // IMPORTANTE (Turso/LibSQL): NO usar BEGIN / COMMIT / ROLLBACK sueltos con
  // db.execute(): en la base remota cada statement puede ejecutarse en una
  // conexion distinta, por lo que el ROLLBACK del catch se ejecuta sin
  // transaccion activa ("cannot rollback - no transaction is active") y
  // reemplaza/enmascara el error real. Se usa la transaccion del cliente:
  // db.transaction("write") + tx.commit()/tx.rollback(), que gestiona el estado
  // de la transaccion por nosotros.
  const tx = await db.transaction("write");
  let stockShortage: boolean;
  let plan: NotificationPlan;
  try {
    // Estado y reclamos de aviso leidos DENTRO de la transaccion, junto con el
    // email del comprador (sirve para decidir si se le puede escribir).
    const recheck = await tx.execute({
      sql: `SELECT o.status,
                   o.notified_at,
                   o.stock_alerted_at,
                   o.customer_notified_at,
                   c.email AS customer_email
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE o.id = ?`,
      args: [order.id],
    });
    const current = recheck.rows[0] as unknown as
      | {
          status: OrderStatus;
          notified_at: string | null;
          stock_alerted_at: string | null;
          customer_notified_at: string | null;
          customer_email: string | null;
        }
      | undefined;

    const alreadyFinalized = isOrderFinalized(current?.status as OrderStatus);
    if (alreadyFinalized) {
      await tx.rollback();
      return false;
    }

    const itemsResult = await tx.execute({
      sql: "SELECT perfume_id, qty, size FROM order_items WHERE order_id = ?",
      args: [order.id],
    });
    const items = itemsResult.rows as unknown as {
      perfume_id: number;
      qty: number;
      size: number;
    }[];

    // Validacion de stock dentro de la transaccion: se relee cada producto y se
    // compara contra la cantidad pedida ANTES de descontar. Si algo no alcanza,
    // la orden queda 'sin_stock' y no se descuenta nada.
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
      // Validacion por tamano: la talla pedida tambien debe alcanzar, no solo
      // el stock total (una talla agotada no se puede vender aunque sobre stock
      // de otra). Asi el UPDATE de abajo no puede llevar stock_<size> a negativo.
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

    // El plan de avisos sale de los reclamos leidos en ESTA transaccion, de modo
    // que la deduplicacion entre webhook y confirmacion la resuelve el lock y no
    // una lectura suelta que podia estar desactualizada.
    plan = planNotifications({
      orderStatus: stockShortage ? "sin_stock" : "pagado",
      stockShortage,
      adminOrderNotifiedAt: current?.notified_at ?? null,
      stockAlertedAt: current?.stock_alerted_at ?? null,
      customerNotifiedAt: current?.customer_notified_at ?? null,
      hasCustomerEmail: Boolean(current?.customer_email?.trim()),
    });

    // Reclama atomicamente los avisos que el plan dice enviar y fija el estado.
    // COALESCE en las tres columnas: un reclamo ya puesto no se pisa. Si el plan
    // no pide un aviso, la columna queda como estaba (CASE), para que un
    // pedido sin stock no ensucie el reclamo de la orden normal.
    const claimedAt = new Date().toISOString();
    await tx.execute({
      sql: `UPDATE orders
            SET status = ?,
                notified_at = CASE WHEN ? THEN COALESCE(notified_at, ?) ELSE notified_at END,
                stock_alerted_at = CASE WHEN ? THEN COALESCE(stock_alerted_at, ?) ELSE stock_alerted_at END,
                customer_notified_at = CASE WHEN ? THEN COALESCE(customer_notified_at, ?) ELSE customer_notified_at END
            WHERE id = ?`,
      args: [
        stockShortage ? "sin_stock" : "pagado",
        plan.adminNewOrder ? 1 : 0,
        claimedAt,
        plan.adminStockAlert ? 1 : 0,
        claimedAt,
        plan.customerConfirmation ? 1 : 0,
        claimedAt,
        order.id,
      ],
    });

    if (!stockShortage) {
      for (const item of items) {
        if (item.perfume_id === null) continue;
        const size = [30, 50, 100].includes(item.size) ? item.size : 100;
        // Se descuenta sin MAX(0,...): el stock (total y por tamano) ya se
        // valido antes, de modo que el UPDATE no puede dejar stock negativo.
        await tx.execute({
          sql: `UPDATE perfumes SET stock_${size} = stock_${size} - ?, stock = stock - ? WHERE id = ?`,
          args: [item.qty, item.qty, item.perfume_id],
        });
      }
    }

    await tx.commit();
  } catch (error) {
    // El rollback es secundario y no debe ocultar el error original: si
    // falla, se loguea y se relanza el error primario.
    if (!tx.closed) {
      try {
        await tx.rollback();
      } catch {
        console.error("[checkout-finalize] rollback fallido");
      }
    }
    throw error;
  }

  // Los avisos salen DESPUES del commit. Si el envio fallara, el pedido ya esta
  // pagado y el stock ya descontado, y eso no se revierte: un correo caido nunca
  // puede deshacer una compra. Los reclamos ya quedaron escritos en la
  // transaccion, asi que el panel admin puede reenviar a mano.
  if (stockShortage) {
    console.warn(
      `[checkout-finalize] Pedido ${code} marcado 'sin_stock' (pago cobrado, stock insuficiente)`
    );
  }

  const fullOrder = await getOrderById(order.id);
  if (fullOrder) {
    // Se manda solo lo que el plan (= lo que esta transaccion reclamo). Si al
    // armar el pedido completo alguna columna no coincide, se cae al envio
    // urgente de sin_stock y no se anuncia una venta que no se puede cumplir.
    const planForSend: NotificationPlan = stockShortage
      ? {
          adminNewOrder: false,
          adminStockAlert: plan.adminStockAlert,
          customerConfirmation: false,
        }
      : plan;

    notifyNewOrder(fullOrder, planForSend).catch(() => {
      // notifyNewOrder ya registro que canal fallo. Aca solo se deja constancia
      // de que el pedido quedo pagado con un aviso pendiente, sin volcar el error
      // (puede traer datos del servidor SMTP).
      console.error(
        `[checkout-finalize] Pedido ${code} pagado con avisos pendientes; se pueden reenviar desde el panel`
      );
    });
  }

  if (stockShortage) return false;
  return true;
}
