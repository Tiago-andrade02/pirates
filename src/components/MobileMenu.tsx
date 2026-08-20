"use client";

import Link from "next/link";
import { useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, MenuIcon, WhatsAppIcon, CartIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/perfumes", label: "Perfumes" },
  { href: "/marcas", label: "Marcas" },
  { href: "/perfumes?novedad=1", label: "Novedades" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#contacto", label: "Contacto" },
];

interface MobileMenuProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function MobileMenu({ open, onOpen, onClose }: MobileMenuProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.overflow = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [open, handleEscape]);

  const hamburger = (
    <button
      type="button"
      onClick={open ? onClose : onOpen}
      className="mi-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-muted md:hidden"
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
  );

  if (!open || !mounted) return hamburger;

  const drawer = (
    <div
      className="fixed inset-0 z-[9999] md:hidden"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="animate-slide-in-right absolute inset-y-0 right-0 flex h-full w-[85%] max-w-sm flex-col border-l border-line bg-background shadow-2xl shadow-black/50">
        <div className="flex h-14 items-center justify-end border-b border-line px-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-white"
            aria-label="Cerrar menú"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {LINKS.map((link) => (
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
    </div>
  );

  return (
    <>
      {hamburger}
      {createPortal(drawer, document.body)}
    </>
  );
}
