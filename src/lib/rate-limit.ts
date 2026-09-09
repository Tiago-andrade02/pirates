import { getDb } from "@/lib/db";

// Rate limiting por llave (IP, email, etc.) sobre la tabla rate_limits.
// Uso típico: consultar rateLimitAllowed() y, si se pasa, registrar el
// intento con rateLimitRecordFailure(). En endpoints públicos donde cada
// request cuenta como intento, llamar a rateLimitConsume().
//
// La tabla es muy liviana (clave + contador + ventana) y se limpia sola:
// una ventana expirada se reinicia en el primer uso posterior.

interface LimitRow {
  count: number;
  window_start: string;
}

interface HeadersLike {
  get(name: string): string | null;
}

export function clientIp(headers: HeadersLike): string {
  const fwd = headers.get("x-forwarded-for") ?? "";
  const ip = (fwd.split(",")[0] ?? "").trim();
  return ip || "unknown";
}

async function limitRow(key: string): Promise<LimitRow | undefined> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT count, window_start FROM rate_limits WHERE key = ?",
    args: [key],
  });
  const row = result.rows[0] as unknown as LimitRow | undefined;
  if (!row) return undefined;
  return { count: Number(row.count), window_start: row.window_start };
}

async function windowExpired(row: LimitRow, windowMs: number): Promise<boolean> {
  return Date.now() - Date.parse(row.window_start) > windowMs;
}

export async function rateLimitAllowed(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  const row = await limitRow(key);
  if (!row) return true;
  if (await windowExpired(row, windowMs)) return true;
  return row.count < maxAttempts;
}

// Registra un intento fallido. Si la ventana expiró, reinicia el conteo.
export async function rateLimitRecordFailure(
  key: string,
  windowMs: number
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const row = await limitRow(key);
  if (!row) {
    await db.execute({
      sql: "INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?)",
      args: [key, now],
    });
    return;
  }
  const expired = await windowExpired(row, windowMs);
  await db.execute({
    sql: expired
      ? "UPDATE rate_limits SET count = 1, window_start = ? WHERE key = ?"
      : "UPDATE rate_limits SET count = ? WHERE key = ?",
    args: expired ? [now, key] : [row.count + 1, key],
  });
}

// Chequea y registra en un solo paso (para endpoints donde cada request es
// un intento). Devuelve false cuando la llave quedó bloqueada.
export async function rateLimitConsume(
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<boolean> {
  const allowed = await rateLimitAllowed(key, maxAttempts, windowMs);
  if (!allowed) return false;
  await rateLimitRecordFailure(key, windowMs);
  return true;
}

export async function rateLimitClear(key: string): Promise<void> {
  const db = await getDb();
  await db.execute({ sql: "DELETE FROM rate_limits WHERE key = ?", args: [key] });
}