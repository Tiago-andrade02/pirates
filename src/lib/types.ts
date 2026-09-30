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

export interface Stocks {
  "30": number;
  "50": number;
  "100": number;
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
  stockBySize: Stocks;
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
  | "cancelado"
  | "sin_stock";

export const ORDER_STATUSES: OrderStatus[] = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "cancelado",
  "sin_stock",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: "Pendiente",
  pagado: "Pagado",
  preparando: "Preparando",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
  sin_stock: "Sin stock",
};

// Estados en los que el stock ya fue descontado al finalizar la orden.
export const ORDER_STATUSES_WITH_STOCK_TAKEN: OrderStatus[] = [
  "pagado",
  "preparando",
  "enviado",
  "entregado",
];

// Estados en los que el pago YA fue finalizado: el stock se descontó (o el
// pedido quedó marcado sin_stock) y no corresponde volver a procesarlo. Sirve
// para que un webhook o confirmación tardía no reintente descontar stock ni
// haga retroceder un pedido que ya avanzó a preparando/enviado/entregado.
export const FINALIZED_ORDER_STATUSES: OrderStatus[] = [
  ...ORDER_STATUSES_WITH_STOCK_TAKEN,
  "sin_stock",
];

export function isOrderFinalized(status: OrderStatus): boolean {
  return FINALIZED_ORDER_STATUSES.includes(status);
}

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

// El retiro en persona está desactivado: la única modalidad nueva es "D".
// "S" se conserva para los pedidos históricos y se etiqueta sin nombrar ninguna
// sucursal ni código interno de agencia.
export const DELIVERY_TYPE_LABELS: Record<DeliveryType, string> = {
  D: "Envío a domicilio",
  S: "Retirada en persona",
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
