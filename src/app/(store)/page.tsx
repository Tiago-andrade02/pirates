import Link from "next/link";
import { getBestSellers, getNewArrivals, getBrands } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
import { ProductCarousel } from "@/components/ProductCarousel";
import { Stars } from "@/components/Stars";
import {
  ArrowRightIcon,
  BadgeIcon,
  CreditCardIcon,
  ShieldIcon,
  TruckIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";

const BENEFITS = [
  {
    icon: TruckIcon,
    title: "Envío gratis desde $80.000",
    description: "Recibí tu perfume donde estés. Envío gratis en compras superiores a $80.000.",
  },
  {
    icon: CreditCardIcon,
    title: "Mercado Pago",
    description: "Tarjetas, efectivo y cuotas con la seguridad de Mercado Pago.",
  },
  {
    icon: ShieldIcon,
    title: "Compra segura",
    description: "Tus datos protegidos y garantía de entrega.",
  },
  {
    icon: BadgeIcon,
    title: "Alta calidad",
    description: "Fragancias premium seleccionadas de las mejores casas árabes del Golfo.",
  },
];

const TESTIMONIALS = [
  {
    name: "Martina G.",
    city: "CABA",
    product: "Lattafa Khamrah",
    text: "El Khamrah superó todas mis expectativas. Dura muchísimo y la proyección es increíble. La atención fue excelente y llegó en 2 días.",
    rating: 5,
  },
  {
    name: "Julián R.",
    city: "Rosario",
    product: "Afnan 9PM",
    text: "Compré el 9PM para una fiesta y no puedo estar más contento. Todos me preguntaron qué perfume usaba.",
    rating: 5,
  },
  {
    name: "Camila T.",
    city: "Córdoba",
    product: "Lattafa Yara",
    text: "El Yara es un sueño, dulce pero elegante. El empaque impecable y el precio mucho mejor que en otras tiendas.",
    rating: 5,
  },
  {
    name: "Facundo M.",
    city: "Mendoza",
    product: "Armaf CDN Intense",
    text: "La mejor compra que hice. El Club de Nuit Intense es legendario y acá está a precio real. Voy a seguir comprando.",
    rating: 4,
  },
];

function SectionHeading({
  kicker,
  title,
  href,
}: {
  kicker: string;
  title: string;
  href?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.3em] text-faint sm:text-xs">{kicker}</p>
        <h2 className="mt-1.5 font-serif text-[1.5rem] leading-tight text-white sm:mt-2 sm:text-3xl lg:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group hidden shrink-0 items-center gap-2 text-sm text-muted transition-colors hover:text-white sm:flex"
        >
          Ver todos
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export default async function HomePage() {
  const bestSellers = await getBestSellers(10);
  const newArrivals = await getNewArrivals(10);
  const brands = await getBrands();

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[calc(100svh-3.5rem-8rem)] items-center justify-center overflow-hidden bg-black sm:min-h-[calc(100svh-4rem-2.5rem)]">
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="hero-fade pointer-events-none absolute left-[50%] top-1/2 w-[80%] -translate-y-1/2 select-none object-contain opacity-[0.06] grayscale sm:left-1/2 sm:w-[85%] sm:-translate-x-1/2 max-w-6xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03),transparent_60%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-10 sm:px-6 sm:py-24 lg:px-8">
          <div className="max-w-3xl">
            <p
              className="hero-fade-up text-[11px] font-medium uppercase tracking-[0.3em] text-muted sm:text-xs"
              style={{ animationDelay: "0ms" }}
            >
              Perfumería árabe &amp; importada
            </p>

            <h1
              className="hero-fade-up mt-3 font-serif font-medium leading-[1.08] text-white sm:mt-6"
              style={{ animationDelay: "120ms", fontSize: "clamp(2rem, 7vw, 4.5rem)" }}
            >
              FRAGANCIAS
              <br />
              QUE DEJAN
              <br />
              <span className="italic">HUELLA.</span>
            </h1>

            <p
              className="hero-fade-up mt-4 max-w-xl text-sm leading-relaxed text-muted sm:mt-7 sm:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              &ldquo;Descubrí una selección de fragancias de alta calidad, elegidas
              para quienes buscan presencia, personalidad y un aroma que los
              represente.&rdquo;
            </p>

            <div
              className="hero-fade-up mt-7 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
              style={{ animationDelay: "360ms" }}
            >
              <Link
                href="/perfumes"
                className="mi-btn mi-shine group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-black sm:w-auto sm:h-13 sm:px-8"
              >
                EXPLORAR CATÁLOGO
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/#nosotros"
                className="mi-btn inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-sm font-semibold text-white hover:border-white/50 hover:bg-white/5 sm:w-auto sm:h-13 sm:px-8"
              >
                CONOCÉ PIRATES
              </Link>
            </div>

            <p
              className="hero-fade-up mt-8 hidden text-center text-[11px] uppercase tracking-[0.25em] text-faint sm:mt-10 sm:block"
              style={{ animationDelay: "480ms" }}
            >
              Alta calidad · Envío gratis desde $80.000 · Atención personalizada
            </p>
          </div>
        </div>
      </section>

      {/* MÁS VENDIDOS - Carousel */}
      <section className="mx-auto max-w-7xl py-10 sm:py-20">
        <ProductCarousel
          kicker="Los favoritos"
          title="Más vendidos"
          href="/perfumes?destacados=1"
          products={bestSellers}
        />
      </section>

      {/* NOVEDADES - Carousel */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl py-10 sm:py-20">
          <ProductCarousel
            kicker="Recién llegados"
            title="Novedades"
            href="/perfumes?novedad=1"
            products={newArrivals}
          />
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-8 sm:grid-cols-2 sm:gap-6 sm:px-6 sm:py-12 lg:grid-cols-4 lg:px-8">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-background text-white sm:h-11 sm:w-11">
                <benefit.icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[13px] font-semibold text-white sm:text-sm">
                  {benefit.title}
                </h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted sm:mt-1 sm:text-sm">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MARCAS */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          kicker="Casas que importamos"
          title="Marcas"
          href="/marcas"
        />
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-10 sm:grid-cols-3 sm:gap-4 lg:grid-cols-7 lg:gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/perfumes?marca=${brand.slug}`}
              className="group flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-surface p-3 text-center transition-all hover:border-white/30 hover:bg-surface-2 sm:gap-2 sm:rounded-2xl sm:p-4"
            >
              <span className="font-serif text-sm leading-tight text-white transition-colors group-hover:text-white sm:text-lg lg:text-xl">
                {brand.name}
              </span>
              <span className="text-[9px] uppercase tracking-widest text-faint sm:text-[10px] lg:text-[11px]">
                {brand.country}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* OPINIONES */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading kicker="Testimonios" title="Opiniones de clientes" />
          <div className="mt-5 grid gap-3 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-line bg-background p-4 sm:p-6"
              >
                <Stars value={t.rating} />
                <blockquote className="mt-2.5 flex-1 text-[13px] leading-relaxed text-muted sm:mt-3 sm:text-sm">
                  &ldquo;{t.text}&rdquo;
                </blockquote>
                <figcaption className="mt-3 sm:mt-5">
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-faint">
                    {t.city} · Compró {t.product}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* NOSOTROS */}
      <section
        id="nosotros"
        className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="grid items-start gap-8 sm:gap-12 lg:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-faint sm:text-xs">
              Sobre PIRATES
            </p>
            <h2 className="mt-2 font-serif text-[1.5rem] leading-tight text-white sm:mt-3 sm:text-3xl lg:text-4xl">
              Más que una fragancia.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted sm:mt-4 sm:text-base">
              En PIRATES creemos que un buen perfume no solo se siente: se
              recuerda.
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted sm:mt-4 sm:text-base">
              Seleccionamos perfumes árabes e importados de alta calidad,
              buscando ofrecer fragancias con excelente presencia,
              personalidad y una experiencia que esté a la altura de quienes
              las eligen.
            </p>
            <p className="mt-2.5 text-sm leading-relaxed text-muted sm:mt-4 sm:text-base">
              Nuestra propuesta es simple: ofrecer perfumes que sorprendan por
              su calidad, su aroma y su presencia, para que encuentres una
              fragancia que realmente te represente.
            </p>
            <Link
              href="/perfumes"
              className="mi-btn mi-shine group mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-black sm:mt-7 sm:h-12 sm:px-7"
            >
              Empezar a explorar
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-[1.75rem] leading-none text-white sm:text-4xl">9+</p>
              <p className="mt-2 text-xs text-muted sm:text-sm">Casas importadas</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-[1.75rem] leading-none text-white sm:text-4xl">40+</p>
              <p className="mt-2 text-xs text-muted sm:text-sm">Fragancias en catálogo</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-[1.75rem] leading-none text-white sm:text-4xl">24 hs</p>
              <p className="mt-2 text-xs text-muted sm:text-sm">Despacho de pedidos</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
              <p className="font-serif text-[1.75rem] leading-none text-white sm:text-4xl">24/7</p>
              <p className="mt-2 text-xs text-muted sm:text-sm">Atención por WhatsApp</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
