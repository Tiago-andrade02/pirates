"use client";

import { useState } from "react";
import {
  interpretSmtpResponse,
  interpretSmtpNetworkError,
  type SmtpUiResult,
} from "@/lib/smtp-diagnostic-client";

// Boton de diagnostico SMTP. Hace POST a /api/admin/smtp-diagnostics usando la
// sesion de administrador (la cookie httpOnly viaja sola en el fetch mismo
// origen, no hace falta pasarla a mano).
//
// NO envia ningun correo: el endpoint solo verifica la conexion. NO toca
// pedidos, stock ni pagos.
//
// El texto que se muestra sale de smtp-diagnostic-client.ts, nunca del cuerpo
// crudo de la respuesta.

const TONE_CLASSES: Record<SmtpUiResult["tone"], string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  error: "border-red-500/40 bg-red-500/10 text-red-200",
  neutral: "border-line bg-background text-muted",
};

export function SmtpTestButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SmtpUiResult | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/smtp-diagnostics", {
        method: "POST",
        headers: { Accept: "application/json" },
        // Sin credenciales explicitas: mismo origen, la cookie httpOnly de
        // administrador viaja automaticamente.
      });

      // El endpoint puede responder 200/401/502/503. El body se parsea con
      // tolerancia: si no es JSON valido se trata como respuesta inesperada.
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      setResult(interpretSmtpResponse(res.status, body));
    } catch {
      // Sin status HTTP: fallo de red, servidor caido o peticion abortada.
      setResult(interpretSmtpNetworkError());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={run}
        disabled={running}
        aria-busy={running}
        className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-white transition hover:border-gold/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "Probando conexión…" : "Probar conexión SMTP"}
      </button>

      {running && (
        <p className="text-xs text-muted" role="status">
          Verificando conexión y credenciales. Puede tardar unos segundos.
        </p>
      )}

      {!running && result && (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${TONE_CLASSES[result.tone]}`}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}
