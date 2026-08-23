"use client";

import Link from "next/link";
import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, MenuIcon, WhatsAppIcon, CartIcon } from "./icons";
import { NAV_LINKS } from "@/lib/nav-links";

interface MobileMenuProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function MobileMenu({ open, onOpen, onClose }: MobileMenuProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  return (
    <>
      <button
        type="button"
        onClick={open ? onClose : onOpen}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:text-white md:hidden"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
      >
        <span className="relative h-5 w-5">
          <MenuIcon
            className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${
              open ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
            }`}
          />
          <CloseIcon
            className={`absolute inset-0 h-5 w-5 transition-all duration-200 ${
              open ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
            }`}
          />
        </span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 md:hidden"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/70"
              onClick={onClose}
            />

            <div className="animate-slide-in-right absolute inset-y-0 right-0 flex h-full w-[85%] max-w-sm flex-col bg-background shadow-2xl shadow-black/50">
              <div className="flex h-12 items-center justify-between border-b border-line px-4">
                <span className="font-serif text-lg font-medium text-white tracking-wider">
                  PIRATES
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-white"
                  aria-label="Cerrar menú"
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    className="block rounded-lg px-4 py-3.5 text-base font-medium text-foreground transition-colors hover:bg-surface hover:text-gold"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="border-t border-line px-3 py-4 space-y-1">
                <Link
                  href="/carrito"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:text-gold"
                >
                  <CartIcon className="h-5 w-5" />
                  <span>Carrito</span>
                </Link>
                <a
                  href="https://wa.me/5491172919482"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-surface hover:text-gold"
                >
                  <WhatsAppIcon className="h-5 w-5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
