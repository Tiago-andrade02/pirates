import type {
  CreateShipmentInput,
  QuoteOption,
  QuoteRequest,
  ShipmentResult,
  ShippingAgency,
  ShippingProvider,
  TrackingResult,
} from "./types";

// Provider de respaldo: se usa mientras no haya credenciales de Correo
// Argentino, para que el checkout pueda probarse con un costo fijo de envío.
//
// NO ofrece retiro en persona: el checkout solo admite envío a domicilio
// (ver ./pickup.ts), así que acá tampoco se cotiza la modalidad "S".
const FALLBACK_RATE = Number(process.env.SHIPPING_FALLBACK_RATE ?? 6500);

function option(deliveryType: "D" | "S"): QuoteOption {
  return {
    provider: "flat_rate",
    deliveryType,
    productType: "FLAT",
    productName: "Envío a convenir",
    price: FALLBACK_RATE,
    deliveryTimeMin: null,
    deliveryTimeMax: null,
    validTo: null,
  };
}

export const flatRateProvider: ShippingProvider = {
  id: "flat_rate",

  async quote(input: QuoteRequest): Promise<QuoteOption[]> {
    if (input.deliveryType) {
      return input.deliveryType === "S" ? [] : [option("D")];
    }
    return [option("D")];
  },

  async createShipment(_input: CreateShipmentInput): Promise<ShipmentResult> {
    throw new Error(
      "Envío no configurado: cargá las credenciales de Correo Argentino en .env.local."
    );
  },

  async getTracking(trackingNumber: string): Promise<TrackingResult> {
    return { trackingNumber, events: [] };
  },

  async getAgencies(_provinceCode: string): Promise<ShippingAgency[]> {
    return [];
  },
};