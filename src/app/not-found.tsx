import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-faint">Error 404</p>
      <h1 className="mt-3 font-serif text-5xl text-white">
        Perfume no encontrado
      </h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
        La página que buscás no existe o fue movida. Volvé al catálogo para
        seguir explorando.
      </p>
      <Link
        href="/perfumes"
        className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
      >
        Ir al catálogo
      </Link>
    </div>
  );
}
