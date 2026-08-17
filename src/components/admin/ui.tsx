import type { ReactNode } from "react";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/types";
import { formatARS } from "@/lib/format";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl text-white">{title}</h1>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-muted">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="text-xs uppercase tracking-widest text-faint">{label}</p>
      <p
        className={`mt-2 font-serif text-3xl ${
          accent ? "text-white" : "text-white"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const STATUS_STYLES: Record<OrderStatus, string> = {
  pendiente: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  pagado: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  preparando: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  enviado: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  entregado: "border-white/30 bg-white/10 text-white",
  cancelado: "border-red-500/40 bg-red-500/10 text-red-300",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-faint ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm ${className ?? ""}`}>{children}</td>
  );
}

export function Money({ value }: { value: number }) {
  return <span className="font-medium text-white">{formatARS(value)}</span>;
}

export function InfoBanner({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-muted">
      {text}
    </div>
  );
}
