import Link from "next/link";

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="text-sm text-faint transition-colors hover:text-white"
      >
        ← Volver al inicio
      </Link>
      <h1 className="mt-4 font-serif text-4xl text-white sm:text-5xl">
        {title}
      </h1>
      <p className="mt-2 text-xs text-faint">Última actualización: {updated}</p>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-serif text-2xl text-white">
              {section.heading}
            </h2>
            {section.paragraphs?.map((paragraph, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-muted">
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-muted"
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
