export function productImageUrl(image: string, variant = 1): string {
  return `/perfumes/${image}-${variant}.png`;
}
