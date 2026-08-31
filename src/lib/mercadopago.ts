import crypto from "node:crypto";

const API_BASE = "https://api.mercadopago.com";

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
    throw new Error(`Mercado Pago ${res.status}: ${body}`);
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
  installments?: number;
  issuerId?: string | null;
  payerEmail?: string;
}

export interface CreatedPayment {
  id: number;
  status: string;
  status_detail: string | null;
  transaction_amount: number;
}

// Crea un pago de Mercado Pago desde el backend (POST /v1/payments).
// Debe usarse dentro de onsubmit del Payment Brick para cobrar tarjeta.
export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatedPayment> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN no configurado");
  }

  const body: Record<string, unknown> = {
    transaction_amount: input.transactionAmount,
    description: input.description,
    external_reference: input.externalReference,
    payer: { email: input.payerEmail },
  };
  if (input.token) body.token = input.token;
  if (input.paymentMethodId) body.payment_method_id = input.paymentMethodId;
  if (input.installments) body.installments = input.installments;
  if (input.issuerId) body.issuer_id = input.issuerId;

  const res = await fetch(`${API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || !data.id) {
    const message =
      typeof data.message === "string"
        ? data.message
        : typeof data.error_description === "string"
          ? data.error_description
          : res.statusText || "Error desconocido de Mercado Pago";
    throw new Error(`Mercado Pago ${res.status}: ${message}`);
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

  const params = new URLSearchParams(input.signature);
  const ts = params.get("ts");
  const v1 = params.get("v1");
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
