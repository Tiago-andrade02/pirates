import { getDb } from "@/lib/db";
import { getPayment } from "@/lib/mercadopago";
import { attachPaymentToOrder, finalizePaidOrderByCode } from "@/lib/checkout-finalize";
import { recordPaymentDiagnostic } from "@/lib/payment-diagnostics";
import { verifyOrderPayment, PaymentNotFoundError } from "@/lib/payment-verify";
import { clientIp, rateLimitConsume } from "@/lib/rate-limit";
import type { OrderStatus } from "@/lib/types";

const CONFIRM_MAX_ATTEMPTS = 30;
const CONFIRM_WINDOW_MS = 10 * 60 * 1000;

// El mismo formato que genera checkout/route.ts (orderCode): 8 bytes en hex.
const CODE_PATTERN = /^PIR-[0-9A-F]{16}$/;

interface ConfirmBody {
  code?: string;
  paymentId?: string | number;
}

// POST /api/mercadopago/confirm
//
// Camino de Checkout Pro: el pago lo crea y aprueba Mercado Pago fuera de
// nuestro control, asi que la unica finalizacion posible es la del webhook. Si
// el webhook se demora, cae o devuelve un error, el pedido queda 'pendiente'
// con el dinero ya debitado y la pagina de resultado mintiendo.
//
// Este endpoint es el respaldo explicito: el cliente lo llama cuando la pagina
// de resultado ve un pago aprobado que todavia no esta finalizado en la base.
// NUNCA confia en lo que dice el cuerpo de la peticion: vuelve a consultar
// /v1/payments/{id} a Mercado Pago y revalida referencia, moneda e importe
// contra el pedido antes de finalizar. finalizePaidOrderByCode es idempotente
// y attachPaymentToOrder no pisa un payment_id previo, asi que llamarlo de mas
// no descuenta stock dos veces ni duplica el pago.
//
// Se responde 200 tambien cuando el pago no esta aprobado: es una respuesta
// valida ("aun no se pudo confirmar"), no un error del endpoint.
export async function POST(request: Request) {
  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return Response.json({ error: "Body inválido" }, { status: 400 });
  }

  if (
    !(await rateLimitConsume(
      `confirm:${clientIp(request.headers)}`,
      CONFIRM_MAX_ATTEMPTS,
      CONFIRM_WINDOW_MS
    ))
  ) {
    return Response.json(
      { error: "Demasiados intentos. Recargá la página en un momento." },
      { status: 429 }
    );
  }

  const code = (body.code ?? "").trim().toUpperCase();
  const paymentId = body.paymentId === undefined ? "" : String(body.paymentId).trim();

  if (!CODE_PATTERN.test(code)) {
    return Response.json({ error: "Código de pedido inválido" }, { status: 400 });
  }
  if (!/^\d+$/.test(paymentId)) {
    return Response.json({ error: "Identificador de pago inválido" }, { status: 400 });
  }

  const db = await getDb();
  let result;
  try {
    result = await verifyOrderPayment(code, paymentId, {
      fetchPayment: async (id) => {
        try {
          return await getPayment(id);
        } catch {
          return null;
        }
      },
      loadOrder: async (orderCode) => {
        const found = await db.execute({
          sql: "SELECT status, total FROM orders WHERE code = ?",
          args: [orderCode],
        });
        const row = found.rows[0] as unknown as
          | { status: string; total: number }
          | undefined;
        if (!row) return null;
        return { status: row.status as OrderStatus, total: Number(row.total) };
      },
      finalizeOrder: async (orderCode) => {
        // Devuelve si el pedido estaba pagado; el detalle no importa acá porque
        // la idempotencia ya la garantiza finalizePaidOrderByCode.
        await finalizePaidOrderByCode(orderCode);
      },
      attachPayment: (orderCode, id) => attachPaymentToOrder(orderCode, id),
    });
  } catch (error) {
    if (error instanceof PaymentNotFoundError) {
      await recordPaymentDiagnostic({
        externalReference: code,
        paymentTypeId: "",
        paymentMethodId: "",
        installments: "",
        mpResult: "confirm:not_found",
        mpError: "payment_not_found",
      });
      // El pago todavia no es consultable: se devuelve 202 para que la pagina
      // siga mostrando "verificando" en vez de afirmar que fallo.
      return Response.json(
        { state: "unknown", reason: "no_payment_info", orderStatus: null },
        { status: 202 }
      );
    }
    console.error(
      "[mercadopago/confirm] error verificando:",
      error instanceof Error ? error.message : error
    );
    return Response.json(
      { error: "No se pudo verificar el pago" },
      { status: 500 }
    );
  }

  if (result.state !== "approved" || result.reason !== "approved") {
    await recordPaymentDiagnostic({
      externalReference: code,
      paymentTypeId: "",
      paymentMethodId: "",
      installments: "",
      mpResult: `confirm:${result.state}`,
      mpError: result.reason,
    });
  }

  return Response.json({
    state: result.state,
    reason: result.reason,
    orderStatus: result.orderStatus,
    finalized: result.finalized,
  });
}
