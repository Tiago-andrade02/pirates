import crypto from "node:crypto";

const API_BASE = "https://api.mercadopago.com";

// Habilita los logs detallados de diagnóstico de pagos (payloads enmascarados,
// token parcial, body de errores MP) para depurar sin exponer datos sensibles.
// En producción queda deshabilitado a menos que se pida explícitamente.
const PAYMENT_DIAG = process.env.ENABLE_PAYMENT_DIAGNOSTICS === "true" && process.env.NODE_ENV !== "production";

export function getAccessToken(): string {
  return process.env.MERCADO_PAGO_ACCESS_TOKEN ?? "";
}

export function getPublicKey(): string {
  return process.env.MERCADO_PAGO_PUBLIC_KEY ?? "";
}

// En producción SOLO se acepta un token LIVE (APP_USR-). Un token de prueba
// (TEST-) en prod es un error de configuración: cobraría con la cuenta sandbox
// y rompería los pagos reales silenciosamente. En dev/test ambos se aceptan.
export function hasCredentials(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  if (process.env.NODE_ENV === "production") {
    return token.startsWith("APP_USR-");
  }
  return token.startsWith("TEST-") || token.startsWith("APP_USR-");
}

export interface PreferenceItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

export interface PreferenceInput {
  items: PreferenceItem[];
  externalReference: string;
  payer?: { name?: string; phone?: string; email?: string };
  backUrls: { success: string; pending: string; failure: string };
  notificationUrl: string;
}

export interface PreferenceResult {
  id: string;
  initPoint: string;
  sandboxInitPoint: string;
}

export async function createPreference(
  input: PreferenceInput
): Promise<PreferenceResult> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
  }

  const res = await fetch(`${API_BASE}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: "ARS",
      })),
      payer: {
        name: input.payer?.name,
        phone: input.payer?.phone ? { area_code: "54", number: input.payer.phone } : undefined,
        email: input.payer?.email,
      },
      external_reference: input.externalReference,
      back_urls: input.backUrls,
      auto_return: "approved",
      // Checkout Pro ofrece por defecto TODOS los métodos de la cuenta. Se
      // excluyen los offline (tickets/efectivo, cajeros y transferencia) para
      // que, al redirigir, solo se vean métodos online (tarjetas + billetera).
      // Las cuotas/promociones las determina y aplica Mercado Pago.
      payment_methods: {
        excluded_payment_types: [
          { id: "ticket" },
          { id: "atm" },
          { id: "bank_transfer" },
        ],
      },
      notification_url: input.notificationUrl,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    // No se propaga el cuerpo de respuesta de Mercado Pago: sus campos
    // message/error_description son texto libre que puede incluir ultimos 4 de
    // tarjeta, DNI o nombre del titular. Se propaga solo el estado HTTP como
    // codigo generico, que es lo unico accionable desde el checkout.
    const err = new Error(`Mercado Pago http_${res.status}`) as Error & {
      mpStatus?: number;
    };
    err.mpStatus = res.status;
    throw err;
  }

  const data = (await res.json()) as {
    id: string;
    init_point: string;
    sandbox_init_point: string;
  };

  return {
    id: data.id,
    initPoint: data.init_point,
    sandboxInitPoint: data.sandbox_init_point,
  };
}

export interface MercadoPagoPayment {
  id: number;
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | string;
  external_reference?: string | null;
  currency_id?: string | null;
  transaction_amount?: number | null;
}

export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // Igual que en createPreference: no se propaga el cuerpo de la respuesta.
    // Este error lo consume el webhook, que lo loguea, asi que un body crudo
    // de MP terminaria en los logs con posible PII del pagador.
    const err = new Error(`Mercado Pago http_${res.status}`) as Error & {
      mpStatus?: number;
    };
    err.mpStatus = res.status;
    throw err;
  }

  return (await res.json()) as MercadoPagoPayment;
}

export interface CreatePaymentInput {
  transactionAmount: number;
  description: string;
  externalReference: string;
  token?: string;
  paymentMethodId?: string;
  paymentTypeId?: string;
  installments?: number;
  issuerId?: string | null;
  payerEmail?: string;
  payerIdentification?: { type?: string; number?: string };
}

export interface CreatedPayment {
  id: number;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
}

// Crea un pago de Mercado Pago desde el backend (POST /v1/payments).
// Debe usarse dentro de onsubmit del Payment Brick para cobrar tarjeta.
// Reintenta SOLO errores transitorios (red o HTTP >= 500) hasta 3 veces con la
// MISMA X-Idempotency-Key: si el primer intento llegó a MP, el reintento no
// duplica el cargo (MP devuelve el mismo pago). Los 4xx (tarjeta rechazada,
// token inválido, etc.) nunca se reintentan.
export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatedPayment> {
  const token = getAccessToken();

  if (PAYMENT_DIAG) {
    // Solo se informa si el token esta presente. Nunca se registran sus
    // caracteres (ni total, ni primeros, ni ultimos): cualquier fragmento de
    // un secreto en logs queda expuesto a quien tenga acceso al log.
    console.log("[mercadopago/createPayment] credenciales:", {
      access_token_configurado: token.length > 0,
    });
  }

  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    }
    try {
      return await createPaymentOnce(input, token);
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof Error &&
        (error as Error & { retryable?: boolean }).retryable === true;
      if (!retryable) break;
    }
  }
  throw lastError;
}

async function createPaymentOnce(
  input: CreatePaymentInput,
  token: string
): Promise<CreatedPayment> {
  const body: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description,
    external_reference: input.externalReference,
    payer: { email: input.payerEmail },
  };
  if (input.payerIdentification?.type && input.payerIdentification.number) {
    (body.payer as Record<string, unknown>).identification = {
      type: input.payerIdentification.type,
      number: input.payerIdentification.number,
    };
  }
  if (input.token) body.token = input.token;
  if (input.paymentMethodId) body.payment_method_id = input.paymentMethodId;
  if (input.paymentTypeId) body.payment_type_id = input.paymentTypeId;
  if (input.installments) body.installments = input.installments;
  if (input.issuerId) body.issuer_id = input.issuerId;

  if (PAYMENT_DIAG) {
    // Whitelist minima de campos ESTRUCTURADOS. No se copia el body ni el
    // payer: description puede contener texto del pedido y el token de tarjeta
    // es un secreto de un solo uso. Solo interesan el monto y como se paga.
    console.log("[mercadopago/createPayment] payload a /v1/payments:", {
      transaction_amount: body.transaction_amount,
      payment_method_id: body.payment_method_id ?? null,
      payment_type_id: body.payment_type_id ?? null,
      installments: body.installments ?? null,
      issuer_id: body.issuer_id ?? null,
      token_enviado: typeof body.token === "string" && !!body.token,
      payer_enviado: typeof body.payer === "object" && body.payer !== null,
    });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": input.externalReference,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    const err = new Error(
      "Mercado Pago no respondió. Intentalo de nuevo."
    ) as Error & { mpRaw?: string | null; retryable?: boolean };
    err.retryable = true;
    throw err;
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  // Resumen ESTRUCTURADO del fallo. Solo se conservan identificadores y codigos
  // de Mercado Pago: NUNCA texto libre (message, error_description, cause
  // description), porque MP suele incluir ultimos 4 de tarjeta, DNI o nombre del
  // titular en esos campos. Tampoco se capturan token, public_key ni payer.
  const extractSafe = (raw: Record<string, unknown>): Record<string, unknown> | null => {
    if (!raw || typeof raw !== "object") return null;
    const safe: Record<string, unknown> = {};
    for (const k of ["status", "id"]) {
      const v = raw[k];
      if (v !== undefined && v !== null) safe[k] = typeof v === "string" ? v : String(v);
    }
    if (Array.isArray(raw.cause)) {
      const codes = raw.cause
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const code = (c as Record<string, unknown>).code;
          return typeof code === "string" ? code : null;
        })
        .filter((c): c is string => c !== null);
      if (codes.length) safe.cause_codes = [...new Set(codes)];
    }
    return Object.keys(safe).length ? safe : null;
  };

  if (!res.ok || !data.id) {
    // El mensaje que llega al cliente NO incluye el detalle crudo del error de
    // Mercado Pago: se devuelve un mensaje generico para no exponer internos.
    const err = new Error(
      `Mercado Pago ${res.status}: ${res.statusText || "Error al procesar el pago"}`
    ) as Error & { mpRaw?: string | null; mpStatus?: number; retryable?: boolean };
    err.mpStatus = res.status;
    err.mpRaw = extractSafe(data) ? JSON.stringify(extractSafe(data)) : null;
    err.retryable = res.status >= 500;
    if (PAYMENT_DIAG) {
      console.log("[mercadopago/createPayment] fallo en /v1/payments:", {
        http_status: res.status,
        retryable: err.retryable,
        resumen: extractSafe(data),
      });
    }
    throw err;
  }

  return {
    id: Number(data.id),
    status: String(data.status),
    status_detail: data.status_detail ? String(data.status_detail) : null,
    transaction_amount: Number(data.transaction_amount),
  };
}

export function verifyWebhookSignature(input: {
  signature: string | null;
  requestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? "";
  if (!secret || !input.signature || !input.requestId || !input.dataId) {
    return false;
  }

  // Mercado Pago envía el header así: "ts=1704908010,v1=<hex>" (a veces usa
  // '&' como separador). El formato real NO es URL-encoded, por eso se parsea
  // manualmente en lugar de usar URLSearchParams.
  const params: Record<string, string> = {};
  for (const pair of input.signature.split(/[,&]/)) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    params[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  const ts = params["ts"];
  const v1 = params["v1"];
  if (!ts || !v1) return false;

  // Anti-replay: rechazar firmas con timestamp muy viejo o del futuro.
  const tsMs = Number(ts);
  if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex")
    .toLowerCase();

  // Mismo largo garantizado (hash de ambos) para timingSafeEqual.
  const a = crypto.createHash("sha256").update(expected).digest();
  const b = crypto.createHash("sha256").update(v1.toLowerCase()).digest();
  return crypto.timingSafeEqual(a, b);
}
