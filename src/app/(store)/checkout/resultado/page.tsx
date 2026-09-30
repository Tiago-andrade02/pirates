import Link from "next/link";
import { getDb } from "@/lib/db";
import { getPayment, type MercadoPagoPayment } from "@/lib/mercadopago";
import {
  resolvePaymentState,
  isAlreadyFinalized,
  type PaymentOutcome,
  type ResolveReason,
} from "@/lib/payment-verify";
import type { OrderStatus } from "@/lib/types";
import { CheckIcon, CloseIcon, CartIcon } from "@/components/icons";
import { ClearCartOnPaid } from "./ClearCartOnPaid";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface Decision {
  state: PaymentOutcome;
  reason: ResolveReason;
  orderStatus: OrderStatus | null;
  paymentId: string | null;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

async function loadOrder(
  code: string
): Promise<{ status: OrderStatus; total: number } | null> {
  const db = await getDb();
  const found = await db.execute({
    sql: "SELECT status, total FROM orders WHERE code = ?",
    args: [code],
  });
  const row = found.rows[0] as unknown as
    | { status: OrderStatus; total: number }
    | undefined;
  return row ? { status: row.status, total: Number(row.total) } : null;
}

// Verificacion READ-ONLY: decide que mostrar cruzando el pedido en la base con
// el estado real del pago en /v1/payments/{id}. NO escribe nada.
//
// El parametro `status` de la URL no participa de la decision: solo se lo mira
// como pista de orientacion, porque el bug de origen era exactamente confiar en
// el (Mercado Pago devuelve "approved", no "success", asi que un pago aprobado
// se mostraba como fallido).
//
// La escritura vive en POST /api/mercadopago/confirm y en el webhook, para que
// renderizar una pagina no tenga efectos secundarios.
async function decide(code: string, paymentId: string): Promise<Decision> {
  let order: { status: OrderStatus; total: number } | null = null;
  try {
    order = await loadOrder(code);
  } catch (error) {
    console.error(
      "[checkout/resultado] no se pudo leer el pedido:",
      error instanceof Error ? error.message : error
    );
  }

  const orderStatus = order?.status ?? null;

  if (!paymentId) {
    // Camino del Payment Brick: su redireccion interna no lleva payment_id, asi
    // que no hay nada que consultar en MP y la base es la unica fuente.
    return {
      state: orderStatus && isAlreadyFinalized(orderStatus) ? "approved" : "unknown",
      reason: "no_payment_info",
      orderStatus,
      paymentId: null,
    };
  }

  let payment: MercadoPagoPayment | null = null;
  try {
    payment = await getPayment(paymentId);
  } catch (error) {
    // 404 o API caida: no se puede afirmar nada, pero tampoco se afirma que fallo.
    console.error(
      "[checkout/resultado] Mercado Pago no respondio:",
      error instanceof Error ? error.message : error
    );
  }

  if (!payment) {
    return { state: "unknown", reason: "no_payment_info", orderStatus, paymentId };
  }

  const decision = resolvePaymentState({
    orderCode: code,
    orderStatus,
    orderTotal: order?.total ?? null,
    mpStatus: payment.status,
    mpAmount: payment.transaction_amount ?? null,
    mpCurrency: payment.currency_id ?? null,
    mpReference: payment.external_reference ?? null,
  });

  return {
    state: decision.state,
    reason: decision.reason,
    orderStatus,
    paymentId: String(payment.id),
  };
}

const TONE = {
  approved: {
    ring: "border-emerald-500/30 bg-emerald-500/10",
    title: "¡Pago aprobado!",
    body: "Recibimos tu pedido correctamente. Te contactaremos por WhatsApp para coordinar la entrega.",
  },
  pending: {
    ring: "border-amber-500/30 bg-amber-500/10",
    title: "Pago en proceso",
    body: "Estamos esperando la acreditación de Mercado Pago. Te avisaremos por WhatsApp cuando esté confirmado.",
  },
  rejected: {
    ring: "border-red-500/30 bg-red-500/10",
    title: "Pago rechazado",
    body: "Mercado Pago no aprobó el pago. Podés reintentar el pedido o escribirnos por WhatsApp para asistirte.",
  },
  unknown: {
    ring: "border-white/20 bg-white/5",
    title: "Verificando pago",
    body: "Estamos confirmando el pago con Mercado Pago. Te avisaremos por WhatsApp en cuanto sepamos el resultado.",
  },
} as const;

const NO_STOCK_TITLE = "Pago aprobado, sin stock";
const NO_STOCK_BODY =
  "Recibimos el pago pero no hay stock disponible para completar el pedido. Escribinos por WhatsApp y lo resolvemos.";

export default async function ResultadoPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Mercado Pago manda status, payment_id (collection_id lleva el mismo valor) y
  // external_reference con el codigo del pedido.
  const code = first(params.external_reference).toUpperCase();
  const paymentId = first(params.payment_id) || first(params.collection_id);

  const decision: Decision = code
    ? await decide(code, paymentId)
    : {
        state: "unknown",
        reason: "no_payment_info",
        orderStatus: null,
        paymentId: null,
      };

  // El webhook puede marcar 'sin_stock': el pago SI quedo aprobado (el dinero se
  // debito) pero no hay stock para cumplirlo. No es un pago rechazado, asi que se
  // distingue del resto con su propio mensaje.
  const noStock = decision.state === "approved" && decision.orderStatus === "sin_stock";
  const state: PaymentOutcome = noStock ? "rejected" : decision.state;
  const tone = TONE[state];

  // Solo se puede marcar pagado si MP aprueba y supero referencia, moneda e
  // importe. Cualquier otro reason significa que una validacion fallo.
  const verified = decision.state === "approved" && decision.reason === "approved";
  const settled = isAlreadyFinalized(decision.orderStatus);
  // Aprobado y verificado pero la base todavia no lo refleja (webhook caido o
  // demorado): se pide la reconciliacion al endpoint de confirmacion.
  const needsConfirm = verified && !settled;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full border ${tone.ring}`}
      >
        {state === "approved" ? (
          <CheckIcon className="h-8 w-8 text-emerald-400" />
        ) : state === "rejected" ? (
          <CloseIcon className="h-8 w-8 text-red-400" />
        ) : (
          <span
            aria-hidden
            className={`h-8 w-8 animate-spin rounded-full border-2 border-white/25 ${
              state === "pending" ? "border-t-amber-400" : "border-t-white"
            }`}
          />
        )}
      </div>

      <h1 className="mt-6 font-serif text-3xl text-white">
        {noStock ? NO_STOCK_TITLE : tone.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {noStock ? NO_STOCK_BODY : tone.body}
      </p>

      {code && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-faint">
            Código de pedido: <span className="font-semibold text-white">{code}</span>
          </p>
          <Link
            href={`/pedido/${encodeURIComponent(code)}`}
            className="text-xs font-medium text-gold hover:underline"
          >
            Ver estado y seguimiento del pedido
          </Link>
        </div>
      )}

      <ClearCartOnPaid
        clear={state === "approved"}
        confirm={needsConfirm}
        orderCode={code}
        paymentId={decision.paymentId}
      />

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/perfumes"
          className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          {state === "approved" ? "Seguir explorando" : "Volver al catálogo"}
        </Link>
        {state === "rejected" && (
          <Link
            href="/carrito"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line px-7 text-sm font-semibold text-white transition-colors hover:bg-surface"
          >
            <CartIcon className="h-4 w-4" />
            Volver al carrito
          </Link>
        )}
      </div>
    </div>
  );
}
