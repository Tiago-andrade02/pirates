"use client";

import { useSearchParams } from "next/navigation";
import { login } from "@/app/admin/actions";
import { LogoutIcon } from "@/components/icons";

export function AdminLogin() {
  const params = useSearchParams();
  const error = params.get("error") === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/logo.png"
            alt="PIRATES"
            className="mx-auto h-14 w-auto object-contain"
          />
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-faint">
            Panel de gestión
          </p>
        </div>
        <form
          action={login}
          className="rounded-2xl border border-line bg-surface p-8"
        >
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted">
            Contraseña
          </label>
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="••••••••"
            className="mt-2 w-full rounded-xl border border-line bg-background px-4 py-3 text-white placeholder:text-faint focus:border-gold focus:outline-none"
          />
          {error && (
            <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              Contraseña incorrecta. Intentá de nuevo.
            </p>
          )}
          <button
            type="submit"
            className="mt-6 w-full rounded-xl bg-gold px-4 py-3 font-semibold text-black transition hover:bg-gold/90"
          >
            Ingresar
          </button>
        </form>
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-faint">
          <LogoutIcon className="h-3 w-3" />
          <span>Los cambios se guardan al instante</span>
        </div>
      </div>
    </div>
  );
}
