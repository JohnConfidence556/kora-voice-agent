"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useAccountState } from "@/lib/account";
import { naira, parseDbTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";
import type { Order } from "@/lib/api";

function headline(o: Order): string {
  return o.kind === "airtime" ? `Top up ${naira(o.amount_naira)} airtime` : `${o.description} for ${naira(o.amount_naira)}`;
}

// Orders the AI assistant prepared. Only the user can turn them into a purchase.
export default function PendingOrders() {
  const { pending, confirmOrder, cancelOrder } = useAccountState();
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow(15_000);

  if (pending.length === 0) return null;

  async function run(id: string, action: (id: string) => Promise<void>) {
    setBusy(id);
    await action(id);
    setBusy(null);
  }

  return (
    <section className="pending" aria-label="Orders waiting for your confirmation">
      {pending.map((o) => {
        const minutes = now
          ? Math.max(0, Math.ceil((parseDbTime(o.expires_at).getTime() - now.getTime()) / 60_000))
          : null;
        return (
          <div className="pending__row" key={o.id}>
            <span className="pending__icon"><ShieldCheck size={20} /></span>
            <div className="pending__text">
              <strong>{headline(o)}</strong>
              <span>
                The assistant prepared this order. Nothing is charged until you confirm.
                {minutes !== null && ` Expires in ${minutes} min.`}
              </span>
            </div>
            <div className="pending__actions">
              <button className="btn btn--primary btn--sm" disabled={busy === o.id} onClick={() => run(o.id, confirmOrder)}>
                {busy === o.id ? "Working..." : "Confirm"}
              </button>
              <button className="btn btn--ghost btn--sm" disabled={busy === o.id} onClick={() => run(o.id, cancelOrder)}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
