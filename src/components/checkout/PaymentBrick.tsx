"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale: string }
    ) => {
      bricks: () => {
        create: (
          type: "payment",
          container: string,
          config: Record<string, unknown>
        ) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

interface PaymentBrickProps {
  preferenceId: string;
  publicKey: string;
  externalReference: string;
  amount: number;
}

const SDK_URL = "https://sdk.mercadopago.com/js/v2?locale=es-AR";

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (window.MercadoPago) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago SDK"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function PaymentBrick({
  preferenceId,
  publicKey,
  externalReference,
  amount,
}: PaymentBrickProps) {
  const containerId = "payment-brick-container";
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { clear } = useCart();
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let brick: { unmount: () => void } | null = null;

    // Red de seguridad: que el loading nunca quede colgado si el Brick
    // espera una respuesta (onReady) que no llega.
    const SAFETY_TIMEOUT_MS = 20000;
    const safetyTimer = setTimeout(() => {
      if (!disposed) {
        setError(
          "El medio de pago tardó demasiado en cargar. Recargá la página e intentá de nuevo."
        );
        setLoading(false);
      }
    }, SAFETY_TIMEOUT_MS);

    const finish = () => {
      if (!disposed) setLoading(false);
    };

    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadSdk();
        if (!window.MercadoPago) throw new Error("Mercado Pago SDK no disponible");

        const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
        brick = await mp.bricks().create("payment", containerId, {
          initialization: {
            preferenceId,
            amount,
          },
          callbacks: {
            onReady: finish,
            onError: (err: unknown) => {
              if (disposed) return;
              const message =
                err instanceof Error ? err.message : "Error al procesar el pago";
              setError(message);
              setLoading(false);
            },
            onStatusChange: (status: { status?: string }) => {
              if (disposed) return;
              const st = status?.status;
              if (st === "approved") {
                clear();
                router.push(
                  `/checkout/resultado?status=success&external_reference=${encodeURIComponent(externalReference)}`
                );
              } else if (st === "pending" || st === "in_process") {
                clear();
                router.push(
                  `/checkout/resultado?status=in_process&external_reference=${encodeURIComponent(externalReference)}`
                );
              }
            },
          },
        });
        // create() resolvió: el Brick ya está montado, ocultamos el spinner.
        // onReady puede llegar después y es un respaldo.
        finish();
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "Error al cargar el pago");
          setLoading(false);
        }
      } finally {
        clearTimeout(safetyTimer);
      }
    })();

    return () => {
      disposed = true;
      clearTimeout(safetyTimer);
      brick?.unmount();
    };
  }, [preferenceId, publicKey, externalReference, amount, clear, router]);

  return (
    <div>
      {loading && (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface text-center text-sm text-muted">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          Cargando medio de pago…
        </div>
      )}

      {error && !loading && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300 sm:rounded-xl">
          {error}
        </p>
      )}

      <div
        id={containerId}
        ref={containerRef}
        className={`${loading || error ? "hidden" : ""}`}
      />
    </div>
  );
}