// Valor de "envío gratis" legible EN CLIENTE (componentes "use client").
// El servidor (src/lib/shipping/index.ts) lee la MISMA precedencia:
//   NEXT_PUBLIC_SHIPPING_FREE_MIN → SHIPPING_FREE_MIN → 80000
// Así el frontend muestra siempre el importe real configurado por el operador,
// nunca un 80000 hardcodeado. En el browser `SHIPPING_FREE_MIN` no llega, por
// eso el alias NEXT_PUBLIC_ es la forma de propagar el valor.
export const FREE_SHIPPING_MIN = Number(
  process.env.NEXT_PUBLIC_SHIPPING_FREE_MIN ??
    process.env.SHIPPING_FREE_MIN ??
    80000
);
