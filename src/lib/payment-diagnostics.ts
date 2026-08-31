import { getDb } from "@/lib/db";

export interface PaymentDiagnosticInput {
  externalReference: string;
  paymentTypeId: string;
  paymentMethodId: string;
  installments: string;
  mpResult: string;
  mpError: string;
}

// Registra un diagnóstico de pago SIN datos sensibles (ni token, CVV, email ni DNI).
export async function recordPaymentDiagnostic(
  input: PaymentDiagnosticInput
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO payment_diagnostics
        (external_reference, payment_type_id, payment_method_id, installments, mp_result, mp_error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.externalReference,
        input.paymentTypeId,
        input.paymentMethodId,
        input.installments,
        input.mpResult,
        input.mpError,
        new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.error("[payment-diagnostics] no se pudo registrar:", err);
  }
}
