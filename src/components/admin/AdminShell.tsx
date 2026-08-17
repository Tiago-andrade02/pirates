"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/admin/actions";
import {
  DashboardIcon,
  BottleIcon,
  TruckIcon,
  UsersIcon,
  BoxIcon,
  BoxesIcon,
  WalletIcon,
  ChartIcon,
  StoreIcon,
  LogoutIcon,
} from "@/components/icons";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/productos", label: "Productos", icon: BottleIcon },
  { href: "/admin/pedidos", label: "Pedidos", icon: TruckIcon },
  { href: "/admin/clientes", label: "Clientes", icon: UsersIcon },
  { href: "/admin/mayorista", label: "Mayorista", icon: BoxIcon },
  { href: "/admin/stock", label: "Stock", icon: BoxesIcon },
  { href: "/admin/caja", label: "Caja", icon: WalletIcon },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: ChartIcon },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface/60 backdrop-blur lg:flex">
        <Link
          href="/admin"
          className="flex items-center gap-3 border-b border-line px-6 py-5"
        >
          <img src="/logo.png" alt="PIRATES" className="h-8 w-auto object-contain" />
          <span className="ml-auto rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">
            Panel
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-gold/15 font-semibold text-gold"
                    : "text-muted hover:bg-line/40 hover:text-white"
                }`}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-line/40 hover:text-white"
          >
            <StoreIcon className="h-4.5 w-4.5" />
            Ver tienda
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition hover:bg-red-500/10 hover:text-red-300"
            >
              <LogoutIcon className="h-4.5 w-4.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-line bg-background/80 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <img src="/logo.png" alt="PIRATES" className="h-8 w-auto object-contain" />
            <form action={logout} className="ml-auto">
              <button
                type="submit"
                aria-label="Cerrar sesión"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-line/40 hover:text-red-300"
              >
                <LogoutIcon className="h-4.5 w-4.5" />
              </button>
            </form>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs transition ${
                    active
                      ? "bg-gold/15 font-semibold text-gold"
                      : "text-muted hover:text-white"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
