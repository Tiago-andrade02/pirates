import type {
  CreateShipmentInput,
  QuoteOption,
  QuoteRequest,
  ShipmentResult,
  ShippingAgency,
  ShippingProvider,
  TrackingResult,
} from "./types";
import type { DeliveryType } from "@/lib/types";

const PROD_BASE_URL = "https://api.correoargentino.com.ar/micorreo/v1";
const TEST_BASE_URL = "https://apitest.correoargentino.com.ar/micorreo/v1";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function env(name: string): string {
  return process.env[name] ?? "";
}

function baseUrl(): string {
  if (env("CORREO_ARGENTINO_SANDBOX") === "true") {
    return TEST_BASE_URL;
  }
  return env("CORREO_ARGENTINO_API_URL") || PROD_BASE_URL;
}

export function hasCredentials(): boolean {
  return Boolean(
    env("CORREO_ARGENTINO_API_USER") &&
      env("CORREO_ARGENTINO_API_PASSWORD") &&
      env("CORREO_ARGENTINO_CUSTOMER_ID") &&
      env("CORREO_ARGENTINO_ORIGIN_POSTAL_CODE")
  );
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const user = env("CORREO_ARGENTINO_API_USER");
  const password = env("CORREO_ARGENTINO_API_PASSWORD");
  if (!user || !password) {
    throw new Error(
      "Correo Argentino no configurado: faltan CORREO_ARGENTINO_API_USER / CORREO_ARGENTINO_API_PASSWORD"
    );
  }

  const res = await fetch(`${baseUrl()}/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Correo Argentino /token ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { token?: string; expires?: string };
  if (!data.token) {
    throw new Error("Correo Argentino: el servicio /token no devolvió un token");
  }

  let expiresAt = Date.now() + 55 * 60 * 1000;
  if (data.expires) {
    const parsed = Date.parse(data.expires);
    if (!Number.isNaN(parsed)) {
      expiresAt = parsed - 60_000;
    }
  }
  tokenCache = { token: data.token, expiresAt };
  return data.token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message =
      (body as { message?: string })?.message ??
      (body as { code?: string })?.code ??
      `HTTP ${res.status}`;
    throw new Error(`Correo Argentino ${path} ${res.status}: ${message}`);
  }

  return body as T;
}

function mapRate(
  raw: {
    deliveredType?: string;
    productType?: string;
    productName?: string;
    price?: number;
    deliveryTimeMin?: string | null;
    deliveryTimeMax?: string | null;
  },
  deliveryType: DeliveryType,
  validTo: string | null
): QuoteOption {
  return {
    provider: "correo_argentino",
    deliveryType: deliveryType,
    productType: raw.productType ?? "CP",
    productName: raw.productName ?? "Correo Argentino",
    price: Number(raw.price) || 0,
    deliveryTimeMin: raw.deliveryTimeMin ?? null,
    deliveryTimeMax: raw.deliveryTimeMax ?? null,
    validTo,
  };
}

export const correoArgentinoProvider: ShippingProvider = {
  id: "correo_argentino",

  async quote(input: QuoteRequest): Promise<QuoteOption[]> {
    const body: Record<string, unknown> = {
      customerId: env("CORREO_ARGENTINO_CUSTOMER_ID"),
      postalCodeOrigin: env("CORREO_ARGENTINO_ORIGIN_POSTAL_CODE"),
      postalCodeDestination: input.postalCodeDestination,
      dimensions: {
        weight: input.package.weightGrams,
        height: input.package.heightCm,
        width: input.package.widthCm,
        length: input.package.lengthCm,
      },
    };
    if (input.deliveryType) {
      body.deliveredType = input.deliveryType;
    }

    const data = await api<{
      validTo?: string;
      rates?: {
        deliveredType?: string;
        productType?: string;
        productName?: string;
        price?: number;
        deliveryTimeMin?: string | null;
        deliveryTimeMax?: string | null;
      }[];
    }>("/rates", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const rates = data.rates ?? [];
    return rates.map((rate) =>
      mapRate(rate, (rate.deliveredType as DeliveryType) || "D", data.validTo ?? null)
    );
  },

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const body = {
      customerId: env("CORREO_ARGENTINO_CUSTOMER_ID"),
      extOrderId: input.extOrderId,
      orderNumber: input.orderNumber,
      sender: {
        name: env("CORREO_ARGENTINO_SENDER_NAME") || null,
        phone: env("CORREO_ARGENTINO_SENDER_PHONE") || null,
        cellPhone: env("CORREO_ARGENTINO_SENDER_CELLPHONE") || null,
        email: env("CORREO_ARGENTINO_SENDER_EMAIL") || null,
        originAddress: {
          streetName: env("CORREO_ARGENTINO_SENDER_STREET") || null,
          streetNumber: env("CORREO_ARGENTINO_SENDER_STREET_NUMBER") || null,
          floor: env("CORREO_ARGENTINO_SENDER_FLOOR") || null,
          apartment: env("CORREO_ARGENTINO_SENDER_APARTMENT") || null,
          city: env("CORREO_ARGENTINO_SENDER_CITY") || null,
          provinceCode: env("CORREO_ARGENTINO_SENDER_PROVINCE_CODE") || null,
          postalCode:
            env("CORREO_ARGENTINO_SENDER_POSTAL_CODE") ||
            env("CORREO_ARGENTINO_ORIGIN_POSTAL_CODE") ||
            null,
        },
      },
      recipient: {
        name: input.recipient.name,
        phone: input.recipient.phone,
        cellPhone: input.recipient.phone,
        email: input.recipient.email,
      },
      shipping: {
        deliveryType: input.deliveryType,
        agency: input.deliveryType === "S" ? input.agencyCode ?? null : null,
        address:
          input.deliveryType === "D" && input.address
            ? {
                streetName: input.address.streetName,
                streetNumber: input.address.streetNumber,
                floor: input.address.floor ?? "",
                apartment: input.address.apartment ?? "",
                city: input.address.city,
                provinceCode: input.address.provinceCode,
                postalCode: input.address.postalCode,
              }
            : null,
        productType: input.productType ?? "CP",
        weight: input.package.weightGrams,
        declaredValue: input.declaredValue,
        height: input.package.heightCm,
        length: input.package.lengthCm,
        width: input.package.widthCm,
      },
    };

    const data = await api<{ createdAt?: string }>("/shipping/import", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      provider: "correo_argentino",
      service: input.productType ?? "CP",
      trackingNumber: null,
      trackingUrl: null,
      label: null,
      shippedAt: data.createdAt ?? new Date().toISOString(),
    };
  },

  async getTracking(shippingId: string): Promise<TrackingResult> {
    const query = new URLSearchParams({ shippingId });
    const data = await api<
      {
        id?: string | null;
        productId?: string | null;
        trackingNumber?: string | null;
        events?: {
          event?: string;
          date?: string;
          branch?: string | null;
          status?: string;
          sign?: string;
        }[];
      }[]
    >(`/shipping/tracking?${query.toString()}`, { method: "GET" });

    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first || !Array.isArray(first.events)) {
      return { trackingNumber: null, events: [] };
    }

    return {
      trackingNumber: first.trackingNumber ?? shippingId,
      events: first.events.map((e) => ({
        event: e.event ?? "",
        date: e.date ?? "",
        branch: e.branch ?? null,
        status: e.status ?? "",
        sign: e.sign ?? "",
      })),
    };
  },

  async getAgencies(provinceCode: string): Promise<ShippingAgency[]> {
    const customerId = env("CORREO_ARGENTINO_CUSTOMER_ID");
    const query = new URLSearchParams({ customerId, provinceCode });
    const data = await api<
      {
        code?: string;
        name?: string;
        phone?: string;
        location?: {
          address?: {
            streetName?: string;
            streetNumber?: string;
            locality?: string;
            city?: string;
            postalCode?: string;
          } | null;
        };
      }[]
    >(`/agencies?${query.toString()}`, { method: "GET" });

    if (!Array.isArray(data)) return [];
    return data.map((a) => ({
      code: a.code ?? "",
      name: a.name ?? "",
      address:
        a.location?.address?.streetName || a.location?.address?.streetNumber
          ? `${a.location?.address?.streetName ?? ""} ${a.location?.address?.streetNumber ?? ""}`.trim()
          : null,
      locality: a.location?.address?.locality ?? null,
      city: a.location?.address?.city ?? null,
      postalCode: a.location?.address?.postalCode ?? null,
      phone: a.phone ?? null,
    }));
  },
};
