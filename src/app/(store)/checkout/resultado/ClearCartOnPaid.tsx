"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

interface ClearCartOnPaidProps {
  // Limpia el carrito solo con un pago aprobado verificado.
  clear: boolean;
  // Pide reconciliar un pago que MP aprueba pero que la base todavia no refleja
  // (webhook caido o demorado).
  confirm: boolean;
  orderCode: string;
  paymentId: string | null;
}

// Unico componente cliente de la pagina: el carrito vive en localStorage, asi
// que vaciarlo necesita correr en el navegador.
//
// La pagina (server component) ya verifico el pago contra Mercado Pago. Cuando
// el pago quedo aprobado pero el pedido todavia no figura finalizado en la base,
// se avisa a /api/mercadopago/confirm, que vuelve a consultar /v1/payments/{id}
// y revalida referencia, moneda e importe antes de finalizar. Este componente
// no tiene autoridad para marcar un pedido como pagado: solo solicita que se
// verifique.
export function ClearCartOnPaid({
  clear,
  confirm,
  orderCode,
  paymentId,
}: ClearCartOnPaidProps) {
  const { clear: clearCart } = useCart();
  const router = useRouter();

  useEffect(() => {
    if (clear) clearCart();
  }, [clear, clearCart]);

  useEffect(() => {
    if (!confirm || !orderCode || !paymentId) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/mercadopago/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: orderCode, paymentId }),
        });

        // 202 = Mercado Pago todavia no expone el pago. No es un fallo: la
        // pagina queda en "verificando" y el webhook sigue siendo la via
        // principal para ese caso.
        if (!res.ok && res.status !== 202) return;

        const data = (await res.json().catch(() => ({}))) as { finalized?: boolean };
        if (cancelled) return;
        // Recibe el estado real de la base antes de re-renderizar.
        if (data.finalized) router.refresh();
      } catch {
        /* el webhook sigue siendo la via de respaldo */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [confirm, orderCode, paymentId, router]);

  return null;
}
