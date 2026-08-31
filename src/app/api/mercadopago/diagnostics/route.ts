import { getDb } from "@/lib/db";

// Endpoint TEMPORAL de diagnóstico: devuelve los últimos registros de pago
// SIN datos sensibles (no hay token, CVV, email ni DNI en la tabla).
// Acceso protegido: header "x-diagnostic-key" debe coincidir con ADMIN_PASSWORD.
export async function GET(request: Request) {
  const secret = process.env.ADMIN_PASSWORD ?? "pirates2026";
  const key = request.headers.get("x-diagnostic-key") ?? "";
  if (key !== secret) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const limitRaw = Number(new URL(request.url).searchParams.get("limit") ?? 40);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 40, 1), 200);

  try {
    const db = await getDb();
    const result = await db.execute({
      sql: `SELECT id, external_reference, payment_type_id, payment_method_id,
                   installments, mp_result, mp_error, created_at
            FROM payment_diagnostics
            ORDER BY id DESC
            LIMIT ?`,
      args: [limit],
    });
    return Response.json({ entries: result.rows });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error al leer el diagnóstico";
    return Response.json({ error: message }, { status: 500 });
  }
}
