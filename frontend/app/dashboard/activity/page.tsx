"use client";

import Link from "next/link";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import ActivityRow from "@/components/ActivityRow";
import { useAccount } from "@/lib/account";
import { useNow } from "@/lib/useNow";
import { formatDay, parseDbTime } from "@/lib/format";
import type { Transaction } from "@/lib/api";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "data_purchase", label: "Data" },
  { id: "airtime_purchase", label: "Airtime" },
  { id: "credit", label: "Credits" },
];

export default function Activity() {
  const { transactions } = useAccount();
  const now = useNow(60_000);
  const [filter, setFilter] = useState("all");

  const rows = transactions.filter((t) => filter === "all" || t.kind === filter);

  // Group by day, newest first (the API already sends newest first)
  const groups: { label: string; items: Transaction[] }[] = [];
  if (now) {
    for (const t of rows) {
      const label = formatDay(parseDbTime(t.created_at), now);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(t);
      else groups.push({ label, items: [t] });
    }
  }

  return (
    <>
      <PageHeader title="Activity" subtitle="Every top-up, purchase and credit on this line." />

      <div className="seg" role="tablist" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            className="seg__btn"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty empty--spaced">
          <p className="empty__title">{filter === "all" ? "No activity yet" : "Nothing here yet"}</p>
          <p>
            {filter === "all"
              ? "Top up airtime or buy a data plan and it shows up here."
              : "No transactions of this type yet. Try another filter."}
          </p>
          {filter === "all" && <Link className="btn btn--primary btn--sm" href="/dashboard/recharge">Go to recharge</Link>}
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="dayGroup">
            <h2 className="dayGroup__label">{g.label}</h2>
            <ul className="acts">
              {g.items.map((t) => <ActivityRow key={t.id} tx={t} />)}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
