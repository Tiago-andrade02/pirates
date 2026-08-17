import Link from "next/link";
import { getBestSellers, getNewArrivals, getBrands } from "@/lib/data";
import { ProductCard } from "@/components/ProductCard";
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
    <div className="flex items-end justify-between gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-faint">{kicker}</p>
        <h2 className="mt-2 font-serif text-3xl text-white sm:text-4xl">
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group hidden items-center gap-2 text-sm text-muted transition-colors hover:text-white sm:flex"
        >
          Ver todos
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const bestSellers = getBestSellers(4);
  const newArrivals = getNewArrivals(4);
  const brands = getBrands();

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-black">
        <img
          src="/logo.png"
          alt=""
          aria-hidden
          className="hero-fade pointer-events-none absolute left-[62%] top-1/2 w-[85%] max-w-6xl -translate-x-1/2 -translate-y-1/2 select-none object-contain opacity-[0.04] grayscale"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.03),transparent_60%)]" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-24 text-left sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p
              className="hero-fade-up text-xs font-medium uppercase tracking-[0.35em] text-muted"
              style={{ animationDelay: "0ms" }}
            >
              Perfumería árabe &amp; importada
            </p>

            <h1
              className="hero-fade-up mt-6 font-serif text-5xl font-medium leading-[1.05] text-white sm:text-6xl xl:text-7xl"
              style={{ animationDelay: "120ms" }}
            >
              FRAGANCIAS
              <br />
              QUE DEJAN
              <br />
              <span className="italic">HUELLA.</span>
            </h1>

            <p
              className="hero-fade-up mt-7 max-w-xl text-lg leading-relaxed text-muted"
              style={{ animationDelay: "240ms" }}
            >
              “Descubrí una selección de fragancias de alta calidad, elegidas
              para quienes buscan presencia, personalidad y un aroma que los
              represente.”
            </p>

            <div
              className="hero-fade-up mt-10 flex flex-wrap items-center gap-4"
              style={{ animationDelay: "360ms" }}
            >
              <Link
                href="/perfumes"
                className="group inline-flex h-13 items-center gap-2 rounded-full bg-white px-8 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
              >
                EXPLORAR CATÁLOGO
                <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/#nosotros"
                className="inline-flex h-13 items-center gap-2 rounded-full border border-white/25 px-8 text-sm font-semibold text-white transition-colors hover:border-white/50 hover:bg-white/5"
              >
                CONOCÉ PIRATES
              </Link>
            </div>

            <p
              className="hero-fade-up mt-10 text-[11px] uppercase tracking-[0.25em] text-faint"
              style={{ animationDelay: "480ms" }}
            >
              Alta calidad · Envío gratis desde $80.000 · Atención personalizada
            </p>
          </div>
        </div>
      </section>

      {/* BENEFICIOS */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line bg-background text-white">
                <benefit.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {benefit.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {benefit.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* MÁS VENDIDOS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          kicker="Los favoritos"
          title="Más vendidos"
          href="/perfumes?destacados=1"
        />
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {bestSellers.map((perfume) => (
            <ProductCard key={perfume.id} perfume={perfume} />
          ))}
        </div>
      </section>

      {/* NOVEDADES */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading
            kicker="Recién llegados"
            title="Novedades"
            href="/perfumes?novedad=1"
          />
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
            {newArrivals.map((perfume) => (
              <ProductCard key={perfume.id} perfume={perfume} />
            ))}
          </div>
        </div>
      </section>

      {/* MARCAS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          kicker="Casas que importamos"
          title="Marcas"
          href="/marcas"
        />
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-7 lg:gap-6">
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={`/perfumes?marca=${brand.slug}`}
              className="group flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-2xl border border-line bg-surface p-4 text-center transition-all hover:border-white/30 hover:bg-surface-2"
            >
              <span className="font-serif text-xl leading-tight text-white transition-colors group-hover:text-white">
                {brand.name}
              </span>
              <span className="text-[11px] uppercase tracking-widest text-faint">
                {brand.country}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* OPINIONES */}
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <SectionHeading kicker="Testimonios" title="Opiniones de clientes" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-line bg-background p-6"
              >
                <Stars value={t.rating} />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-muted">
                  “{t.text}”
                </blockquote>
                <figcaption className="mt-6">
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
        className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-faint">
              Sobre PIRATES
            </p>
            <h2 className="mt-3 font-serif text-3xl text-white sm:text-4xl">
              Más que una fragancia.
            </h2>
            <p className="mt-5 leading-relaxed text-muted">
              En PIRATES creemos que un buen perfume no solo se siente: se
              recuerda.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Seleccionamos perfumes árabes e importados de alta calidad,
              buscando ofrecer fragancias con excelente presencia,
              personalidad y una experiencia que esté a la altura de quienes
              las eligen.
            </p>
            <p className="mt-4 leading-relaxed text-muted">
              Nuestra propuesta es simple: ofrecer perfumes que sorprendan por
              su calidad, su aroma y su presencia, para que encuentres una
              fragancia que realmente te represente.
            </p>
            <Link
              href="/perfumes"
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
            >
              Empezar a explorar
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-serif text-4xl text-white">9+</p>
              <p className="mt-2 text-sm text-muted">Casas importadas</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-serif text-4xl text-white">40+</p>
              <p className="mt-2 text-sm text-muted">Fragancias en catálogo</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-serif text-4xl text-white">24 hs</p>
              <p className="mt-2 text-sm text-muted">Despacho de pedidos</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-serif text-4xl text-white">24/7</p>
              <p className="mt-2 text-sm text-muted">Atención por WhatsApp</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
