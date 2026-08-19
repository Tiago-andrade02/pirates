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
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          {/* Columna 1 — Categorías */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white sm:text-sm">
              Categorías
            </h3>
            <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
              {CATEGORIES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-xs text-muted transition-colors hover:text-white sm:text-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 2 — Contacto */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-white sm:text-sm">
              Contactanos
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs text-muted sm:mt-4 sm:space-y-3 sm:text-sm">
              <li className="flex items-center gap-2">
                <WhatsAppIcon className="h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
                <a
                  href="https://wa.me/5491172919482"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  +54 9 11 7291-9482
                </a>
              </li>
              <li className="flex items-center gap-2">
                <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
                <a
                  href="tel:+5491172919482"
                  className="transition-colors hover:text-white"
                >
                  +54 9 11 7291-9482
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MailIcon className="h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
                <a
                  href="mailto:pirates.arg@hotmail.com"
                  className="transition-colors hover:text-white"
                >
                  pirates.arg@hotmail.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint sm:h-4 sm:w-4" />
                <span>Buenos Aires, Argentina</span>
              </li>
            </ul>
          </div>

          {/* Redes sociales */}
          <div className="flex items-start gap-2.5 sm:gap-3 lg:justify-end">
            <a
              href="https://instagram.com/pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white sm:h-10 sm:w-10"
            >
              <InstagramIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
            <a
              href="https://www.tiktok.com/@pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white sm:h-10 sm:w-10"
            >
              <TikTokIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Línea divisoria */}
      <div className="border-t border-line" />

      {/* Parte 2 — Medios de pago y envío */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-8 sm:gap-10 md:grid-cols-2">
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
            <a
              href="#"
              className="transition-colors hover:text-white"
            >
              Botón de arrepentimiento
            </a>
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
