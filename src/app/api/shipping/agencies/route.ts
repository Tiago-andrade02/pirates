import { getShippingProvider } from "@/lib/shipping";
import { provinceCodeFor } from "@/lib/shipping/provinces";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const province = (url.searchParams.get("province") ?? "").trim();
  const provinceCode = (url.searchParams.get("provinceCode") ?? "").trim() || provinceCodeFor(province) || "";

  if (!provinceCode) {
    return Response.json(
      { error: "Provincia inválida" },
      { status: 400 }
    );
  }

  const provider = getShippingProvider();
  if (!provider.getAgencies) {
    return Response.json({ agencies: [] });
  }

  try {
    const agencies = await provider.getAgencies(provinceCode);
    return Response.json({ agencies });
  } catch (error) {
    console.error("[shipping/agencies]", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "No se pudieron obtener las sucursales. Intentalo de nuevo." },
      { status: 502 }
    );
  }
}
