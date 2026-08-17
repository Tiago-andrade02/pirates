"use client";

import { useState } from "react";
import Link from "next/link";
import { CloseIcon, MenuIcon } from "./icons";
import { SearchBox } from "./SearchBox";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/perfumes", label: "Perfumes" },
  { href: "/marcas", label: "Marcas" },
  { href: "/perfumes?novedad=1", label: "Novedades" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#contacto", label: "Contacto" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white md:hidden"
        aria-label="Abrir menú"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col border-l border-line bg-background px-6 py-6">
            <div className="flex items-center justify-between">
              <img
                src="/logo.png"
                alt="PIRATES"
                className="h-9 w-auto object-contain"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-white"
                aria-label="Cerrar menú"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6">
              <SearchBox />
            </div>

            <nav className="mt-8 flex flex-col gap-1">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base text-muted transition-colors hover:bg-surface-2 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
