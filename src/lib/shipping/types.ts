import type { DeliveryType } from "@/lib/types";

export type ShippingProviderId = "correo_argentino";

export interface PackageDimensions {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface QuoteRequest {
  postalCodeDestination: string;
  provinceCode: string;
  deliveryType?: DeliveryType;
  package: PackageDimensions;
}

export interface QuoteOption {
  provider: ShippingProviderId;
  deliveryType: DeliveryType;
  productType: string;
  productName: string;
  price: number;
  deliveryTimeMin: string | null;
  deliveryTimeMax: string | null;
  validTo: string | null;
}

export interface ShippingRecipient {
  name: string;
  phone: string;
  email: string;
}

export interface ShippingAddress {
  streetName: string;
  streetNumber: string;
  floor?: string;
  apartment?: string;
  city: string;
  provinceCode: string;
  postalCode: string;
}

export interface CreateShipmentInput {
  extOrderId: string;
  orderNumber: string;
  recipient: ShippingRecipient;
  deliveryType: DeliveryType;
  agencyCode?: string;
  address?: ShippingAddress;
  package: PackageDimensions;
  declaredValue: number;
  productType?: string;
}

export interface ShipmentResult {
  provider: ShippingProviderId;
  service: string;
  trackingNumber: string | null;
  trackingUrl: string | null;
  label: string | null;
  shippedAt: string;
}

export interface TrackingEvent {
  event: string;
  date: string;
  branch: string | null;
  status: string;
  sign: string;
}

export interface TrackingResult {
  trackingNumber: string | null;
  events: TrackingEvent[];
}

export interface ShippingAgency {
  code: string;
  name: string;
  address: string | null;
  locality: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
}

export interface ShippingProvider {
  readonly id: ShippingProviderId;
  quote(input: QuoteRequest): Promise<QuoteOption[]>;
  createShipment(input: CreateShipmentInput): Promise<ShipmentResult>;
  getTracking(shippingId: string): Promise<TrackingResult>;
  getAgencies?(provinceCode: string): Promise<ShippingAgency[]>;
  cancelShipment?(trackingNumber: string): Promise<void>;
}
