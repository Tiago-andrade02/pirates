export type ProductImageExt = "png" | "svg";

// Ruta pública de la foto de producto. `ext` permite pedir el placeholder SVG
// cuando el PNG no existe: es el mismo mecanismo que usa ProductImage para el
// fallback, así la convención de ruta vive en un solo lugar.
export function productImageUrl(
  image: string,
  variant = 1,
  ext: ProductImageExt = "png"
): string {
  return `/perfumes/${image}-${variant}.${ext}`;
}
