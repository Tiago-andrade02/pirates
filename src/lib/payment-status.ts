// Vocabulario de estados de Mercado Pago, aislado y sin dependencias.
//
// El bug que motivo este modulo: la pagina de resultado comparaba el parametro
// `status` contra la cadena literal "success". Mercado Pago NUNCA envia
// "success" en back_urls: devuelve su propio vocabulario (approved / pending /
// rejected / cancelled). Con `status=approved` la comparacion fallaba y la
// pagina mostraba "Pago no completado" con el pago ya aprobado y el dinero
// debitado.
//
// "success" se conserva unicamente como alias de la redireccion interna del
// Payment Brick (PaymentBrick.tsx), que si lo usa. No es vocabulario de MP.

export type PaymentOutcome = "approved" | "pending" | "rejected" | "unknown";

// Solo "approved" (y el alias interno "success" del Brick) es aprobado.
// "authorized" NO lo es: en MP significa autorizado y aun NO capturado, asi que
// se trata como pendiente para no marcar un pedido como pagado antes de que el
// dinero se haya acreditado.
const APPROVED = new Set(["approved", "success"]);

const PENDING = new Set([
  "pending",
  "in_process",
  "inprocess",
  "authorized",
  "requires_action",
]);

const REJECTED = new Set([
  "rejected",
  "cancelled",
  "canceled",
  "failed",
  "expired",
  "charged_back",
]);

export function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

// Clasifica un estado de MP. Un estado ausente, vacio o desconocido NO se
// clasifica como fallo: devuelve "unknown" para que la interfaz muestre
// "Verificando pago" en lugar de afirmar que el pago no se completo.
export function classifyPaymentStatus(
  status: string | null | undefined
): PaymentOutcome {
  const normalized = normalizeStatus(status);
  if (!normalized) return "unknown";
  if (APPROVED.has(normalized)) return "approved";
  if (PENDING.has(normalized)) return "pending";
  if (REJECTED.has(normalized)) return "rejected";
  return "unknown";
}

export function isApproved(status: string | null | undefined): boolean {
  return classifyPaymentStatus(status) === "approved";
}
