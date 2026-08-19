import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerfumeBySlug, getRelated } from "@/lib/data";
import { formatARS } from "@/lib/format";
import type { Aroma, Occasion, Season } from "@/lib/types";
import { Gallery } from "@/components/Gallery";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { Meter, Stars } from "@/components/Stars";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const GENDER_LABELS: Record<string, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
  unisex: "Unisex",
};

const AROMA_LABELS: Record<Aroma, string> = {
  dulce: "Dulce",
  fresco: "Fresco",
  citrico: "Cítrico",
  amaderado: "Amaderado",
  ambar: "Ámbar",
  vainilla: "Vainilla",
  floral: "Floral",
};

const SEASON_LABELS: Record<Season, string> = {
  verano: "Verano",
  invierno: "Invierno",
  primavera: "Primavera",
  otono: "Otoño",
  "todo-el-ano": "Todo el año",
};

const OCCASION_LABELS: Record<Occasion, string> = {
  oficina: "Oficina",
  noche: "Noche",
  citas: "Citas",
  diario: "Diario",
  fiesta: "Fiesta",
};

interface PerfumePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(
  props: PerfumePageProps
): Promise<Metadata> {
  const { slug } = await props.params;
  const perfume = await getPerfumeBySlug(slug);
  if (!perfume) return {};
  return {
    title: `${perfume.name} — ${perfume.brand.name}`,
    description: perfume.description.slice(0, 155),
  };
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] text-muted sm:px-3.5 sm:py-1 sm:text-sm">
      {label}
    </span>
  );
}

export default async function PerfumePage(props: PerfumePageProps) {
  const { slug } = await props.params;
  const perfume = await getPerfumeBySlug(slug);
  if (!perfume) notFound();

  const related = await getRelated(perfume, 4);
  const basePrice = perfume.prices["50"] ?? perfume.prices["100"] ?? perfume.prices["30"];

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <nav className="text-[11px] text-faint sm:text-xs" aria-label="Migas de pan">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="transition-colors hover:text-white">
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/perfumes" className="transition-colors hover:text-white">
              Perfumes
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/perfumes?marca=${perfume.brand.slug}`}
              className="transition-colors hover:text-white"
            >
              {perfume.brand.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-white">{perfume.name}</li>
        </ol>
      </nav>

      <div className="mt-4 grid gap-5 sm:mt-6 sm:gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery slug={perfume.slug} name={perfume.name} />

        <div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Link
              href={`/perfumes?marca=${perfume.brand.slug}`}
              className="text-[11px] uppercase tracking-widest text-faint transition-colors hover:text-white sm:text-xs"
            >
              {perfume.brand.name}
            </Link>
            {perfume.bestSeller && (
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black sm:px-2.5 sm:text-[11px]">
                Más vendido
              </span>
            )}
            {perfume.isNew && (
              <span className="rounded-full border border-white/30 px-2 py-0.5 text-[10px] font-semibold text-white sm:px-2.5 sm:text-[11px]">
                Nuevo
              </span>
            )}
          </div>

          <h1 className="mt-2 font-serif text-2xl text-white sm:mt-3 sm:text-3xl lg:text-5xl">
            {perfume.name}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted sm:mt-3 sm:text-sm">
            <span className="flex items-center gap-1.5">
              <Stars value={perfume.rating} />
              <span className="font-semibold text-white">
                {perfume.rating.toFixed(1)}
              </span>
            </span>
            <span className="h-4 w-px bg-line" />
            <span>{perfume.reviewCount} reseñas</span>
          </div>

          {basePrice !== null && (
            <p className="mt-3 font-serif text-xl text-white sm:mt-5 sm:text-2xl lg:text-3xl">
              {formatARS(basePrice)}
            </p>
          )}

          <div className="mt-4 sm:mt-5">
            <AddToCart
              slug={perfume.slug}
              name={perfume.name}
              brandName={perfume.brand.name}
              image={perfume.image}
              prices={perfume.prices}
              stock={perfume.stock}
            />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-muted sm:mt-5 sm:text-base">
            {perfume.description}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3">
            <div className="rounded-2xl border border-line bg-surface p-2.5 sm:p-5">
              <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
                Ideal para
              </p>
              <p className="mt-1 text-xs text-white sm:mt-2 sm:text-sm">
                {GENDER_LABELS[perfume.gender]}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-2.5 sm:p-5">
              <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
                Estación
              </p>
              <p className="mt-1 text-xs text-white sm:mt-2 sm:text-sm">
                {perfume.seasons.map((s) => SEASON_LABELS[s]).join(", ")}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-2.5 sm:p-5">
              <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
                Ocasión
              </p>
              <p className="mt-1 text-xs text-white sm:mt-2 sm:text-sm">
                {perfume.occasions.map((o) => OCCASION_LABELS[o]).join(", ")}
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-2.5 sm:p-5">
              <p className="text-[10px] uppercase tracking-widest text-faint sm:text-xs">
                Inspirado en
              </p>
              <p className="mt-1 text-xs text-white sm:mt-2 sm:text-sm">
                {perfume.inspiredBy ?? "Composición original"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* PIRÁMIDE OLFATIVA */}
      <section className="mt-8 sm:mt-12 lg:mt-20">
        <h2 className="font-serif text-lg text-white sm:text-xl lg:text-3xl">
          Pirámide olfativa
        </h2>
        <div className="mt-4 grid gap-2.5 sm:mt-6 sm:gap-4 md:grid-cols-3">
          {[
            { title: "Salida", notes: perfume.notes.top },
            { title: "Corazón", notes: perfume.notes.heart },
            { title: "Fondo", notes: perfume.notes.base },
          ].map((layer, index) => (
            <div
              key={layer.title}
              className={`rounded-2xl border border-line p-4 sm:p-6 ${
                index === 2
                  ? "bg-surface-2"
                  : index === 1
                    ? "bg-surface"
                    : "bg-surface"
              }`}
            >
              <p className="text-[11px] uppercase tracking-widest text-faint sm:text-xs">
                {layer.title}
              </p>
              <ul className="mt-2 space-y-1 sm:mt-3 sm:space-y-1.5">
                {layer.notes.map((note) => (
                  <li key={note} className="text-xs text-white sm:text-sm">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* DURACIÓN Y PROYECCIÓN */}
      <section className="mt-6 rounded-2xl border border-line bg-surface p-3 sm:mt-10 sm:p-5 lg:mt-16 lg:p-8">
        <h2 className="font-serif text-lg text-white sm:text-xl lg:text-2xl">Rendimiento</h2>
        <div className="mt-3 flex flex-col gap-3 sm:mt-5 sm:gap-4">
          <Meter value={perfume.duration} label="Duración" />
          <Meter value={perfume.projection} label="Proyección" />
          <Meter value={perfume.sweetness} label="Dulzor" />
        </div>
        <div className="mt-3 flex flex-wrap gap-1 sm:mt-5 sm:gap-1.5">
          <Badge label={`Aroma: ${perfume.aromas.map((a) => AROMA_LABELS[a]).join(", ")}`} />
          <Badge label={`Género: ${GENDER_LABELS[perfume.gender]}`} />
          <Badge label={`Estación: ${perfume.seasons.map((s) => SEASON_LABELS[s]).join(", ")}`} />
          <Badge label={`Ocasión: ${perfume.occasions.map((o) => OCCASION_LABELS[o]).join(", ")}`} />
        </div>
      </section>

      {/* RELACIONADOS */}
      {related.length > 0 && (
        <section className="mt-8 sm:mt-12 lg:mt-20">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-serif text-lg text-white sm:text-xl lg:text-3xl">
              Productos relacionados
            </h2>
            <Link
              href={`/perfumes?aroma=${perfume.aromas[0] ?? ""}`}
              className="group hidden items-center gap-2 text-sm text-muted transition-colors hover:text-white sm:flex"
            >
              Ver más
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:mt-6 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {related.map((perfume) => (
              <ProductCard key={perfume.id} perfume={perfume} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
