"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { CartBadge } from "./cart/CartBadge";
import { MobileMenu } from "./MobileMenu";
import { NavSearch } from "./NavSearch";
import { WhatsAppIcon } from "./icons";
import { NAV_LINKS } from "@/lib/nav-links";

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
      <div className="mx-auto grid h-[64px] max-w-[1400px] grid-cols-[auto_1fr_auto] items-center px-4 sm:h-[68px] sm:px-6 lg:h-[72px] lg:px-10">

        <div className="md:hidden">
          <MobileMenu open={menuOpen} onOpen={openMenu} onClose={closeMenu} />
        </div>

        <div className="flex items-center justify-center px-2 md:justify-start md:px-0">
          <Link href="/" className="shrink-0 md:mr-6 lg:mr-8">
            <img
              src="/nav-logo.png"
              alt="PIRATES"
              className="h-[32px] w-auto object-contain lg:h-[36px]"
            />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mi-nav-link rounded-full px-4 py-2 text-sm text-muted hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <a
            href="https://wa.me/5491172919482"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-gold sm:inline-flex"
          >
            <WhatsAppIcon className="h-5 w-5" />
          </a>
          <NavSearch
            mobileOpen={searchOpen}
            onMobileOpen={openSearch}
            onMobileClose={closeSearch}
          />
          <CartBadge />
        </div>
      </div>
    </header>
  );
}
