import { getDb } from "@/lib/db";
import { isAdmin } from "@/app/admin/actions";
import { getShippingProviderById } from "@/lib/shipping";
import type { ShippingProviderId } from "@/lib/shipping/types";

// Descarga el rótulo (PDF) de un pedido despachado vía /v1/labels.
// Requiere sesión de administrador (cookie). El PDF vuelve como attachment y
// se cachea en orders.shipping_label para no golpear la API cada vez.
export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const code = (url.searchParams.get("code") ?? "").trim();
  if (!code) {
    return Response.json({ error: "Falta el código de pedido" }, { status: 400 });
  }

  const db = await getDb();
  let row: unknown;
  try {
    const result = await db.execute({
      sql: `SELECT code, shipping_provider, tracking_number, shipping_label
            FROM orders WHERE code = ?`,
      args: [code],
    });
    row = result.rows[0];
  } catch (error) {
    console.error("[shipping/label] Error leyendo orden", error);
    return Response.json({ error: "Error interno" }, { status: 500 });
  }

  const order = row as
    | {
        code: string;
        shipping_provider: string;
        tracking_number: string;
        shipping_label: string;
      }
    | undefined;

  if (!order) {
    return Response.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  if (!order.shipping_provider || !order.tracking_number) {
    return Response.json(
      { error: "El pedido no tiene un envío generado con tracking" },
      { status: 400 }
    );
  }

  let base64 = order.shipping_label || "";
  if (!base64) {
    let provider;
    try {
      provider = getShippingProviderById(order.shipping_provider as ShippingProviderId);
    } catch (error) {
      console.error("[shipping/label]", error instanceof Error ? error.message : error);
      return Response.json(
        { error: "El proveedor de envío de este pedido no está configurado" },
        { status: 503 }
      );
    }
    if (!provider.getLabel) {
      return Response.json(
        { error: "El proveedor de este pedido no ofrece rótulo por API. Generalo desde el panel de MiCorreo." },
        { status: 501 }
      );
    }

    try {
      base64 = (await provider.getLabel(order.tracking_number)) ?? "";
    } catch (error) {
      console.error("[shipping/label]", error instanceof Error ? error.message : error);
      return Response.json(
        { error: "No se pudo obtener el rótulo. Es probable que el envío todavía no esté impuesto en Correo Argentino." },
        { status: 502 }
      );
    }

    if (!base64) {
      return Response.json(
        { error: "Correo Argentino no devolvió un rótulo para este envío." },
        { status: 502 }
      );
    }

    try {
      await db.execute({
        sql: "UPDATE orders SET shipping_label = ? WHERE code = ?",
        args: [base64, code],
      });
    } catch (error) {
      console.error("[shipping/label] Error cacheando rótulo", error);
    }
  }

  const buffer = Buffer.from(base64, "base64");
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="rotulo-${order.code}.pdf"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}