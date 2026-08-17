"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CartIcon, CheckIcon, CloseIcon } from "@/components/icons";

function ResultContent() {
  const params = useSearchParams();
  const status = params.get("status");
  const code = params.get("external_reference");
  const { clear } = useCart();

  useEffect(() => {
    if (status === "success") clear();
  }, [status, clear]);

  const isSuccess = status === "success";
  const isPending = status === "pending" || status === "in_process";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full border ${
          isSuccess
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : isPending
              ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
              : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}
      >
        {isSuccess ? (
          <CheckIcon className="h-8 w-8" />
        ) : isPending ? (
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" />
        ) : (
          <CloseIcon className="h-8 w-8" />
        )}
      </div>

      <h1 className="mt-6 font-serif text-3xl text-white">
        {isSuccess
          ? "¡Pago aprobado!"
          : isPending
            ? "Pago en proceso"
            : "Pago no completado"}
      </h1>

      <p className="mt-3 text-sm leading-relaxed text-muted">
        {isSuccess
          ? "Recibimos tu pedido correctamente. Te contactaremos por WhatsApp para coordinar la entrega."
          : isPending
            ? "Estamos esperando la confirmación del pago. Te avisaremos por WhatsApp cuando esté aprobado."
            : "El pago no se completó. Podés reintentar el pedido o escribirnos por WhatsApp para asistirte."}
      </p>

      {code && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs text-faint">
            Código de pedido: <span className="font-semibold text-white">{code}</span>
          </p>
          <Link
            href={`/pedido/${encodeURIComponent(code)}`}
            className="text-xs font-medium text-gold hover:underline"
          >
            Ver estado y seguimiento del pedido
          </Link>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/perfumes"
          className="inline-flex h-12 items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
        >
          {isSuccess ? "Seguir explorando" : "Volver al catálogo"}
        </Link>
        {!isSuccess && (
          <Link
            href="/carrito"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line px-7 text-sm font-semibold text-white transition-colors hover:bg-surface"
          >
            <CartIcon className="h-4 w-4" />
            Ver carrito
          </Link>
        )}
      </div>
    </div>
  );
}

export default function ResultadoPage() {
  return (
    <Suspense>
      <ResultContent />
    </Suspense>
  );
}
