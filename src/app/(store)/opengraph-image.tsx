import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#f5f5f4",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "#d4af37",
          }}
        >
          PIRATES
        </div>
        <div
          style={{
            fontSize: 28,
            color: "#a3a3a3",
            marginTop: 16,
            letterSpacing: "0.05em",
          }}
        >
          Perfumes Árabes e Importados
        </div>
        <div
          style={{
            fontSize: 20,
            color: "#6b6b6b",
            marginTop: 32,
          }}
        >
          Envíos a todo el país · Pago seguro con Mercado Pago
        </div>
      </div>
    ),
    { ...size }
  );
}
