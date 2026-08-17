export type Gender = "hombre" | "mujer" | "unisex";
export type Aroma =
  | "dulce"
  | "fresco"
  | "citrico"
  | "amaderado"
  | "ambar"
  | "vainilla"
  | "floral";
export type Season = "verano" | "invierno" | "primavera" | "otono" | "todo-el-ano";
export type Occasion = "oficina" | "noche" | "citas" | "diario" | "fiesta";

export interface Brand {
  id: number;
  slug: string;
  name: string;
  country: string;
  description: string;
}

export interface Prices {
  "30": number | null;
  "50": number | null;
  "100": number | null;
}

export interface Perfume {
  id: number;
  slug: string;
  name: string;
  brand: Brand;
  gender: Gender;
  aromas: Aroma[];
  seasons: Season[];
  occasions: Occasion[];
  prices: Prices;
  stock: number;
  description: string;
  notes: {
    top: string[];
    heart: string[];
    base: string[];
  };
  duration: number;
  projection: number;
  sweetness: number;
  inspiredBy: string | null;
  image: string;
  isNew: boolean;
  bestSeller: boolean;
  topRank: number | null;
  rating: number;
  reviewCount: number;
  package: {
    weightGrams: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
}

export type OrderStatus =
  | "pendiente"
  | "pagado"
  | "preparando"
  | "enviado"
  | "entregado"
  | "cancelado";

export const ORDER_STATUSES: OrderStatus[] = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "cancelado",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  province: string;
  createdAt: string;
  totalSpent: number;
  ordersCount: number;
  lastOrderAt: string | null;
  lastOrderCode: string | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  perfumeId: number | null;
  name: string;
  size: number | null;
  price: number;
  qty: number;
}

export interface Order {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  province: string;
  createdAt: string;
  items: OrderItem[];
  postalCode: string;
  locality: string;
  addressStreet: string;
  addressNumber: string;
  addressFloor: string;
  addressApartment: string;
  deliveryType: DeliveryType;
  agencyCode: string;
  shippingProvider: string;
  shippingService: string;
  trackingNumber: string;
  trackingUrl: string;
  trackingEvents: TrackingEvent[];
  shippedAt: string | null;
}

export interface TrackingEvent {
  event: string;
  date: string;
  branch: string | null;
  status: string;
  sign: string;
}

export type DeliveryType = "D" | "S";

export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  D: "A domicilio",
  S: "Retiro en sucursal",
};

export interface SupplierPurchase {
  id: number;
  supplier: string;
  totalCost: number;
  date: string;
  note: string;
}

export interface Expense {
  id: number;
  category: ExpenseCategory;
  description: string;
  amount: number;
  date: string;
}

export type ExpenseCategory = "publicidad" | "packaging" | "envios" | "otros";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "publicidad", label: "Publicidad" },
  { value: "packaging", label: "Packaging" },
  { value: "envios", label: "Envíos" },
  { value: "otros", label: "Otros" },
];

export const PROVINCES = [
  "Buenos Aires",
  "CABA",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export interface CatalogFilters {
  brands: string[];
  size: string | null;
  priceRange: string | null;
  gender: string | null;
  aroma: string | null;
  season: string | null;
  occasion: string | null;
  onlyNew: boolean;
  onlyBestSellers: boolean;
  q: string | null;
  order: string | null;
}
