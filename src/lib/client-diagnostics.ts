import { getDb } from "@/lib/db";

export interface ClientDiagnosticInput {
  eventType: string;
  message: string;
  buildTag: string;
  hasSelectedMethod: boolean;
  selectedMethodType: string;
  hasAdditionalPaymentType: boolean;
  paymentMethodId: string;
  installments: string;
  issuerId: string;
}

// Registra un evento de diagnóstico del navegador (onSubmit/onError) SIN ningún
// dato sensible (ni token, tarjeta, CVV, email ni DNI).
export async function recordClientDiagnostic(
  input: ClientDiagnosticInput
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO client_diagnostics
        (event_type, message, build_tag, has_selected_method, selected_method_type, has_additional_payment_type, payment_method_id, installments, issuer_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.eventType,
        input.message,
        input.buildTag,
        input.hasSelectedMethod ? 1 : 0,
        input.selectedMethodType,
        input.hasAdditionalPaymentType ? 1 : 0,
        input.paymentMethodId,
        input.installments,
        input.issuerId,
        new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.error("[client-diagnostics] no se pudo registrar:", err);
  }
}
