// Decision de que avisos de notificacion hay que enviar al finalizar un pedido.
//
// Funcion PURA, sin I/O y sin dependencias, para que la deduplicacion se pueda
// testear sin SMTP ni base de datos. Este modulo es la unica fuente de verdad de
// esas reglas.
//
// Cada aviso tiene su propia columna de reclamo (notified_at / stock_alerted_at
// / customer_email_notified_at / customer_whatsapp_notified_at). El reclamo
// decide si la fase se ejecuta UNA sola vez: como el webhook y la confirmacion
// desde la pagina de resultado pueden correr al mismo tiempo sobre el mismo
// pedido, el primero que gana el reclamo es el unico que envia.
//
// Fase al cliente: el email y el WhatsApp son DOS intentos independientes y
// ahora cada uno tiene su PROPIO reclamo. Antes compartian customer_notified_at,
// asi que un exito parcial quedaba mal representado (si el email salia y el
// WhatsApp fallaba, no habia forma de reintentar solo el WhatsApp, ni de saber
// cual habia llegado). Cada canal mira su columna y su propio dato de contacto:
// una falla del email ya no condiciona al WhatsApp, ni al reves.
//
// Compatibilidad historica: la columna legada customer_notified_at se sigue
// leyendo (legacyCustomerNotifiedAt). Un pedido viejo con esa marca se trata
// como si AMBOS canales ya estuvieran reclamados, para no reenviar nada
// retroactivamente.
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
  // Reclamo por canal de la confirmacion al comprador. El reclamo de fase
  // legado (customer_notified_at) cubria los dos canales a la vez.
  customerEmailNotifiedAt: string | null;
  customerWhatsappNotifiedAt: string | null;
  legacyCustomerNotifiedAt: string | null;
  // El comprador dejo un email utilizable.
  hasCustomerEmail: boolean;
  // El comprador dejo un telefono utilizable (destino del WhatsApp). El email y
  // el WhatsApp son independientes: puede haber uno sin el otro.
  hasCustomerPhone: boolean;
}

export interface NotificationPlan {
  adminNewOrder: boolean;
  adminStockAlert: boolean;
  // Confirmacion de compra al comprador por email. Requiere un email valido.
  customerEmail: boolean;
  // Confirmacion de compra al comprador por WhatsApp. Requiere un telefono
  // valido. NO depende de que el email se haya podido enviar.
  customerWhatsapp: boolean;
}

export function planNotifications(claims: NotificationClaims): NotificationPlan {
  // Un pedido sin stock NO es una compra cumplida: se cobro, pero no hay stock
  // para servirlo. Por eso no va el aviso de "nueva orden" ni la confirmacion al
  // cliente (confirmaria una compra que no se puede preparar). En su lugar va la
  // alerta urgente, que es lo unico accionable.
  if (claims.stockShortage) {
    return {
      adminStockAlert: claims.stockAlertedAt === null,
      adminNewOrder: false,
      customerEmail: false,
      customerWhatsapp: false,
    };
  }

  // Reclamo por canal: el canal se omite si su propia columna ya tiene marca o
  // si el pedido viene de la era del reclamo compartido (customer_notified_at),
  // que cubria email y WhatsApp juntos. Con esto un pedido historico no reenvia
  // nada y un exito parcial solo bloquea el canal que ya salio.
  const emailClaimed =
    claims.customerEmailNotifiedAt !== null || claims.legacyCustomerNotifiedAt !== null;
  const whatsappClaimed =
    claims.customerWhatsappNotifiedAt !== null || claims.legacyCustomerNotifiedAt !== null;

  return {
    adminNewOrder: claims.adminOrderNotifiedAt === null,
    adminStockAlert: false,
    // Cada canal mira su propio reclamo y su propio dato de contacto. Aunque
    // falte el email (o ya haya salido), el WhatsApp sale si hay telefono.
    customerEmail: !emailClaimed && claims.hasCustomerEmail,
    customerWhatsapp: !whatsappClaimed && claims.hasCustomerPhone,
  };
}
