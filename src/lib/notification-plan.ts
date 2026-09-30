// Decision de que avisos de notificacion hay que enviar al finalizar un pedido.
//
// Funcion PURA, sin I/O y sin dependencias, para que la deduplicacion se pueda
// testear sin SMTP ni base de datos. Este modulo es la unica fuente de verdad de
// esas reglas.
//
// Cada aviso tiene su propia columna de reclamo (notified_at /
// stock_alerted_at / customer_notified_at) que se escribe DENTRO de la misma
// transaccion que cambia el estado del pedido. Como el webhook y la confirmacion
// desde la pagina de resultado pueden correr al mismo tiempo sobre el mismo
// pedido, el primero que gana el reclamo es el unico que envia: el segundo ve la
// columna ya puesta y no duplica nada.
import type { OrderStatus } from "./types.ts";

export interface NotificationClaims {
  // Estado que quedo tras finalizar, leido dentro de la transaccion.
  orderStatus: OrderStatus | null;
  // El pedido quedo sin stock: se cobro al comprador pero no se puede cumplir.
  stockShortage: boolean;
  // Columnas de reclamo leidas dentro de la misma transaccion. null significa
  // que nadie lo reclamo todavia, asi que ese aviso se debe enviar.
  adminOrderNotifiedAt: string | null;
  stockAlertedAt: string | null;
  customerNotifiedAt: string | null;
  // El comprador dejo un email utilizable.
  hasCustomerEmail: boolean;
}

export interface NotificationPlan {
  adminNewOrder: boolean;
  adminStockAlert: boolean;
  customerConfirmation: boolean;
}

export function planNotifications(claims: NotificationClaims): NotificationPlan {
  // Un pedido sin stock NO es una compra cumplida: se cobro, pero no hay stock
  // para servirlo. Por eso no va el aviso de "nueva orden" ni el email de
  // confirmacion al cliente (confirmaria una compra que no se puede preparar).
  // En su lugar va la alerta urgente, que es lo unico accionable.
  if (claims.stockShortage) {
    return {
      adminStockAlert: claims.stockAlertedAt === null,
      adminNewOrder: false,
      customerConfirmation: false,
    };
  }

  return {
    adminNewOrder: claims.adminOrderNotifiedAt === null,
    adminStockAlert: false,
    // Sin email del comprador no se inventa un destino ni se gasta un intento de
    // SMTP contra una direccion vacia o invalida.
    customerConfirmation: claims.customerNotifiedAt === null && claims.hasCustomerEmail,
  };
}
