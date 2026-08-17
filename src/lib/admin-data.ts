import { getDb } from "./db";
import type {
  Customer,
  DeliveryType,
  Expense,
  ExpenseCategory,
  Order,
  OrderStatus,
  SupplierPurchase,
  TrackingEvent,
} from "./types";

export const LOW_STOCK_THRESHOLD = 10;

interface OrderRow {
  id: number;
  code: string;
  customer_id: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string;
  province: string;
  postal_code: string;
  locality: string;
  address_street: string;
  address_number: string;
  address_floor: string;
  address_apartment: string;
  delivery_type: string;
  agency_code: string;
  shipping_provider: string;
  shipping_service: string;
  tracking_number: string;
  tracking_url: string;
  tracking_events: string;
  shipped_at: string | null;
  created_at: string;
}

interface OrderItemRow {
  id: number;
  order_id: number;
  perfume_id: number | null;
  name: string;
  size: number | null;
  price: number;
  qty: number;
}

const ORDER_SELECT = `
  SELECT o.*,
         COALESCE(c.name, 'Cliente invitado') AS customer_name,
         c.email AS customer_email,
         c.phone AS customer_phone
  FROM orders o
  LEFT JOIN customers c ON c.id = o.customer_id
`;

function parseTrackingEvents(json: string): TrackingEvent[] {
  try {
    const parsed = JSON.parse(json) as TrackingEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapOrder(row: OrderRow, items: OrderItemRow[]): Order {
  return {
    id: row.id,
    code: row.code,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status as OrderStatus,
    subtotal: row.subtotal,
    shipping: row.shipping,
    total: row.total,
    paymentMethod: row.payment_method,
    province: row.province,
    postalCode: row.postal_code,
    locality: row.locality,
    addressStreet: row.address_street,
    addressNumber: row.address_number,
    addressFloor: row.address_floor,
    addressApartment: row.address_apartment,
    deliveryType: (row.delivery_type === "S" ? "S" : "D") as DeliveryType,
    agencyCode: row.agency_code,
    shippingProvider: row.shipping_provider,
    shippingService: row.shipping_service,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    trackingEvents: parseTrackingEvents(row.tracking_events),
    shippedAt: row.shipped_at,
    createdAt: row.created_at,
    items: items.map((i) => ({
      id: i.id,
      orderId: i.order_id,
      perfumeId: i.perfume_id,
      name: i.name,
      size: i.size,
      price: i.price,
      qty: i.qty,
    })),
  };
}

export function getOrders(status: OrderStatus | null, q: string | null): Order[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }
  if (q) {
    where.push(
      "(o.code LIKE ? OR c.name LIKE ? OR o.province LIKE ?)"
    );
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const sql = `${ORDER_SELECT} ${
    where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""
  } ORDER BY o.created_at DESC LIMIT 200`;
  const rows = getDb()
    .prepare(sql)
    .all(...params) as unknown as OrderRow[];
  const items = getDb()
    .prepare("SELECT * FROM order_items ORDER BY id")
    .all() as unknown as OrderItemRow[];

  return rows.map((row) => mapOrder(row, items.filter((i) => i.order_id === row.id)));
}

export function getOrderById(id: number): Order | null {
  const row = getDb()
    .prepare(`${ORDER_SELECT} WHERE o.id = ?`)
    .get(id) as OrderRow | undefined;
  if (!row) return null;
  const items = getDb()
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(id) as unknown as OrderItemRow[];
  return mapOrder(row, items);
}

export function getOrderByCode(code: string): Order | null {
  const row = getDb()
    .prepare(`${ORDER_SELECT} WHERE o.code = ?`)
    .get(code) as OrderRow | undefined;
  if (!row) return null;
  const items = getDb()
    .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
    .all(row.id) as unknown as OrderItemRow[];
  return mapOrder(row, items);
}

export function getCustomers(): Customer[] {
  const rows = getDb()
    .prepare(
      `SELECT c.*,
              COUNT(o.id) AS orders_count,
              COALESCE(SUM(CASE WHEN o.status != 'cancelado' THEN o.total END), 0) AS total_spent,
              MAX(CASE WHEN o.status != 'cancelado' THEN o.created_at END) AS last_order_at
       FROM customers c
       LEFT JOIN orders o ON o.customer_id = c.id
       GROUP BY c.id
       ORDER BY total_spent DESC`
    )
    .all() as unknown as (Customer & {
    created_at: string;
    orders_count: number;
    total_spent: number;
    last_order_at: string | null;
  })[];

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    province: row.province,
    createdAt: row.created_at,
    totalSpent: row.total_spent,
    ordersCount: row.orders_count,
    lastOrderAt: row.last_order_at,
    lastOrderCode: null,
  }));
}

export function getDashboardStats() {
  const db = getDb();

  const scalar = (sql: string) => {
    const row = db.prepare(sql).get() as { value: number };
    return row.value;
  };

  const todaySales = scalar(
    `SELECT COALESCE(SUM(total), 0) AS value FROM orders
     WHERE status != 'cancelado' AND date(created_at) = date('now')`
  );
  const todayOrders = scalar(
    `SELECT COUNT(*) AS value FROM orders
     WHERE status != 'cancelado' AND date(created_at) = date('now')`
  );

  const monthRevenue = scalar(
    `SELECT COALESCE(SUM(total), 0) AS value FROM orders
     WHERE status != 'cancelado' AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now')`
  );
  const monthOrders = scalar(
    `SELECT COUNT(*) AS value FROM orders
     WHERE status != 'cancelado' AND substr(created_at, 1, 7) = strftime('%Y-%m', 'now')`
  );

  const monthCost = scalar(
    `SELECT COALESCE(SUM(CASE WHEN p.cost IS NOT NULL THEN p.cost * oi.qty ELSE oi.price * oi.qty * 0.5 END), 0) AS value
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     LEFT JOIN perfumes p ON p.id = oi.perfume_id
     WHERE o.status != 'cancelado' AND substr(o.created_at, 1, 7) = strftime('%Y-%m', 'now')`
  );
  const monthExpenses = scalar(
    `SELECT COALESCE(SUM(amount), 0) AS value FROM expenses
     WHERE substr(date, 1, 7) = strftime('%Y-%m', 'now')`
  );
  const monthProfit = monthRevenue - monthCost - monthExpenses;

  const pendingOrders = scalar(
    `SELECT COUNT(*) AS value FROM orders WHERE status = 'pendiente'`
  );
  const lowStock = scalar(
    `SELECT COUNT(*) AS value FROM perfumes WHERE stock <= ${LOW_STOCK_THRESHOLD}`
  );
  const outOfStock = scalar(`SELECT COUNT(*) AS value FROM perfumes WHERE stock <= 0`);

  const topProductRow = db
    .prepare(
      `SELECT name, SUM(qty) AS qty FROM order_items GROUP BY name ORDER BY qty DESC LIMIT 1`
    )
    .get() as { name: string; qty: number } | undefined;

  const newCustomersMonth = scalar(
    `SELECT COUNT(*) AS value FROM customers
     WHERE substr(created_at, 1, 7) = strftime('%Y-%m', 'now')`
  );

  const averageTicket = scalar(
    `SELECT ROUND(COALESCE(AVG(total), 0), 0) AS value FROM orders WHERE status != 'cancelado'`
  );

  return {
    todaySales,
    todayOrders,
    monthRevenue,
    monthOrders,
    monthCost,
    monthExpenses,
    monthProfit,
    pendingOrders,
    lowStock,
    outOfStock,
    topProduct: topProductRow ?? null,
    newCustomersMonth,
    averageTicket,
  };
}

export interface PurchaseWithItems {
  purchase: SupplierPurchase;
  items: { id: number; perfumeId: number; perfumeName: string; qty: number; size: number; unitCost: number; line: number }[];
}

export function getPurchases(): PurchaseWithItems[] {
  const purchases = getDb()
    .prepare("SELECT * FROM supplier_purchases ORDER BY date DESC")
    .all() as unknown as (SupplierPurchase & { date: string; total_cost: number; note: string })[];

  const items = getDb()
    .prepare(
      `SELECT pi.id, pi.purchase_id, pi.perfume_id, pi.qty, pi.unit_cost, pi.size, p.name AS perfume_name
       FROM supplier_purchase_items pi
       JOIN perfumes p ON p.id = pi.perfume_id
       ORDER BY pi.purchase_id, pi.id`
    )
    .all() as unknown as {
    id: number;
    purchase_id: number;
    perfume_id: number;
    qty: number;
    unit_cost: number;
    size: number;
    perfume_name: string;
  }[];

  return purchases.map((p) => ({
    purchase: {
      id: p.id,
      supplier: p.supplier,
      totalCost: p.total_cost,
      date: p.date,
      note: p.note,
    },
    items: items
      .filter((i) => i.purchase_id === p.id)
      .map((i) => ({
        id: i.id,
        perfumeId: i.perfume_id,
        perfumeName: i.perfume_name,
        qty: i.qty,
        size: i.size,
        unitCost: i.unit_cost,
        line: i.unit_cost * i.qty,
      })),
  }));
}

export function getExpenses(): Expense[] {
  const rows = getDb()
    .prepare("SELECT * FROM expenses ORDER BY date DESC")
    .all() as unknown as (Expense & { date: string; amount: number })[];
  return rows.map((row) => ({
    id: row.id,
    category: row.category as ExpenseCategory,
    description: row.description,
    amount: row.amount,
    date: row.date,
  }));
}

export function getExpensesTotal(): number {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(amount), 0) AS value FROM expenses")
    .get() as { value: number };
  return row.value;
}

export function getLowStockItems() {
  return getDb()
    .prepare(
      `SELECT p.id, p.slug, p.name, p.stock, b.name AS brand_name, p.price_50
       FROM perfumes p JOIN brands b ON b.id = p.brand_id
       WHERE p.stock <= ?
       ORDER BY p.stock ASC`
    )
    .all(LOW_STOCK_THRESHOLD) as unknown as {
    id: number;
    slug: string;
    name: string;
    stock: number;
    brand_name: string;
    price_50: number | null;
  }[];
}

export function getTopSellers(limit = 5) {
  return getDb()
    .prepare(
      `SELECT oi.name, SUM(oi.qty) AS units, SUM(oi.price * oi.qty) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelado'
       GROUP BY oi.name
       ORDER BY units DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { name: string; units: number; revenue: number }[];
}

export function getTopBrands(limit = 5) {
  return getDb()
    .prepare(
      `SELECT b.name, COUNT(oi.id) AS items, SUM(oi.price * oi.qty) AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN perfumes p ON p.id = oi.perfume_id
       JOIN brands b ON b.id = p.brand_id
       WHERE o.status != 'cancelado'
       GROUP BY b.id
       ORDER BY revenue DESC
       LIMIT ?`
    )
    .all(limit) as unknown as { name: string; items: number; revenue: number }[];
}

export function getSalesByProvince() {
  return getDb()
    .prepare(
      `SELECT province, COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue
       FROM orders
       WHERE status != 'cancelado'
       GROUP BY province
       ORDER BY revenue DESC`
    )
    .all() as unknown as { province: string; orders: number; revenue: number }[];
}

export function getMonthlyRevenue(months = 6) {
  const rows = getDb()
    .prepare(
      `SELECT substr(created_at, 1, 7) AS month, COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
       FROM orders
       WHERE status != 'cancelado'
       GROUP BY month
       ORDER BY month ASC
       LIMIT ?`
    )
    .all(months) as unknown as { month: string; revenue: number; orders: number }[];

  const now = new Date();
  const labels: { month: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const found = rows.find((r) => r.month === key);
    labels.push({
      month: key,
      label: d.toLocaleDateString("es-AR", { month: "short" }),
      revenue: found?.revenue ?? 0,
      orders: found?.orders ?? 0,
    });
  }
  return labels;
}

export interface AdminProduct {
  id: number;
  slug: string;
  name: string;
  brandId: number;
  brandName: string;
  gender: string;
  aromas: string[];
  seasons: string[];
  occasions: string[];
  price30: number | null;
  price50: number | null;
  price100: number | null;
  cost: number | null;
  stock: number;
  stock30: number;
  stock50: number;
  stock100: number;
  packageWeight: number;
  packageLength: number;
  packageWidth: number;
  packageHeight: number;
  description: string;
  notesTop: string;
  notesHeart: string;
  notesBase: string;
  duration: number;
  projection: number;
  sweetness: number;
  inspiredBy: string | null;
  image: string;
  isNew: boolean;
  bestSeller: boolean;
  rating: number;
  reviewCount: number;
}

const ADMIN_PRODUCT_SELECT = `
  SELECT p.*, b.name AS brand_name
  FROM perfumes p
  JOIN brands b ON b.id = p.brand_id
`;

function parseTags(value: unknown): string[] {
  if (value == null) return [];
  const s = String(value).trim();
  if (!s) return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return [s];
}

function mapAdminProduct(row: Record<string, unknown>): AdminProduct {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    brandId: Number(row.brand_id),
    brandName: String(row.brand_name),
    gender: String(row.gender),
    aromas: parseTags(row.aroma),
    seasons: parseTags(row.season),
    occasions: parseTags(row.occasion),
    price30: row.price_30 == null ? null : Number(row.price_30),
    price50: row.price_50 == null ? null : Number(row.price_50),
    price100: row.price_100 == null ? null : Number(row.price_100),
    cost: row.cost == null ? null : Number(row.cost),
    stock: Number(row.stock),
    stock30: Number(row.stock_30 ?? 0),
    stock50: Number(row.stock_50 ?? 0),
    stock100: Number(row.stock_100 ?? 0),
    packageWeight: Number(row.package_weight ?? 0),
    packageLength: Number(row.package_length ?? 0),
    packageWidth: Number(row.package_width ?? 0),
    packageHeight: Number(row.package_height ?? 0),
    description: String(row.description),
    notesTop: String(row.notes_top),
    notesHeart: String(row.notes_heart),
    notesBase: String(row.notes_base),
    duration: Number(row.duration),
    projection: Number(row.projection),
    sweetness: Number(row.sweetness),
    inspiredBy: row.inspired_by == null ? null : String(row.inspired_by),
    image: String(row.image),
    isNew: Number(row.is_new) === 1,
    bestSeller: Number(row.best_seller) === 1,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
  };
}

export function getAdminProducts(): AdminProduct[] {
  const rows = getDb()
    .prepare(`${ADMIN_PRODUCT_SELECT} ORDER BY p.name ASC`)
    .all() as unknown as Record<string, unknown>[];
  return rows.map(mapAdminProduct);
}

export function getAdminProductById(id: number): AdminProduct | null {
  const row = getDb()
    .prepare(`${ADMIN_PRODUCT_SELECT} WHERE p.id = ?`)
    .get(id) as Record<string, unknown> | undefined;
  return row ? mapAdminProduct(row) : null;
}

export function getRepeatCustomers() {
  const row = getDb()
    .prepare(
      `SELECT
         COUNT(*) AS total_customers,
         SUM(CASE WHEN order_counts.cnt >= 2 THEN 1 ELSE 0 END) AS repeat_customers
       FROM (
         SELECT c.id, COUNT(o.id) AS cnt
         FROM customers c
         LEFT JOIN orders o ON o.customer_id = c.id AND o.status != 'cancelado'
         GROUP BY c.id
       ) AS order_counts`
    )
    .get() as { total_customers: number; repeat_customers: number };
  return {
    totalCustomers: row.total_customers,
    repeatCustomers: row.repeat_customers,
  };
}
