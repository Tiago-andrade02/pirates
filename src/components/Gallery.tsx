"use client";

import { useState } from "react";
import { ProductImage } from "./ProductImage";

export function Gallery({ slug, name }: { slug: string; name: string }) {
  const [active, setActive] = useState(1);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-surface-2 to-background">
        <ProductImage
          image={slug}
          alt={`${name} — foto ${active}`}
          className="h-full w-full object-contain"
          variant={active}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2].map((variant) => (
          <button
            key={variant}
            type="button"
            onClick={() => setActive(variant)}
            aria-label={`Ver foto ${variant}`}
            className={`relative aspect-square overflow-hidden rounded-2xl border transition-colors ${
              active === variant
                ? "border-white"
                : "border-line hover:border-white/40"
            }`}
          >
            <ProductImage
              image={slug}
              alt=""
              className="h-full w-full object-cover"
              variant={variant}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
