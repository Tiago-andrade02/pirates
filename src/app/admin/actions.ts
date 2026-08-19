"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { getOrderById } from "@/lib/admin-data";
import { hasEmailConfig, sendOrderEmail } from "@/lib/notify";
import type { OrderStatus } from "@/lib/types";

const ADMIN_COOKIE = "pirates_admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "pirates2026";
const LOW_STOCK_THRESHOLD = 10;

export async function isAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === "1";
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password !== ADMIN_PASSWORD) {
    redirect("/admin?error=1");
  }
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
  redirect("/admin");
}

async function requireAdmin() {
  const admin = await isAdmin();
  if (!admin) {
    redirect("/admin");
  }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "perfume"
  );
}

function num(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim() === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function moneyNum(value: FormDataEntryValue | null): number | null {
  if (value === null || String(value).trim() === "") return null;
  const cleaned = String(value)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function sizePrice(formData: FormData, size: string): number | null {
  if (formData.get(`size_${size}`) !== "on") return null;
  return num(formData.get(`price_${size}`));
}

function parseSize(value: FormDataEntryValue | null): number {
  const n = Number(value);
  return n === 30 || n === 50 || n === 100 ? n : 100;
}

function int(value: FormDataEntryValue | null): number | null {
  const n = num(value);
  return n === null ? null : Math.round(n);
}

function tags(formData: FormData, name: string, fallback: string): string {
  const values = formData.getAll(name).map(String).filter(Boolean);
  return JSON.stringify(values.length > 0 ? values : [fallback]);
}

function notesList(value: FormDataEntryValue | null): string[] {
  if (!value) return [];
  return String(value)
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function imagePath(slug: string, variant: number): string {
  return path.join(
    process.cwd(),
    "public",
    "perfumes",
    `${slug}-${variant}.svg`
  );
}

function productSvg(name: string, brand: string, variant: number): string {
  const cx = 400;
  const bodyY = 430;
  const bodyW = 300;
  const bodyX = cx - bodyW / 2;
  const neckY = 340;
  const labelY = variant === 2 ? 570 : 545;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101010"/>
      <stop offset="1" stop-color="#030303"/>
    </linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1d1d1d"/>
      <stop offset="0.25" stop-color="#0a0a0a"/>
      <stop offset="0.7" stop-color="#000000"/>
      <stop offset="1" stop-color="#222222"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="800" height="1000" fill="url(#bg)"/>
  <ellipse cx="400" cy="520" rx="420" ry="480" fill="#ffffff" opacity="0.03"/>
  <ellipse cx="400" cy="840" rx="240" ry="30" fill="#000000" opacity="0.6"/>
  <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="350" rx="30" fill="url(#glass)" stroke="#3a3a3a" stroke-width="1.5"/>
  <path d="M ${bodyX + 34} ${bodyY} L ${cx - 34} ${neckY} L ${cx + 34} ${neckY} L ${bodyX + bodyW - 34} ${bodyY} Z" fill="url(#glass)" stroke="#3a3a3a" stroke-width="1.5"/>
  <rect x="${cx - 34}" y="${neckY - 14}" width="68" height="150" fill="#0a0a0a" stroke="#3a3a3a" stroke-width="1.5"/>
  <rect x="${cx - 44}" y="${neckY - 34}" width="88" height="22" rx="4" fill="#e8e8e8"/>
  <rect x="${cx - 40}" y="${neckY - 74}" width="80" height="48" rx="10" fill="#0f0f0f" stroke="#4a4a4a" stroke-width="1.5"/>
  <rect x="${cx - 40}" y="${neckY - 74}" width="80" height="10" rx="5" fill="#e8e8e8" opacity="0.9"/>
  <rect x="${bodyX + 14}" y="${bodyY + 10}" width="46" height="330" rx="20" fill="url(#shine)" opacity="0.35"/>
  <rect x="${bodyX + bodyW - 24}" y="${bodyY + 16}" width="8" height="318" rx="4" fill="#ffffff" opacity="0.18"/>
  <rect x="${bodyX + 40}" y="${labelY}" width="${bodyW - 80}" height="150" rx="6" fill="#0c0c0c" stroke="#2f2f2f" stroke-width="1.5"/>
  <text x="400" y="${labelY + 58}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" letter-spacing="6" fill="#8a8a8a">${brand.toUpperCase()}</text>
  <text x="400" y="${labelY + 108}" text-anchor="middle" font-family="Georgia, serif" font-size="26" letter-spacing="2" fill="#f2f2f2">${name.toUpperCase()}</text>
</svg>`;
}

function ensureProductImages(slug: string, name: string, brandName: string) {
  fs.mkdirSync(path.dirname(imagePath(slug, 1)), { recursive: true });
  for (const variant of [1, 2]) {
    const file = imagePath(slug, variant);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, productSvg(name, brandName, variant), "utf8");
    }
  }
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const db = await getDb();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin/productos?error=nombre");

  const brandId = int(formData.get("brand_id"));
  if (brandId === null) redirect("/admin/productos?error=marca");

  const slug = slugify(name);
  const image = slug;

  const brandResult = await db.execute({ sql: "SELECT name FROM brands WHERE id = ?", args: [brandId] });
  const brandRow = brandResult.rows[0] as unknown as { name: string } | undefined;
  const brandName = brandRow?.name ?? "PIRATES";

  const s30 = int(formData.get("stock_30")) ?? 0;
  const s50 = int(formData.get("stock_50")) ?? 0;
  const s100 = int(formData.get("stock_100")) ?? 0;
  const stockTotal = s30 + s50 + s100;

  const result = await db.execute({
    sql: `INSERT INTO perfumes (
        slug, name, brand_id, gender, aroma, season, occasion,
        price_30, price_50, price_100, cost,
        stock, stock_30, stock_50, stock_100, description,
        notes_top, notes_heart, notes_base, duration, projection, sweetness,
        inspired_by, image, is_new, best_seller, rating, review_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      slug,
      name,
      brandId,
      String(formData.get("gender") ?? "unisex"),
      tags(formData, "aroma", "dulce"),
      tags(formData, "season", "todo-el-ano"),
      tags(formData, "occasion", "diario"),
      sizePrice(formData, "30"),
      sizePrice(formData, "50"),
      sizePrice(formData, "100"),
      moneyNum(formData.get("cost")) ?? null,
      stockTotal,
      s30,
      s50,
      s100,
      String(formData.get("description") ?? "").trim(),
      JSON.stringify(notesList(formData.get("notes_top"))),
      JSON.stringify(notesList(formData.get("notes_heart"))),
      JSON.stringify(notesList(formData.get("notes_base"))),
      int(formData.get("duration")) ?? 3,
      int(formData.get("projection")) ?? 3,
      int(formData.get("sweetness")) ?? 3,
      String(formData.get("inspired_by") ?? "").trim() || null,
      image,
      formData.get("is_new") === "on" ? 1 : 0,
      formData.get("best_seller") === "on" ? 1 : 0,
      4.5,
      0,
    ],
  });

  ensureProductImages(slug, name, brandName);
  revalidatePath("/admin/productos");
  revalidatePath("/perfumes");
  redirect(`/admin/productos?ok=creado&id=${Number(result.lastInsertRowid)}`);
}

export async function updateProduct(formData: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/productos");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect(`/admin/productos?error=nombre`);

  const rowResult = await db.execute({ sql: "SELECT slug, brand_id FROM perfumes WHERE id = ?", args: [id] });
  const row = rowResult.rows[0] as unknown as { slug: string; brand_id: number } | undefined;
  if (!row) redirect("/admin/productos");

  const brandResult = await db.execute({
    sql: "SELECT name FROM brands WHERE id = ?",
    args: [Number(formData.get("brand_id") ?? row.brand_id)],
  });
  const brandRow = brandResult.rows[0] as unknown as { name: string } | undefined;

  const s30 = int(formData.get("stock_30")) ?? 0;
  const s50 = int(formData.get("stock_50")) ?? 0;
  const s100 = int(formData.get("stock_100")) ?? 0;
  const stockTotal = s30 + s50 + s100;

  await db.execute({
    sql: `UPDATE perfumes SET
       name = ?, brand_id = ?, gender = ?, aroma = ?, season = ?, occasion = ?,
       price_30 = ?, price_50 = ?, price_100 = ?, cost = ?,
       stock = ?, stock_30 = ?, stock_50 = ?, stock_100 = ?, description = ?,
       notes_top = ?, notes_heart = ?, notes_base = ?,
       duration = ?, projection = ?, sweetness = ?, inspired_by = ?,
       is_new = ?, best_seller = ?
     WHERE id = ?`,
    args: [
      name,
      int(formData.get("brand_id")) ?? row.brand_id,
      String(formData.get("gender") ?? "unisex"),
      tags(formData, "aroma", "dulce"),
      tags(formData, "season", "todo-el-ano"),
      tags(formData, "occasion", "diario"),
      sizePrice(formData, "30"),
      sizePrice(formData, "50"),
      sizePrice(formData, "100"),
      moneyNum(formData.get("cost")) ?? null,
      stockTotal,
      s30,
      s50,
      s100,
      String(formData.get("description") ?? "").trim(),
      JSON.stringify(notesList(formData.get("notes_top"))),
      JSON.stringify(notesList(formData.get("notes_heart"))),
      JSON.stringify(notesList(formData.get("notes_base"))),
      int(formData.get("duration")) ?? 3,
      int(formData.get("projection")) ?? 3,
      int(formData.get("sweetness")) ?? 3,
      String(formData.get("inspired_by") ?? "").trim() || null,
      formData.get("is_new") === "on" ? 1 : 0,
      formData.get("best_seller") === "on" ? 1 : 0,
      id,
    ],
  });

  ensureProductImages(row.slug, name, brandRow?.name ?? "PIRATES");
  revalidatePath("/admin/productos");
  revalidatePath("/perfumes");
  revalidatePath(`/perfumes/${row.slug}`);
  redirect(`/admin/productos?ok=editado&id=${id}`);
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const db = await getDb();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/productos");

  const rowResult = await db.execute({ sql: "SELECT slug FROM perfumes WHERE id = ?", args: [id] });
  const row = rowResult.rows[0] as unknown as { slug: string } | undefined;
  if (row) {
    await db.execute({ sql: "DELETE FROM perfumes WHERE id = ?", args: [id] });
    for (const variant of [1, 2]) {
      const file = imagePath(row.slug, variant);
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
    }
  }
  revalidatePath("/admin/productos");
  revalidatePath("/perfumes");
  redirect("/admin/productos?ok=eliminado");
}

export async function updateProductStock(formData: FormData) {
  await requireAdmin();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/stock");
  const s30 = int(formData.get("stock_30")) ?? 0;
  const s50 = int(formData.get("stock_50")) ?? 0;
  const s100 = int(formData.get("stock_100")) ?? 0;
  const stockTotal = s30 + s50 + s100;
  const db = await getDb();
  await db.execute({
    sql: "UPDATE perfumes SET stock = ?, stock_30 = ?, stock_50 = ?, stock_100 = ? WHERE id = ?",
    args: [stockTotal, s30, s50, s100, id],
  });
  revalidatePath("/admin/stock");
  revalidatePath("/admin/productos");
  redirect("/admin/stock?ok=1");
}

export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const id = int(formData.get("id"));
  const status = String(formData.get("status") ?? "") as OrderStatus;
  const valid = ["pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado"];
  if (id === null || !valid.includes(status)) redirect("/admin/pedidos");

  const db = await getDb();

  const previousResult = await db.execute({ sql: "SELECT status FROM orders WHERE id = ?", args: [id] });
  const previous = previousResult.rows[0] as unknown as { status: OrderStatus } | undefined;
  if (!previous) redirect("/admin/pedidos");

  await db.execute({ sql: "UPDATE orders SET status = ? WHERE id = ?", args: [status, id] });

  if (status === "cancelado" && previous.status !== "cancelado") {
    const itemsResult = await db.execute({ sql: "SELECT perfume_id, qty, size FROM order_items WHERE order_id = ?", args: [id] });
    const items = itemsResult.rows as unknown as { perfume_id: number | null; qty: number; size: number }[];
    for (const item of items) {
      if (item.perfume_id !== null) {
        const size = parseSize(String(item.size));
        await db.execute({
          sql: `UPDATE perfumes SET stock_${size} = stock_${size} + ?, stock = stock + ? WHERE id = ?`,
          args: [item.qty, item.qty, item.perfume_id],
        });
      }
    }
  }

  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  redirect(`/admin/pedidos?ok=estado&id=${id}`);
}

export async function resendOrderEmail(formData: FormData) {
  await requireAdmin();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/pedidos");

  const order = await getOrderById(id);
  if (!order) redirect("/admin/pedidos");
  if (!hasEmailConfig()) {
    redirect(`/admin/pedidos/${id}?error=email-no-configurado`);
  }

  try {
    await sendOrderEmail(order);
  } catch (error) {
    console.error("[notify] Error reenviando email del pedido", error);
    redirect(`/admin/pedidos/${id}?error=email-fallo`);
  }

  revalidatePath("/admin/pedidos");
  redirect(`/admin/pedidos/${id}?ok=email-enviado`);
}

export async function createPurchase(formData: FormData) {
  await requireAdmin();
  const db = await getDb();

  const supplier = String(formData.get("supplier") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString();
  const note = String(formData.get("note") ?? "").trim();

  const entries: { perfumeId: number; qty: number; unitCost: number; size: number }[] = [];
  const keys = [...formData.keys()];
  const rowIndexes = new Set<number>();
  for (const key of keys) {
    const match = key.match(/^perfume_id_(\d+)$/);
    if (match) rowIndexes.add(Number(match[1]));
  }

  for (const idx of [...rowIndexes].sort((a, b) => a - b)) {
    const perfumeId = int(formData.get(`perfume_id_${idx}`));
    const qty = int(formData.get(`qty_${idx}`));
    const unitCost = moneyNum(formData.get(`cost_${idx}`));
    if (perfumeId === null || qty === null || qty <= 0) continue;
    entries.push({
      perfumeId,
      qty,
      unitCost: unitCost ?? 0,
      size: parseSize(formData.get(`size_${idx}`)),
    });
  }

  if (!supplier || entries.length === 0) {
    redirect("/admin/mayorista?error=datos");
  }

  const totalCost = entries.reduce((acc, e) => acc + e.unitCost * e.qty, 0);

  await db.executeMultiple("BEGIN");
  try {
    const result = await db.execute({
      sql: "INSERT INTO supplier_purchases (supplier, total_cost, date, note) VALUES (?, ?, ?, ?)",
      args: [supplier, totalCost, date, note],
    });
    const purchaseId = Number(result.lastInsertRowid);

    for (const entry of entries) {
      await db.execute({
        sql: "INSERT INTO supplier_purchase_items (purchase_id, perfume_id, qty, unit_cost, size) VALUES (?, ?, ?, ?, ?)",
        args: [purchaseId, entry.perfumeId, entry.qty, entry.unitCost, entry.size],
      });
      const col = `stock_${entry.size}`;
      await db.execute({
        sql: `UPDATE perfumes SET ${col} = ${col} + ?, stock = stock + ? WHERE id = ?`,
        args: [entry.qty, entry.qty, entry.perfumeId],
      });
    }
    await db.executeMultiple("COMMIT");
  } catch (error) {
    await db.executeMultiple("ROLLBACK");
    throw error;
  }

  revalidatePath("/admin/mayorista");
  revalidatePath("/admin/stock");
  revalidatePath("/admin");
  redirect(`/admin/mayorista?ok=cargada`);
}

export async function deletePurchase(formData: FormData) {
  await requireAdmin();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/mayorista");
  const db = await getDb();
  const itemsResult = await db.execute({
    sql: "SELECT perfume_id, qty, size FROM supplier_purchase_items WHERE purchase_id = ?",
    args: [id],
  });
  const items = itemsResult.rows as unknown as { perfume_id: number; qty: number; size: number }[];
  await db.executeMultiple("BEGIN");
  try {
    for (const item of items) {
      const size = parseSize(String(item.size));
      await db.execute({
        sql: `UPDATE perfumes SET stock_${size} = MAX(0, stock_${size} - ?), stock = MAX(0, stock - ?) WHERE id = ?`,
        args: [item.qty, item.qty, item.perfume_id],
      });
    }
    await db.execute({ sql: "DELETE FROM supplier_purchase_items WHERE purchase_id = ?", args: [id] });
    await db.execute({ sql: "DELETE FROM supplier_purchases WHERE id = ?", args: [id] });
    await db.executeMultiple("COMMIT");
  } catch (error) {
    await db.executeMultiple("ROLLBACK");
    throw error;
  }
  revalidatePath("/admin/mayorista");
  revalidatePath("/admin/stock");
  redirect("/admin/mayorista?ok=borrada");
}

export async function createExpense(formData: FormData) {
  await requireAdmin();
  const db = await getDb();
  const category = String(formData.get("category") ?? "otros");
  const description = String(formData.get("description") ?? "").trim();
  const amount = moneyNum(formData.get("amount"));
  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString();
  if (amount === null || amount <= 0) {
    redirect("/admin/caja?error=monto");
  }
  await db.execute({
    sql: "INSERT INTO expenses (category, description, amount, date) VALUES (?, ?, ?, ?)",
    args: [category, description || "Sin descripción", amount, date],
  });
  revalidatePath("/admin/caja");
  redirect("/admin/caja?ok=gasto");
}

export async function deleteExpense(formData: FormData) {
  await requireAdmin();
  const id = int(formData.get("id"));
  if (id === null) redirect("/admin/caja");
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM expenses WHERE id = ?", args: [id] });
  revalidatePath("/admin/caja");
  redirect("/admin/caja?ok=borrado");
}

export async function restockLow() {
  await requireAdmin();
  const db = await getDb();
  const idsResult = await db.execute({
    sql: `SELECT id FROM perfumes WHERE stock <= ?`,
    args: [LOW_STOCK_THRESHOLD],
  });
  const ids = idsResult.rows as unknown as { id: number }[];
  for (const row of ids) {
    await db.execute({ sql: "UPDATE perfumes SET stock = ? WHERE id = ?", args: [LOW_STOCK_THRESHOLD + 10, row.id] });
  }
  revalidatePath("/admin/stock");
  revalidatePath("/admin/productos");
  redirect("/admin/stock?ok=restock");
}
