"use client";

import { updateOrderStatus } from "@/app/admin/actions";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/lib/types";

export function StatusSelect({
  id,
  current,
}: {
  id: number;
  current: OrderStatus;
}) {
  return (
    <form action={updateOrderStatus}>
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={current}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-line bg-background px-2 py-1.5 text-xs font-semibold text-white focus:border-gold focus:outline-none"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
