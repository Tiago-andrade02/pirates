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
    <header className="fixed top-0 left-0 right-0 z-[9999] w-full border-b border-line bg-background">
      <div className="mx-auto h-[64px] max-w-[1400px] px-4 sm:h-[68px] sm:px-6 lg:h-[72px] lg:px-10">
        <div className="grid h-full grid-cols-[1fr_auto_1fr] items-center gap-4 lg:grid-cols-[auto_1fr_auto] lg:gap-8">

          {/* Col 1: hamburger (mobile) | logo (desktop) */}
          <div className="flex items-center justify-self-start">
            <MobileMenu open={menuOpen} onOpen={openMenu} onClose={closeMenu} />
            <Link href="/" className="hidden items-center lg:flex">
              <img src="/nav-logo.png" alt="PIRATES" className="h-auto w-[100px] object-contain xl:w-[115px]" />
            </Link>
          </div>

          {/* Col 2: logo (mobile) | nav links (desktop) */}
          <Link href="/" className="flex items-center justify-self-center lg:hidden">
            <img src="/nav-logo.png" alt="PIRATES" className="h-[18px] w-auto object-contain" />
          </Link>
          <nav className="hidden items-center justify-center gap-2 lg:flex">
            {NAV_LINKS_DESKTOP.map((link) => (
              <Link key={link.href} href={link.href} className="mi-nav-link rounded-full px-4 py-2 text-sm text-muted transition-colors hover:text-white">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Col 3: search + cart */}
          <div className="flex items-center justify-end gap-1">
            <NavSearch mobileOpen={searchOpen} onMobileOpen={openSearch} onMobileClose={closeSearch} />
            <CartBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
