import { recordClientDiagnostic } from "@/lib/client-diagnostics";

// Endpoint TEMPORAL de diagnóstico del navegador. Recibe eventos seguros
// (onSubmit/onError) SIN datos sensibles: nunca token, tarjeta, CVV, email ni DNI.
// Los campos se truncan y acotan para evitar ruido.
export async function POST(request: Request) {
  let body: {
    eventType?: string;
    message?: string;
    buildTag?: string;
    hasSelectedMethod?: boolean;
    selectedMethodType?: string;
    hasAdditionalPaymentType?: boolean;
    paymentMethodId?: string;
    installments?: string;
    issuerId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const eventType = String(body.eventType ?? "").slice(0, 20);
  const message = String(body.message ?? "").slice(0, 500);
  const buildTag = String(body.buildTag ?? "").slice(0, 60);

  if (eventType !== "onSubmit" && eventType !== "onError") {
    return Response.json({ ok: false }, { status: 400 });
  }

  await recordClientDiagnostic({
    eventType,
    message,
    buildTag,
    hasSelectedMethod: body.hasSelectedMethod === true,
    selectedMethodType: String(body.selectedMethodType ?? "").slice(0, 20),
    hasAdditionalPaymentType: body.hasAdditionalPaymentType === true,
    paymentMethodId: String(body.paymentMethodId ?? "").slice(0, 40),
    installments: String(body.installments ?? "").slice(0, 20),
    issuerId: String(body.issuerId ?? "").slice(0, 40),
  });

  return Response.json({ ok: true });
}
