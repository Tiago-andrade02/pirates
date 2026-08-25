"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatARS } from "@/lib/format";

interface RecommendedPerfume {
  slug: string;
  name: string;
  image: string;
  price: number | null;
  brand: string;
}

interface Answers {
  aromas: string[];
  occasions: string[];
  intensity: string;
  budget: string;
}

const STEPS = [
  {
    question: "¿Qué tipo de aroma te gusta?",
    hint: "Podés elegir más de uno",
    multi: true,
    options: [
      { value: "dulce", label: "Dulce", icon: "\uD83C\uDF6D" },
      { value: "fresco", label: "Fresco", icon: "\uD83C\uDF39" },
      { value: "citrico", label: "Cítrico", icon: "\uD83C\uDF4B" },
      { value: "amaderado", label: "Amaderado", icon: "\uD83E\uDE93" },
      { value: "vainilla", label: "Vainilla", icon: "\uD83C\uDF6E" },
      { value: "floral", label: "Floral", icon: "\uD83C\uDF38" },
      { value: "ambar", label: "Ámbar", icon: "\uD83D\uDD2E" },
    ],
  },
  {
    question: "¿Para qué ocasión lo buscás?",
    hint: "Elegí la más importante",
    multi: false,
    options: [
      { value: "diario", label: "Uso diario", icon: "\u2600\uFE0F" },
      { value: "oficina", label: "Oficina", icon: "\uD83C\uDFE2" },
      { value: "citas", label: "Citas", icon: "\u2764\uFE0F" },
      { value: "noche", label: "Salidas / Noche", icon: "\uD83C\uDF19" },
      { value: "fiesta", label: "Fiesta", icon: "\uD83E\uDD73" },
    ],
  },
  {
    question: "¿Qué intensidad preferís?",
    hint: null,
    multi: false,
    options: [
      { value: "suave", label: "Suave y sutil", icon: "\uD83C\uDF43" },
      { value: "moderada", label: "Moderada", icon: "\uD83C\uDF41" },
      { value: "intensa", label: "Intensa y duradera", icon: "\uD83D\uDD25" },
    ],
  },
  {
    question: "¿Cuál es tu presupuesto?",
    hint: "Por la fragancia de 50ml",
    multi: false,
    options: [
      { value: "bajo", label: "Hasta $40.000", icon: "\uD83D\uDCB0" },
      { value: "medio", label: "$40.000 – $60.000", icon: "\uD83D\uDCB5" },
      { value: "alto", label: "Más de $60.000", icon: "\uD83D\uDC8E" },
    ],
  },
] as const;

function RecommendationCard({ p }: { p: RecommendedPerfume }) {
  return (
    <Link
      href={`/perfumes/${p.slug}`}
      className="mi-card flex flex-col overflow-hidden rounded-xl border border-line bg-surface"
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-surface-2 to-background">
        <Image
          src={p.image}
          alt={p.name}
          fill
          sizes="150px"
          className="object-contain transition-transform duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-[10px] uppercase tracking-wider text-faint">{p.brand}</p>
        <p className="mt-1 text-sm font-semibold text-white leading-tight line-clamp-2">{p.name}</p>
        {p.price !== null && (
          <p className="mt-auto pt-2 text-sm font-bold text-gold">{formatARS(p.price)}</p>
        )}
      </div>
    </Link>
  );
}

export function PerfumeAssistant() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    aromas: [],
    occasions: [],
    intensity: "",
    budget: "",
  });
  const [results, setResults] = useState<RecommendedPerfume[]>([]);
  const [loading, setLoading] = useState(false);

  const totalSteps = STEPS.length;
  const isLastStep = step === totalSteps;

  function toggleMulti(value: string) {
    setAnswers((prev) => {
      const has = prev.aromas.includes(value);
      return {
        ...prev,
        aromas: has ? prev.aromas.filter((a) => a !== value) : [...prev.aromas, value],
      };
    });
  }

  function selectSingle(field: "occasions" | "intensity" | "budget", value: string) {
    setAnswers((prev) => ({ ...prev, [field]: [value] }));
  }

  function canAdvance(): boolean {
    if (step === 0) return answers.aromas.length > 0;
    if (step === 1) return answers.occasions.length > 0;
    if (step === 2) return answers.intensity.length > 0;
    if (step === 3) return answers.budget.length > 0;
    return false;
  }

  async function fetchResults() {
    setLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aromas: answers.aromas,
          occasions: answers.occasions,
          intensity: answers.intensity,
          budget: answers.budget,
        }),
      });
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleNext() {
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      fetchResults();
      setStep(totalSteps);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function handleRestart() {
    setStep(0);
    setAnswers({ aromas: [], occasions: [], intensity: "", budget: "" });
    setResults([]);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setStep(0);
      setAnswers({ aromas: [], occasions: [], intensity: "", budget: "" });
      setResults([]);
    }, 300);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const current = step < totalSteps ? STEPS[step] : null;

  function renderOption(opt: { value: string; label: string; icon: string }) {
    const selected =
      (step === 0 && answers.aromas.includes(opt.value)) ||
      (step === 1 && answers.occasions.includes(opt.value)) ||
      (step === 2 && answers.intensity === opt.value) ||
      (step === 3 && answers.budget === opt.value);

    return (
      <button
        key={opt.value}
        type="button"
        onClick={() => {
          if (step === 0) toggleMulti(opt.value);
          else if (step === 1) selectSingle("occasions", opt.value);
          else if (step === 2) selectSingle("intensity", opt.value);
          else if (step === 3) selectSingle("budget", opt.value);
        }}
        className={`mi-chip flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all ${
          selected
            ? "border-white bg-white/10 text-white"
            : "border-line bg-surface text-muted hover:border-white/30 hover:text-white"
        }`}
      >
        <span className="text-lg">{opt.icon}</span>
        {opt.label}
      </button>
    );
  }

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-2 rounded-full border border-gold/30 bg-surface px-4 py-3 text-sm font-semibold text-gold shadow-lg transition-all hover:border-gold/60 hover:bg-surface-2 hover:shadow-gold/10 sm:bottom-8 sm:left-8 sm:px-5 sm:text-base"
      >
        <span className="text-lg">&#x2728;</span>
        <span className="hidden sm:inline">Encontrá tu perfume ideal</span>
        <span className="sm:hidden">Tu perfume</span>
      </button>

      {/* MODAL OVERLAY */}
      {open && (
        <div
          className="animate-fade-in fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={handleClose}
        >
          <div
            className="animate-slide-up relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-background sm:rounded-2xl sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="font-serif text-lg text-white">&#x2728; Asesor de perfumes</h3>
              <button
                type="button"
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-white"
              >
                &#x2715;
              </button>
            </div>

            {/* PROGRESS BAR */}
            {!isLastStep && (
              <div className="h-0.5 bg-surface">
                <div
                  className="h-full bg-gold transition-all duration-500"
                  style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                />
              </div>
            )}

            {/* BODY */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {isLastStep ? (
                /* RESULTS */
                loading ? (
                  <div className="flex flex-col items-center gap-4 py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-faint border-t-gold" />
                    <p className="text-sm text-muted">Buscando las mejores opciones para vos...</p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      Estos son los perfumes que mejor se adaptan a lo que buscás:
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {results.map((p) => (
                        <RecommendationCard key={p.slug} p={p} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 py-10 text-center">
                    <p className="text-2xl">&#x1F50D;</p>
                    <p className="text-sm text-muted">
                      No encontramos resultados exactos. Intentá con otras preferencias.
                    </p>
                  </div>
                )
              ) : current ? (
                /* QUESTIONS */
                <div className="space-y-4 animate-fade-in" key={step}>
                  <div>
                    <p className="text-base font-semibold text-white">{current.question}</p>
                    {current.hint && (
                      <p className="mt-1 text-xs text-faint">{current.hint}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {current.options.map(renderOption)}
                  </div>
                </div>
              ) : null}
            </div>

            {/* FOOTER */}
            <div className="border-t border-line px-5 py-4">
              {isLastStep ? (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRestart}
                    className="mi-btn flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-white"
                  >
                    Empezar de nuevo
                  </button>
                  <Link
                    href="/perfumes"
                    onClick={handleClose}
                    className="mi-btn mi-shine flex-1 inline-flex items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-black"
                  >
                    Ver catálogo completo
                  </Link>
                </div>
              ) : (
                <div className="flex gap-3">
                  {step > 0 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="mi-btn rounded-full border border-line bg-surface px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-white"
                    >
                      Atrás
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canAdvance()}
                    className="mi-btn mi-shine flex-1 rounded-full bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {step === totalSteps - 1 ? "Encontrar mi perfume" : "Continuar"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
