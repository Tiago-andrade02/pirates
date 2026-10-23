"use client";

import { useState } from "react";
import Image from "next/image";
import { productImageUrl } from "@/lib/images";

interface ProductImageProps {
  image: string;
  alt: string;
  className?: string;
  variant?: number;
  sizes?: string;
  fill?: boolean;
}

// Lado intrínseco de las fotos reales (1254×1254). Sólo es una pista de relación
// de aspecto: el layout lo define el `className` del contenedor, como antes con
// el <img> crudo. Evita CLS mientras carga el CSS.
const INTRINSIC = 1254;

// `sizes` por defecto: peor caso razonable (imagen a ancho completo en mobile).
// Cada uso que conoce su tamaño real (galería, carrito, buscador, admin) lo
// declara para no descargar una variante más grande de la necesaria.
const DEFAULT_SIZES = "100vw";

export function ProductImage({
  image,
  alt,
  className,
  variant = 1,
  sizes = DEFAULT_SIZES,
  fill = false,
}: ProductImageProps) {
  // Caída a SVG si el PNG no existe (p. ej. productos sin foto cargada: el
  // panel admin crea sólo el placeholder `.svg`). Se reinicia el fallback cuando
  // cambia el producto/variante ajustando estado durante el render (patrón
  // recomendado, sin setState sincrónico en effects).
  const [fellBack, setFellBack] = useState(false);
  const [prevKey, setPrevKey] = useState(`${image}-${variant}`);
  if (prevKey !== `${image}-${variant}`) {
    setPrevKey(`${image}-${variant}`);
    setFellBack(false);
  }

  const src = productImageUrl(image, variant, fellBack ? "svg" : "png");

  // Se usa next/image (antes <img>) para servir WebP/AVIF redimensionado y
  // cacheado por el optimizador en vez del PNG crudo de ~1,5 MB en cada vista.
  return (
    <Image
      src={src}
      alt={alt}
      {...(fill ? { fill: true } : { width: INTRINSIC, height: INTRINSIC })}
      sizes={sizes}
      className={className}
      onError={() => {
        if (!fellBack) {
          setFellBack(true);
        }
      }}
    />
  );
}
