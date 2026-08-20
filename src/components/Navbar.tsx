import Link from "next/link";
import { CartBadge } from "./cart/CartBadge";
import { MobileMenu } from "./MobileMenu";
import { NavSearch } from "./NavSearch";
import { WhatsAppIcon } from "./icons";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/perfumes", label: "Perfumes" },
  { href: "/marcas", label: "Marcas" },
  { href: "/perfumes?novedad=1", label: "Novedades" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#contacto", label: "Contacto" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/" className="absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
          <img
            src="/nav-logo.png"
            alt="PIRATES"
            className="h-7 w-auto object-contain sm:h-9"
          />
        </Link>

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
          <NavSearch />
          <CartBadge />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
