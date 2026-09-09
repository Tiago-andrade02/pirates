"use client";

import { useState } from "react";

interface ProductImageProps {
  image: string;
  alt: string;
  className?: string;
  variant?: number;
}

export function ProductImage({
  image,
  alt,
  className,
  variant = 1,
}: ProductImageProps) {
  // Caída a SVG si el PNG no existe. Se reinicia el fallback cuando cambia el
  // producto/variante ajustando estado durante el render (patrón recomendado,
  // sin setState sincrónico en effects).
  const [fellBack, setFellBack] = useState(false);
  const [prevKey, setPrevKey] = useState(`${image}-${variant}`);
  if (prevKey !== `${image}-${variant}`) {
    setPrevKey(`${image}-${variant}`);
    setFellBack(false);
  }

  const src = `/perfumes/${image}-${variant}.${fellBack ? "svg" : "png"}`;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (!fellBack) {
          setFellBack(true);
        }
      }}
    />
  );
}
