// Modo de prueba del checkout: permite crear un pedido real en estado
// 'pendiente' SIN Mercado Pago, para verificar el formulario, el envío gratis y
// la ausencia de sucursales desde una Preview de Vercel.
//
// Es SOLO server-side: nunca se expone con NEXT_PUBLIC_* y el cliente no puede
// activarlo. La decisión la toma el servidor a partir de variables de entorno.
//
// Reglas, fail-closed ante cualquier ambigüedad:
//   • Requiere CHECKOUT_TEST_MODE === "true" (valor exacto).
//   • En Vercel, la señal autoritativa es VERCEL_ENV: sólo "preview" habilita.
//     Cualquier otro valor (production, development, vacío) desactiva.
//   • Fuera de Vercel (VERCEL_ENV sin definir): sólo fuera de producción
//     (NODE_ENV !== "production"), es decir desarrollo local.
//   • Protección explícita e independiente: VERCEL_ENV === "production" siempre
//     desactiva, aunque CHECKOUT_TEST_MODE esté configurado.
export interface CheckoutTestEnv {
  CHECKOUT_TEST_MODE?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
}

export function isCheckoutTestModeEnabled(
  env: CheckoutTestEnv = process.env
): boolean {
  if (env.CHECKOUT_TEST_MODE !== "true") return false;

  // Protección explícita para producción en Vercel: nunca se habilita, aunque
  // la variable esté seteada. Es independiente del chequeo de "preview".
  if (env.VERCEL_ENV === "production") return false;

  if (env.VERCEL_ENV !== undefined) {
    // En Vercel sólo Preview habilita. Un VERCEL_ENV vacío o desconocido es
    // ambiguo => desactivado.
    return env.VERCEL_ENV === "preview";
  }

  // Sin VERCEL_ENV: desarrollo local, nunca producción.
  return env.NODE_ENV !== "production";
}
