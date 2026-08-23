"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { CartBadge } from "./cart/CartBadge";
import { MobileMenu } from "./MobileMenu";
import { NavSearch } from "./NavSearch";
import { NAV_LINKS_DESKTOP } from "@/lib/nav-links";

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const openMenu = useCallback(() => {
    setSearchOpen(false);
    setMenuOpen(true);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openSearch = useCallback(() => {
    setMenuOpen(false);
    setSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => setSearchOpen(false), []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
      <div className="mx-auto h-[64px] max-w-[1400px] px-4 sm:h-[68px] sm:px-6 md:h-[68px] md:px-8 lg:h-[72px] lg:px-10">
        <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center md:grid-cols-[auto_1fr_auto]">

          {/* ── Left zone ── */}
          <div className="flex items-center">
            <MobileMenu open={menuOpen} onOpen={openMenu} onClose={closeMenu} />
            <Link
              href="/"
              className="hidden items-center md:flex"
            >
              <img
                src="/nav-logo.png"
                alt="PIRATES"
                className="h-[28px] w-auto object-contain lg:h-[32px]"
              />
            </Link>
          </div>

          {/* ── Center zone: mobile logo ── */}
          <Link
            href="/"
            className="flex items-center justify-self-center md:hidden"
          >
            <img
              src="/nav-logo.png"
              alt="PIRATES"
              className="h-[22px] w-auto object-contain"
            />
          </Link>

          {/* ── Center zone: desktop nav links ── */}
          <nav className="hidden items-center justify-center gap-1 md:flex">
            {NAV_LINKS_DESKTOP.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mi-nav-link rounded-full px-3 py-2 text-sm text-muted hover:text-white lg:px-4"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ── Right zone ── */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <NavSearch
              mobileOpen={searchOpen}
              onMobileOpen={openSearch}
              onMobileClose={closeSearch}
            />
            <CartBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
