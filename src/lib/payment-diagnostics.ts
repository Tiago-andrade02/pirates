import { getDb } from "@/lib/db";

export interface PaymentDiagnosticInput {
  externalReference: string;
  paymentTypeId: string;
  paymentMethodId: string;
  installments: string;
  mpResult: string;
  // Codigo generico del fallo (por ejemplo "http_400"). NUNCA un mensaje
  // libre de Mercado Pago: puede contener ultimos 4 de tarjeta, DNI o nombre.
  mpError: string;
}

// Registra un diagnóstico de pago SOLO con campos estructurados: referencia del
// pedido, metodo, tipo, cuotas, resultado y un codigo de error generico. No se
// persiste mp_raw (respuesta cruda de MP) ni ningun texto libre: la columna se
// deja vacia a proposito para no volver a filtrar PII en la base.
export async function recordPaymentDiagnostic(
  input: PaymentDiagnosticInput
): Promise<void> {
  try {
    const db = await getDb();
    await db.execute({
      sql: `INSERT INTO payment_diagnostics
        (external_reference, payment_type_id, payment_method_id, installments, mp_result, mp_error, mp_raw, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.externalReference,
        input.paymentTypeId,
        input.paymentMethodId,
        input.installments,
        input.mpResult,
        input.mpError,
        "",
        new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.error("[payment-diagnostics] no se pudo registrar:", err);
  }
}
