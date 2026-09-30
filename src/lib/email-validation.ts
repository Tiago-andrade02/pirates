// Validacion de email compartida entre el formulario y la API.
//
// Vive en un modulo puro (sin dependencias) para que el cliente y el servidor
// apliquen EXACTAMENTE la misma regla: si divergieran, el navegador dejaría
// pasar una dirección que la API rechaza (o al reves), con el pedido sin crear y
// un error incomodo para el comprador.
//
// No intenta ser un parser RFC 5322 completo: solo acepta la forma que un
// comprador real escribe, y rechaza lo que no puede deliverarse.
const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/;

export const MAX_EMAIL_LENGTH = 160;

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const email = value.trim();
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  // Rechaza doble arroba, espacios y falta de punto en el dominio.
  return EMAIL_PATTERN.test(email);
}

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
