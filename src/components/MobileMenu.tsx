"use client";

import Link from "next/link";
import { CloseIcon, MenuIcon, WhatsAppIcon } from "./icons";

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
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
        className="mi-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-muted md:hidden"
        aria-label="Abrir menú"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="animate-slide-in-right absolute inset-y-0 left-0 right-0 flex w-full flex-col bg-background">
            <div className="flex h-14 items-center justify-between border-b border-line px-4 sm:h-16">
              <img
                src="/nav-logo.png"
                alt="PIRATES"
                className="h-7 w-auto object-contain sm:h-8"
              />
              <button
                type="button"
                onClick={onClose}
                className="mi-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface hover:text-white"
                aria-label="Cerrar menú"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-4 py-4">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="mi-btn block rounded-lg px-4 py-3.5 text-base font-medium text-foreground hover:bg-surface hover:text-gold"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="border-t border-line px-4 py-5">
              <a
                href="https://wa.me/5491172919482"
                target="_blank"
                rel="noopener noreferrer"
                className="mi-btn flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-muted hover:bg-surface hover:text-gold"
              >
                <WhatsAppIcon className="h-5 w-5" />
                <span>+54 9 11 7291-9482</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
