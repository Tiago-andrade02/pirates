"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

interface ClientCarouselProps {
  children: ReactNode;
}

export function ClientCarousel({ children }: ClientCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return;
    const card = scrollRef.current.firstElementChild;
    if (!card) return;
    const cardWidth = (card as HTMLElement).offsetWidth;
    const gap = 12;
    const amount = cardWidth + gap;
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="scrollbar-none flex gap-3 items-stretch overflow-x-auto scroll-smooth px-4 pb-2 sm:px-0 lg:gap-4"
        style={{
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {children}
      </div>

      <button
        type="button"
        onClick={() => scroll("left")}
        className="mi-arrow absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background/90 text-muted backdrop-blur-sm hover:border-white/40 hover:text-white lg:flex"
        aria-label="Desplazar a la izquierda"
      >
        <ChevronLeftIcon className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="mi-arrow absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-background/90 text-muted backdrop-blur-sm hover:border-white/40 hover:text-white lg:flex"
        aria-label="Desplazar a la derecha"
      >
        <ChevronRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
