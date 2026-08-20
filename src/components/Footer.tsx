import Link from "next/link";
import {
  InstagramIcon,
  TikTokIcon,
  WhatsAppIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
} from "./icons";

const CATEGORIES = [
  { href: "/", label: "Inicio" },
  { href: "/perfumes", label: "Perfumes" },
  { href: "/marcas", label: "Marcas" },
  { href: "/perfumes?novedad=1", label: "Novedades" },
  { href: "/devoluciones", label: "Devoluciones" },
];

const PAYMENT_METHODS = [
  "MercadoPago",
  "Transferencia",
  "Efectivo",
  "Débito",
  "Crédito",
];

const SHIPPING_METHODS = ["Correo Argentino"];

export function Footer() {
  return (
    <footer id="contacto" className="w-full bg-[#0a0a0a]">
      {/* Parte 1 — Columnas */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-7 sm:gap-10 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          {/* Columna 1 — Categorías */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white sm:text-sm">
              Categorías
            </h3>
            <ul className="mt-3 space-y-1 sm:mt-4 sm:space-y-2">
              {CATEGORIES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex h-9 items-center text-xs text-muted transition-colors hover:text-white sm:h-auto sm:text-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 2 — Contacto */}
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white sm:text-sm">
              Contactanos
            </h3>
            <ul className="mt-3 space-y-1 text-xs text-muted sm:mt-4 sm:space-y-2.5 sm:text-sm">
              <li>
                <a
                  href="https://wa.me/5491172919482"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 transition-colors hover:text-white"
                >
                  <WhatsAppIcon className="h-4 w-4 shrink-0 text-faint" />
                  +54 9 11 7291-9482
                </a>
              </li>
              <li>
                <a
                  href="tel:+5491172919482"
                  className="inline-flex h-9 items-center gap-2 transition-colors hover:text-white"
                >
                  <PhoneIcon className="h-4 w-4 shrink-0 text-faint" />
                  +54 9 11 7291-9482
                </a>
              </li>
              <li>
                <a
                  href="mailto:pirates.arg@hotmail.com"
                  className="inline-flex h-9 items-center gap-2 transition-colors hover:text-white"
                >
                  <MailIcon className="h-4 w-4 shrink-0 text-faint" />
                  pirates.arg@hotmail.com
                </a>
              </li>
              <li>
                <span className="inline-flex h-9 items-center gap-2">
                  <MapPinIcon className="h-4 w-4 shrink-0 text-faint" />
                  Buenos Aires, Argentina
                </span>
              </li>
            </ul>
          </div>

          {/* Redes sociales */}
          <div className="flex items-start gap-3 sm:gap-3 lg:justify-end">
            <a
              href="https://instagram.com/pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white sm:h-10 sm:w-10"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href="https://www.tiktok.com/@pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white sm:h-10 sm:w-10"
            >
              <TikTokIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Línea divisoria */}
      <div className="border-t border-line" />

      {/* Parte 2 — Medios de pago y envío */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2">
          {/* Medios de pago */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white sm:text-sm">
              Medios de pago
            </h3>
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="rounded-full border border-line px-3 py-1.5 text-[11px] text-muted sm:px-4 sm:text-xs"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          {/* Medios de envío */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white sm:text-sm">
              Medios de envío
            </h3>
            <div className="mt-3 flex flex-wrap gap-2 sm:mt-4 sm:gap-3">
              {SHIPPING_METHODS.map((method) => (
                <span
                  key={method}
                  className="rounded-full border border-line px-3 py-1.5 text-[11px] text-muted sm:px-4 sm:text-xs"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Línea divisoria */}
      <div className="border-t border-line" />

      {/* Parte 3 — Copyright */}
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 text-[11px] text-faint sm:text-xs lg:flex-row">
          <p>
            &copy; {new Date().getFullYear()} PIRATES &middot; Todos los
            derechos reservados
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <a
              href="https://www.defensadelconsumidor.gob.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              Defensa del Consumidor
            </a>
            <Link
              href="/devoluciones"
              className="transition-colors hover:text-white"
            >
              Botón de arrepentimiento
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-line px-2.5 py-0.5 transition-colors hover:border-gold/40 hover:text-gold sm:px-3 sm:py-1"
            >
              Panel
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
