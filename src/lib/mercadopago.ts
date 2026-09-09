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

export function hasCredentials(): boolean {
  return getAccessToken().startsWith("TEST-") || getAccessToken().startsWith("APP_USR-");
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
      notification_url: input.notificationUrl,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    let msg = `Mercado Pago ${res.status}: Error desconocido`;
    try {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      msg =
        typeof parsed.message === "string" && parsed.message
          ? `Mercado Pago ${res.status}: ${parsed.message.slice(0, 200)}`
          : typeof parsed.error_description === "string" && parsed.error_description
            ? `Mercado Pago ${res.status}: ${parsed.error_description.slice(0, 200)}`
            : msg;
    } catch {
      // JSON inválido: usar mensaje genérico sin exponer el body crudo.
    }
    throw new Error(msg);
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
    const body = await res.text();
    throw new Error(`Mercado Pago ${res.status}: ${body}`);
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
    console.log("[mercadopago/createPayment] diag access_token:", {
      existe: token.length > 0,
      largo: token.length,
      primeros8: token.length >= 8 ? token.slice(0, 8) : "(menor a 8)",
      ultimos4: token.length >= 4 ? token.slice(-4) : "(menor a 4)",
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
    const safeBody: Record<string, unknown> = { ...body };
    if (typeof safeBody.payer === "object" && safeBody.payer !== null) {
      const p = safeBody.payer as Record<string, unknown>;
      safeBody.payer = {
        hasEmail: typeof p.email === "string" && p.email.length > 0,
        hasIdentification:
          !!p.identification &&
          typeof p.identification === "object" &&
          Object.keys(p.identification as object).length > 0,
      };
    }
    if (typeof safeBody.token === "string" && safeBody.token) {
      safeBody.token = `••••${(safeBody.token as string).slice(-4)}`;
    }
    console.log("[mercadopago/createPayment] payload final a /v1/payments:", safeBody);
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

  // Extrae SOLO campos seguros del body de error de Mercado Pago (status,
  // error, message, status_detail, cause[].code/description) para diagnóstico.
  // NUNCA se capturan token, public_key, payer, email ni DNI (whitelist).
  const extractSafe = (raw: Record<string, unknown>): Record<string, unknown> | null => {
    if (!raw || typeof raw !== "object") return null;
    const safe: Record<string, unknown> = {};
    for (const k of ["status", "error", "message", "status_detail", "error_detail", "id", "error_description"]) {
      const v = raw[k];
      if (v !== undefined && v !== null) safe[k] = typeof v === "string" ? v : String(v);
    }
    if (Array.isArray(raw.cause)) {
      safe.cause = raw.cause
        .map((c) => {
          if (!c || typeof c !== "object") return null;
          const cc = c as Record<string, unknown>;
          const out: Record<string, unknown> = {};
          if (cc.code !== undefined && cc.code !== null) out.code = cc.code;
          if (cc.description !== undefined && cc.description !== null) out.description = String(cc.description);
          return out;
        })
        .filter((c) => c !== null);
    }
    return Object.keys(safe).length ? safe : null;
  };

  if (!res.ok || !data.id) {
    // El mensaje que llega al cliente NO incluye el detalle crudo del error de
    // Mercado Pago: se devuelve un mensaje genérico para no exponer internos.
    const err = new Error(
      `Mercado Pago ${res.status}: ${res.statusText || "Error al procesar el pago"}`
    ) as Error & { mpRaw?: string | null; retryable?: boolean };
    err.mpRaw = extractSafe(data) ? JSON.stringify(extractSafe(data)) : null;
    err.retryable = res.status >= 500;
    if (PAYMENT_DIAG && err.mpRaw) {
      console.log("[mercadopago/createPayment] body de error MP (solo campos seguros):", extractSafe(data));
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
