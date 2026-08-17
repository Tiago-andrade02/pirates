"use client";

import { useState, useEffect } from "react";

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
  const [src, setSrc] = useState(`/perfumes/${image}-${variant}.png`);

  useEffect(() => {
    setSrc(`/perfumes/${image}-${variant}.png`);
  }, [image, variant]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => {
        if (src.endsWith(".png")) {
          setSrc(`/perfumes/${image}-${variant}.svg`);
        }
      }}
    />
  );
}
