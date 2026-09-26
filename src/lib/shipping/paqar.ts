import type {
  CreateShipmentInput,
  QuoteOption,
  QuoteRequest,
  ShipmentResult,
  ShippingAgency,
  ShippingProvider,
  TrackingEvent,
  TrackingResult,
} from "./types";
import { flatRateProvider } from "./flat-rate";

// PAQ.AR API 2.0 (Correo Argentino).
// Referencia: manual oficial "Plataforma de Integración - API 2.0"
// (https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiPaqAr-v2.pdf).
//
// Autenticación por headers (no hay JWT):
//   Authorization: Apikey <API-KEY>
//   Agreement: <idAcuerdo>   (el id comercial como string)
//
// IMPORTANTE: la API 2.0 NO expone cotizador (/rates). Por eso quote() delega
// siempre en la tarifa fija de PIRATES (fallback), tal como se definió para
// que el checkout siga funcionando mientras no exista una cotización real.

export const PAQAR_PROD_BASE_URL = "https://api.correoargentino.com.ar/paqar/v1";
export const PAQAR_TEST_BASE_URL = "https://apitest.correoargentino.com.ar/paqar/v1";

// Entorno: PAQAR_ENV=test => ambiente de test (apitest). Cualquier otro valor
// (o vacío) cae en producción. PAQAR_ENV=test es el valor por defecto que se
// documenta en .env.local para desarrollo.
function env(name: string): string {
  return process.env[name] ?? "";
}

function isTestEnvironment(): boolean {
  const specific = env("PAQAR_ENV").toLowerCase();
  if (specific === "production") return false;
  if (specific === "test") return true;
  // Sin PAQAR_ENV explícito: en producción se apunta al entorno real y en
  // desarrollo/test al sandbox, para no golpear la API real por accidente.
  return process.env.NODE_ENV !== "production";
}

function baseUrl(): string {
  if (env("PAQAR_API_URL")) return env("PAQAR_API_URL");
  return isTestEnvironment() ? PAQAR_TEST_BASE_URL : PAQAR_PROD_BASE_URL;
}

export function hasPaqArCredentials(): boolean {
  return Boolean(env("PAQAR_API_KEY") && env("PAQAR_AGREEMENT"));
}

function apiKey(): string {
  const key = env("PAQAR_API_KEY");
  if (!key) {
    throw new Error(
      "PAQ.AR no configurado: cargá PAQAR_API_KEY y PAQAR_AGREEMENT en .env.local."
    );
  }
  return key;
}

function agreement(): string {
  const id = env("PAQAR_AGREEMENT");
  if (!id) {
    throw new Error(
      "PAQ.AR no configurado: cargá PAQAR_AGREEMENT en .env.local."
    );
  }
  return id;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Apikey ${apiKey()}`,
    Agreement: agreement(),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function api<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      ...headers(),
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
      (body as { error?: string })?.error ??
      `HTTP ${res.status}`;
    throw new Error(`PAQ.AR ${path.replace(/\?\S*$/, "")} ${res.status}: ${message}`);
  }

  return body as T;
}

// Fecha del evento puede venir como "28-06-2022 11:53" o ISO 8601. Se normaliza
// a ISO para que el render (new Date(...)) de admin/tienda funcione siempre.
function normalizeDate(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const legacy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/);
  if (legacy) {
    return `${legacy[3]}-${legacy[2]}-${legacy[1]}T${legacy[4]}:${legacy[5]}:00`;
  }
  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? trimmed : iso.toISOString();
}

function mapTrackingEvent(raw: {
  status?: string | null;
  statusId?: string | null;
  date?: string | null;
  facility?: string | null;
  facilityCode?: string | null;
  sign?: string | null;
}): TrackingEvent {
  return {
    event: raw.status || raw.statusId || "",
    date: normalizeDate(raw.date),
    branch: raw.facility || raw.facilityCode || null,
    status: raw.statusId || "",
    sign: raw.sign ?? "",
  };
}

function fallbackQuoteOptions(input: QuoteRequest): Promise<QuoteOption[]> {
  // La API 2.0 no tiene cotizador: se mantiene la tarifa fija de PIRATES como
  // fallback. Se devuelve productType "CP" (serviceType usado luego en el alta)
  // para que el pedido quede consistente con /v1/orders.
  return flatRateProvider.quote(input).then((options) =>
    options.map((o) => ({
      ...o,
      provider: "paq_ar" as const,
      productType: "CP",
      productName: "PAQ.AR · Envío a convenir",
    }))
  );
}

// Remitente: se usa PAQAR_SENDER_* si están configurados y se reutilizan los
// CORREO_ARGENTINO_SENDER_* como datos de origen de la tienda si no.
function senderAddressField(key: string): string {
  return env(`PAQAR_SENDER_${key}`) || env(`CORREO_ARGENTINO_SENDER_${key}`) || "";
}

function senderAddress() {
  return {
    streetName: senderAddressField("STREET"),
    streetNumber: senderAddressField("STREET_NUMBER"),
    floor: senderAddressField("FLOOR"),
    department: senderAddressField("APARTMENT"),
    cityName: senderAddressField("CITY"),
    state: senderAddressField("PROVINCE_CODE"),
    zipCode: senderAddressField("POSTAL_CODE"),
  };
}

// Fecha de venta en el formato que espera /v1/orders (offset -03:00, hora de
// Buenos Aires). Se genera con el desfase real de la máquina para no asumir
// la zona horaria del servidor.
function saleDate(): string {
  const date = new Date();
  const tzOffset = -date.getTimezoneOffset() / 60;
  const offsetSign = tzOffset >= 0 ? "+" : "-";
  const offsetHours = String(Math.abs(tzOffset)).padStart(2, "0");
  const iso = date
    .toISOString()
    .replace(/\.\d{3}Z$/, `${offsetSign}${offsetHours}:00`);
  return iso;
}

export const paqArProvider: ShippingProvider = {
  id: "paq_ar",

  // Sin cotizador real: fallback a tarifa fija (PIRATES).
  async quote(input: QuoteRequest): Promise<QuoteOption[]> {
    return fallbackQuoteOptions(input);
  },

  async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    // Asegura que haya API-Key + agreement antes de armar el payload (el error
    // se propaga como error controlado al panel, nunca como 500 del checkout).
    apiKey();
    agreement();

    // Solo la primera parcela se procesa (documentado): se agrega todo el
    // pedido en una sola pieza con el peso y dimensiones máximas.
    const address = senderAddress();
    const businessName =
      env("PAQAR_SENDER_NAME") || env("CORREO_ARGENTINO_SENDER_NAME") || "";
    const requiredSender = {
      businessName,
      streetName: address.streetName,
      streetNumber: address.streetNumber,
      cityName: address.cityName,
      state: address.state,
      zipCode: address.zipCode,
    };
    const missingFields = Object.entries(requiredSender)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missingFields.includes("businessName")) {
      missingFields.push("(PAQAR_SENDER_NAME / CORREO_ARGENTINO_SENDER_NAME)");
    }
    if (missingFields.length > 0) {
      throw new Error(
        `PAQ.AR: faltan datos del remitente: ${missingFields.join(
          ", "
        )}. Configurá PAQAR_SENDER_* (o los CORREO_ARGENTINO_SENDER_*).`
      );
    }
    const deliveryType = input.deliveryType === "S" ? "agency" : "homeDelivery";
    const serviceType =
      input.productType && /^[A-Za-z0-9]{2}$/.test(input.productType)
        ? input.productType
        : "CP";

    const body = {
      order: {
        senderData: {
          businessName,
          areaCodePhone: "",
          phoneNumber: env("PAQAR_SENDER_PHONE") || env("CORREO_ARGENTINO_SENDER_PHONE") || "",
          areaCodeCellphone: "",
          cellphoneNumber:
            env("PAQAR_SENDER_CELLPHONE") || env("CORREO_ARGENTINO_SENDER_CELLPHONE") || "",
          email: env("PAQAR_SENDER_EMAIL") || env("CORREO_ARGENTINO_SENDER_EMAIL") || "",
          observation: "",
          address,
        },
        shippingData: {
          name: input.recipient.name,
          areaCodePhone: "",
          phoneNumber: input.recipient.phone,
          areaCodeCellphone: "",
          cellphoneNumber: "",
          email: input.recipient.email,
          observation: "",
          address:
            deliveryType === "agency"
              ? {
                  streetName: "",
                  streetNumber: "",
                  floor: "",
                  department: "",
                  cityName: "",
                  state: "",
                  zipCode: "",
                }
              : {
                  streetName: input.address?.streetName ?? "",
                  streetNumber: input.address?.streetNumber ?? "",
                  floor: input.address?.floor ?? "",
                  department: input.address?.apartment ?? "",
                  cityName: input.address?.city ?? "",
                  state: input.address?.provinceCode ?? "",
                  zipCode: input.address?.postalCode ?? "",
                },
        },
        parcels: [
          {
            dimensions: {
              height: String(Math.min(999, Math.round(input.package.heightCm))),
              width: String(Math.min(999, Math.round(input.package.widthCm))),
              depth: String(Math.min(999, Math.round(input.package.lengthCm))),
            },
            productWeight: String(
              Math.min(99999, Math.round(input.package.weightGrams))
            ),
            productCategory: "Perfumería",
            declaredValue: String(Math.round(input.declaredValue)),
          },
        ],
        deliveryType,
        agencyId: deliveryType === "agency" ? input.agencyCode ?? "" : "",
        saleDate: saleDate(),
        serviceType,
        shipmentClientId: "",
      },
    };

    const data = await api<{ trackingNumber?: string }>("/v1/orders", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!data.trackingNumber) {
      throw new Error(
        "PAQ.AR /v1/orders no devolvió un trackingNumber. Revisalo en el panel de MiCorreo."
      );
    }

    return {
      provider: "paq_ar",
      service: serviceType,
      trackingNumber: data.trackingNumber,
      trackingUrl: null,
      label: null,
      shippedAt: new Date().toISOString(),
    };
  },

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    if (!trackingNumber) return { trackingNumber: null, events: [] };

    // GET con la lista de tracking numbers (uno por vez) + extClient opcional.
    // La documentación muestra extClient como string de 3 dígitos que se
    // concatena al agreement y, si falta, se envía "000".
    const params = new URLSearchParams({ extClient: "000" });
    params.append("trackingNumber", trackingNumber);

    const data = await api<
      {
        trackingNumber?: string | null;
        event?: {
          status?: string | null;
          statusId?: string | null;
          date?: string | null;
          facility?: string | null;
          facilityCode?: string | null;
          sign?: string | null;
        }[] | null;
      }[]
    >(`/v1/tracking?${params.toString()}`, { method: "GET" });

    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first || !Array.isArray(first.event)) {
      return { trackingNumber: first?.trackingNumber ?? null, events: [] };
    }

    return {
      trackingNumber: first.trackingNumber ?? trackingNumber,
      events: first.event.map(mapTrackingEvent),
    };
  },

  async getAgencies(provinceCode: string): Promise<ShippingAgency[]> {
    // stateId usa los mismos códigos de provincia (una letra) que la API
    // MiCorreo (ej. B = Buenos Aires, C = CABA).
    const params = new URLSearchParams({ stateId: provinceCode });
    if (isTestEnvironment()) {
      params.set("pickup_availability", "true");
    }
    params.set("package_reception", "true");

    const data = await api<
      {
        agency_id?: string;
        agency_name?: string;
        phone?: string | null;
        email?: string | null;
        location?: {
          street_name?: string | null;
          street_number?: string | null;
          neighborhood_name?: string | null;
          city_name?: string | null;
          state_name?: string | null;
          zip_code?: string | null;
        } | null;
      }[]
    >(`/v1/agencies?${params.toString()}`, { method: "GET" });

    if (!Array.isArray(data)) return [];

    return data.map((a) => ({
      code: a.agency_id ?? "",
      name: a.agency_name ?? "",
      address:
        a.location?.street_name || a.location?.street_number
          ? `${a.location?.street_name ?? ""} ${a.location?.street_number ?? ""}`.trim()
          : null,
      locality: a.location?.neighborhood_name || a.location?.city_name || null,
      city: a.location?.city_name ?? null,
      postalCode: a.location?.zip_code ?? null,
      phone: a.phone ?? null,
    }));
  },

  async cancelShipment(trackingNumber: string): Promise<void> {
    if (!trackingNumber) {
      throw new Error("PAQ.AR: falta el trackingNumber para cancelar el envío.");
    }
    const tn = encodeURIComponent(trackingNumber);
    await api<unknown>(`/v1/orders/${tn}/cancel`, { method: "PATCH" });
  },

  async getLabel(trackingNumber: string): Promise<string | null> {
    if (!trackingNumber) return null;

    // POST /v1/labels (pasó a POST a partir de la versión 1.3 de la API).
    // Body: array de { sellerId?, trackingNumber }. Respuesta: array con
    // { trackingNumber, fileBase64, fileName, result }.
    const data = await api<
      {
        trackingNumber?: string | null;
        fileBase64?: string | null;
        fileName?: string | null;
        result?: string | null;
      }[]
    >("/v1/labels", {
      method: "POST",
      body: JSON.stringify([{ trackingNumber }]),
    });

    const label = Array.isArray(data) ? data[0] : undefined;
    if (!label) return null;
    if (label.result && !label.result.toUpperCase().startsWith("OK")) {
      throw new Error(`PAQ.AR /v1/labels: ${label.result}`);
    }
    return label.fileBase64 ?? null;
  },
};