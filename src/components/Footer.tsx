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
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          {/* Columna 1 — Categorías */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
              Categorías
            </h3>
            <ul className="mt-4 space-y-2.5">
              {CATEGORIES.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Columna 2 — Contacto */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
              Contactanos
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li className="flex items-center gap-2.5">
                <WhatsAppIcon className="h-4 w-4 shrink-0 text-faint" />
                <a
                  href="https://wa.me/5491172919482"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  +54 9 11 7291-9482
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <PhoneIcon className="h-4 w-4 shrink-0 text-faint" />
                <a
                  href="tel:+5491172919482"
                  className="transition-colors hover:text-white"
                >
                  +54 9 11 7291-9482
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MailIcon className="h-4 w-4 shrink-0 text-faint" />
                <a
                  href="mailto:pirates.arg@hotmail.com"
                  className="transition-colors hover:text-white"
                >
                  pirates.arg@hotmail.com
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                <span>Buenos Aires, Argentina</span>
              </li>
            </ul>
          </div>

          {/* Redes sociales — parte superior derecha */}
          <div className="flex items-start gap-3 lg:justify-end">
            <a
              href="https://instagram.com/pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white"
            >
              <InstagramIcon className="h-5 w-5" />
            </a>
            <a
              href="https://www.tiktok.com/@pirates.arg"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="TikTok"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-white/40 hover:text-white"
            >
              <TikTokIcon className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>

      {/* Línea divisoria */}
      <div className="border-t border-line" />

      {/* Parte 2 — Medios de pago y envío */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2">
          {/* Medios de pago */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
              Medios de pago
            </h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="rounded-full border border-line px-4 py-2 text-xs text-muted"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>

          {/* Medios de envío */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-widest text-white">
              Medios de envío
            </h3>
            <div className="mt-4 flex flex-wrap gap-3">
              {SHIPPING_METHODS.map((method) => (
                <span
                  key={method}
                  className="rounded-full border border-line px-4 py-2 text-xs text-muted"
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
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-3 text-xs text-faint sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} PIRATES &middot; Todos los
            derechos reservados
          </p>
          <div className="flex items-center gap-4">
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
              className="rounded-full border border-line px-3 py-1 transition-colors hover:border-gold/40 hover:text-gold"
            >
              Panel
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
