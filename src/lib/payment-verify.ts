// Verificacion server-side del pago de un pedido.
//
// Regla de oro: el parametro `status` de la URL NUNCA decide el resultado. Se
// consulta a Mercado Pago (/v1/payments/{id}), que es la fuente de verdad, y se
// cruza con el pedido en la base por external_reference, validando moneda e
// importe antes de marcar el pedido como pagado.
//
// La decision vive en resolvePaymentState(), que es pura y sin I/O: recibe los
// datos ya leidos y devuelve que hay que mostrar y si hay que finalizar. Asi la
// matriz de casos (approved / pending / rejected / sin estado / importe
// incorrecto / pedido inexistente / pago duplicado) se puede testear sin red ni
// base de datos.

// Las extensiones son explícitas porque este módulo lo importa directamente el
// runner `node --test`, que no hace resolución de aliases "@/lib/*" ni de
// rutas sin extensión. Los mismos archivos los consume Next vía alias, que
// funciona igual.
import { classifyPaymentStatus } from "./payment-status.ts";
import type { PaymentOutcome } from "./payment-status.ts";
import { ATTACH_PAYMENT_SQL } from "./order-payment-link.ts";
import { isOrderFinalized } from "./types.ts";
import type { OrderStatus } from "./types.ts";

// Se re-exporta porque resolvePaymentState devuelve este tipo y sus consumidores
// (página de resultado, webhook) lo necesitan sin importar dos módulos.
export type { PaymentOutcome };

export const EXPECTED_CURRENCY = "ARS";

// Tolerancia de 1 centavo: los importes llegan como float desde SQLite y desde
// la API de MP, y una diferencia de centavos no es una manipulacion.
const AMOUNT_TOLERANCE_CENTS = 1;

// La comparación de importes se hace EN CENTAVOS, no en la unidad mayor.
//
// Comparar en floats con una tolerancia de 0.01 no funciona: en IEEE-754
// `45000 - 0.01` vale 44999.990000000005, así que `Math.abs(diferencia) > 0.01`
// da TRUE y un pago exactamente 1 centavo menor se rechazaba. Redondeando a
// enteros de centavos la aritmética es exacta y la tolerancia significa lo que
// dice: "difiere en 1 centavo como máximo".
function toCents(value: number): number {
  return Math.round(value * 100);
}

export type ResolveReason =
  | "approved"
  | "pending"
  | "rejected"
  | "no_payment_info"
  | "order_not_found"
  | "reference_mismatch"
  | "currency_mismatch"
  | "amount_mismatch"
  | "amount_invalid";

export interface ResolveInput {
  orderCode: string;
  orderStatus: OrderStatus | null;
  orderTotal: number | null;
  mpStatus: string | null;
  mpAmount: number | null;
  mpCurrency: string | null;
  mpReference: string | null;
}

export interface ResolveOutput {
  state: PaymentOutcome;
  reason: ResolveReason;
  // Solo se finaliza cuando el pago esta aprobado Y supero todas las
  // validaciones. Nunca se finaliza un pedido inexistente, una referencia que
  // no coincide, otra moneda o un importe distinto.
  shouldFinalize: boolean;
}

// La fuente de verdad de "pedido ya finalizado" vive en types.ts
// (isOrderFinalized / FINALIZED_ORDER_STATUSES). Acá solo se agrega el caso
// null/inexistente: un pedido que no existe no está finalizado. Finalizar de
// nuevo seria un no-op, pero se evita siquiera intentarlo.
export function isAlreadyFinalized(status: OrderStatus | null): boolean {
  return status !== null && isOrderFinalized(status);
}

export function resolvePaymentState(input: ResolveInput): ResolveOutput {
  const outcome = classifyPaymentStatus(input.mpStatus);

  if (outcome === "unknown") {
    return { state: "unknown", reason: "no_payment_info", shouldFinalize: false };
  }

  if (outcome === "pending") {
    return { state: "pending", reason: "pending", shouldFinalize: false };
  }

  if (outcome === "rejected") {
    return { state: "rejected", reason: "rejected", shouldFinalize: false };
  }

  // A partir de aqui el pago esta aprobado: hay que validar antes de tocar la
  // base, en este orden, cortando en la primera falla.
  if (input.orderStatus === null) {
    return { state: "approved", reason: "order_not_found", shouldFinalize: false };
  }

  if (!input.mpReference || input.mpReference !== input.orderCode) {
    return { state: "approved", reason: "reference_mismatch", shouldFinalize: false };
  }

  if (!input.mpCurrency || input.mpCurrency !== EXPECTED_CURRENCY) {
    return { state: "approved", reason: "currency_mismatch", shouldFinalize: false };
  }

  const paid = Number(input.mpAmount);
  const total = Number(input.orderTotal);
  if (!Number.isFinite(paid) || !Number.isFinite(total)) {
    return { state: "approved", reason: "amount_invalid", shouldFinalize: false };
  }
  if (Math.abs(toCents(paid) - toCents(total)) > AMOUNT_TOLERANCE_CENTS) {
    return { state: "approved", reason: "amount_mismatch", shouldFinalize: false };
  }

  return {
    state: "approved",
    reason: "approved",
    // Idempotencia: si el pedido ya estaba finalizado, no se vuelve a finalizar.
    // finalizePaidOrderByCode tambien es idempotente; esto evita el trabajo
    // extra y deja el caso del webhook duplicado como un no-op explicito.
    shouldFinalize: !isAlreadyFinalized(input.orderStatus),
  };
}

export interface PaymentSnapshot {
  id: number;
  status: string;
  external_reference?: string | null;
  currency_id?: string | null;
  transaction_amount?: number | null;
}

export interface OrderSnapshot {
  status: OrderStatus;
  total: number;
}

export interface VerifyDeps {
  fetchPayment: (paymentId: string) => Promise<PaymentSnapshot | null>;
  loadOrder: (code: string) => Promise<OrderSnapshot | null>;
  finalizeOrder: (code: string) => Promise<void>;
  attachPayment: (code: string, paymentId: string) => Promise<void>;
}

export interface VerifyResult {
  state: PaymentOutcome;
  reason: ResolveReason;
  orderStatus: OrderStatus | null;
  finalized: boolean;
  paymentId: string | null;
}

export class PaymentNotFoundError extends Error {
  constructor(paymentId: string) {
    super(`Pago ${paymentId} no encontrado en Mercado Pago`);
    this.name = "PaymentNotFoundError";
  }
}

// Reconcilia el pedido con el estado real del pago en Mercado Pago. Idempotente:
// se puede llamar tantas veces como se quiera y solo la primera que encuentre el
// pedido en un estado finalizable lo finaliza.
export async function verifyOrderPayment(
  code: string,
  paymentId: string | null,
  deps: VerifyDeps
): Promise<VerifyResult> {
  const order = await deps.loadOrder(code);

  if (!paymentId) {
    // Sin payment_id no hay nada que consultar en MP. Si el pedido ya esta
    // pagado, la base alcanza como verdad; si no, no se puede afirmar nada.
    return {
      state: order && isAlreadyFinalized(order.status) ? "approved" : "unknown",
      reason: "no_payment_info",
      orderStatus: order?.status ?? null,
      finalized: false,
      paymentId: null,
    };
  }

  const payment = await deps.fetchPayment(paymentId);
  if (!payment) throw new PaymentNotFoundError(paymentId);

  const decision = resolvePaymentState({
    orderCode: code,
    orderStatus: order?.status ?? null,
    orderTotal: order?.total ?? null,
    mpStatus: payment.status,
    mpAmount: payment.transaction_amount ?? null,
    mpCurrency: payment.currency_id ?? null,
    mpReference: payment.external_reference ?? null,
  });

  if (decision.reason !== "approved") {
    return {
      state: decision.state,
      reason: decision.reason,
      orderStatus: order?.status ?? null,
      finalized: false,
      paymentId,
    };
  }

  // El pago está aprobado y TODAS las validaciones pasaron. Ahora sí:
  //
  //  - se finaliza solo si el pedido no estaba ya finalizado (el webhook
  //    duplicado, o el Brick que ya lo finalizó, no repiten el trabajo);
  //  - el enlace con el pago se asegura SIEMPRE, incluso en ese caso, porque
  //    es idempotente y así un fallo previo del attach no deja el pedido
  //    desvinculado de su pago para siempre.
  if (decision.shouldFinalize) {
    await deps.finalizeOrder(code);
  }
  await deps.attachPayment(code, String(payment.id));

  return {
    state: decision.state,
    reason: decision.reason,
    orderStatus: order?.status ?? null,
    finalized: decision.shouldFinalize,
    paymentId,
  };
}

export { ATTACH_PAYMENT_SQL };
