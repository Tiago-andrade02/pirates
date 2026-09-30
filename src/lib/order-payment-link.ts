// SQL de asociacion entre el pago de Mercado Pago y el pedido.
//
// Vive solo, sin imports, para que:
//  - lo reutilicen el webhook, la confirmacion desde la pagina de resultado y
//    el endpoint de pago del Payment Brick, sin tres copias que pueden divergir;
//  - se pueda testear la idempotencia contra un SQLite real sin resolver los
//    alias "@/lib/*" de TypeScript.
//
// Idempotencia:
//  - COALESCE(NULLIF(mp_payment_id, ''), ?): el primer payment_id que gana.
//    NULLIF cubre la columna con DEFAULT '' de bases ya creadas: un COALESCE
//    sobre '' devolveria '' y no llenaria nada.
//  - COALESCE(paid_at, ?): paid_at se fija una sola vez y no se mueve en una
//    reentrega del webhook.
export const ATTACH_PAYMENT_SQL =
  "UPDATE orders SET mp_payment_id = COALESCE(NULLIF(mp_payment_id, ''), ?), paid_at = COALESCE(paid_at, ?) WHERE code = ?";
