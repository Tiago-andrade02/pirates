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
    <header className="sticky top-0 z-40 border-b border-line bg-background">
      <div className="mx-auto h-[52px] max-w-[1400px] px-3 sm:h-[56px] sm:px-5 md:h-[56px] md:px-6 lg:h-[60px] lg:px-8">
        <div className="grid h-full grid-cols-[auto_1fr_auto] items-center">

          {/* Col 1: hamburger + logo (mobile) | hamburger + logo (desktop) */}
          <div className="flex items-center gap-2.5">
            <MobileMenu open={menuOpen} onOpen={openMenu} onClose={closeMenu} />
            <Link href="/" className="flex items-center">
              <img src="/nav-logo.png" alt="PIRATES" className="h-[14px] w-auto object-contain sm:h-[16px] md:h-[22px] lg:h-[26px]" />
            </Link>
          </div>

          {/* Col 2: nav links (desktop only, centered) */}
          <nav className="hidden items-center justify-center gap-0.5 md:flex lg:gap-1">
            {NAV_LINKS_DESKTOP.map((link) => (
              <Link key={link.href} href={link.href} className="mi-nav-link rounded-full px-2.5 py-1.5 text-[13px] text-muted hover:text-white lg:px-3 lg:py-2 lg:text-sm">
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Col 3: search + cart */}
          <div className="flex items-center justify-end gap-0 sm:gap-0.5">
            <NavSearch mobileOpen={searchOpen} onMobileOpen={openSearch} onMobileClose={closeSearch} />
            <CartBadge />
          </div>
        </div>
      </div>
    </header>
  );
}
