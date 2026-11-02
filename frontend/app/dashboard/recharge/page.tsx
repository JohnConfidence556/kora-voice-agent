"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import ReviewModal from "@/components/ReviewModal";
import { CatalogItem } from "@/lib/api";
import { useAccount } from "@/lib/account";
import { useNow } from "@/lib/useNow";
import { formatData, naira, parsePlanExpiry } from "@/lib/format";

// Keep these in step with backend/catalog.py
const AIRTIME_MIN = 50;
const AIRTIME_MAX = 5000;
const PRESETS = [100, 200, 500, 1000, 2000];
const GROUPS = [
  { days: 1, label: "Daily" },
  { days: 2, label: "2-day" },
  { days: 7, label: "Weekly" },
  { days: 30, label: "Monthly" },
];

type Review = { type: "data"; plan: CatalogItem } | { type: "airtime"; amount: number };

export default function Recharge() {
  const { profile, catalog, buy } = useAccount();
  const now = useNow(60_000);
  const [group, setGroup] = useState(7);
  const [amountText, setAmountText] = useState("500");
  const [review, setReview] = useState<Review | null>(null);

  const amount = Number(amountText);
  const amountValid = Number.isInteger(amount) && amount >= AIRTIME_MIN && amount <= AIRTIME_MAX;
  const expiry = parsePlanExpiry(profile.plan_expires_at);
  const planIsActive = Boolean(expiry && now && expiry.getTime() > now.getTime());
  const visible = catalog.filter((p) => p.validity_days === group);

  function modal() {
    if (!review) return null;
    if (review.type === "data") {
      const p = review.plan;
      return (
        <ReviewModal
          title="Review your purchase"
          lines={[
            { label: "Plan", value: p.name },
            { label: "Data added", value: formatData(p.data_mb) },
            { label: "Valid for", value: `${p.validity_days} day${p.validity_days > 1 ? "s" : ""}` },
            { label: "Paid from", value: "Airtime balance" },
          ]}
          total={{ label: "Price", value: naira(p.price) }}
          note={`Airtime after purchase: ${naira(profile.airtime_naira - p.price)}`}
          confirmLabel={`Pay ${naira(p.price)}`}
          successTitle="Plan bought"
          successText={`${formatData(p.data_mb)} was added to your data balance and ${p.name} is now your active plan.`}
          onConfirm={async () => { await buy({ kind: "data", item_id: p.id }); }}
          onClose={() => setReview(null)}
        />
      );
    }
    return (
      <ReviewModal
        title="Review your top-up"
        lines={[
          { label: "Top-up", value: "Airtime" },
          { label: "Payment", value: "Simulated" },
        ]}
        total={{ label: "Amount", value: naira(review.amount) }}
        note={`Airtime after top-up: ${naira(profile.airtime_naira + review.amount)}`}
        confirmLabel={`Add ${naira(review.amount)}`}
        successTitle="Airtime added"
        successText={`${naira(review.amount)} was added to your balance.`}
        onConfirm={async () => { await buy({ kind: "airtime", amount: review.amount }); }}
        onClose={() => setReview(null)}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Plans and recharge"
        subtitle="Top up airtime, or spend it on a data plan. Payments are simulated."
      >
        <span className="balanceChip">Airtime <b className="num">{naira(profile.airtime_naira)}</b></span>
      </PageHeader>

      <section className="panel" aria-labelledby="airtime-title">
        <h2 id="airtime-title" className="panel__title">Top up airtime</h2>
        <p className="panel__sub">Choose an amount between {naira(AIRTIME_MIN)} and {naira(AIRTIME_MAX)}.</p>

        <div className="amounts" role="group" aria-label="Quick amounts">
          {PRESETS.map((a) => (
            <button
              key={a}
              className="amount"
              aria-pressed={amount === a}
              onClick={() => setAmountText(String(a))}
            >
              {naira(a)}
            </button>
          ))}
        </div>

        <div className="customAmount">
          <label className="field">
            <span className="field__label">Or enter an amount</span>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={AIRTIME_MIN}
              max={AIRTIME_MAX}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              aria-invalid={!amountValid}
              aria-describedby="amount-help"
            />
          </label>
          <button
            className="btn btn--primary btn--lg"
            disabled={!amountValid}
            onClick={() => setReview({ type: "airtime", amount })}
          >
            Review top-up
          </button>
        </div>
        {!amountValid && (
          <p id="amount-help" className="panel__error">
            Enter a whole number from {AIRTIME_MIN} to {AIRTIME_MAX}.
          </p>
        )}
      </section>

      <section id="data-bundles" className="dataSection" aria-labelledby="data-title">
        <div className="dataSection__head">
          <div>
            <h2 id="data-title" className="panel__title">Data plans</h2>
            <p className="panel__sub">Paid from your airtime balance. Prices from MTN Nigeria&apos;s public plan page.</p>
          </div>
          <div className="seg" role="tablist" aria-label="Plan length">
            {GROUPS.map((g) => (
              <button
                key={g.days}
                role="tab"
                className="seg__btn"
                aria-selected={group === g.days}
                onClick={() => setGroup(g.days)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {catalog.length === 0 ? (
          <div className="skel" style={{ height: 220, marginTop: 16 }} />
        ) : (
          <ul className="plans">
            {visible.map((p) => {
              const affordable = profile.airtime_naira >= p.price;
              const current = planIsActive && profile.plan_name === p.name;
              return (
                <li className="plan" key={p.id}>
                  <span className="plan__size num">{formatData(p.data_mb)}</span>
                  <span className="plan__info">
                    <strong>{p.name}</strong>
                    <span>Valid {p.validity_days} day{p.validity_days > 1 ? "s" : ""}</span>
                  </span>
                  <span className="plan__price num">{naira(p.price)}</span>
                  <span className="plan__action">
                    {current && <span className="tag tag--aqua">Current plan</span>}
                    <button
                      className="btn btn--primary btn--sm"
                      disabled={!affordable}
                      onClick={() => setReview({ type: "data", plan: p })}
                    >
                      Buy
                    </button>
                  </span>
                  {!affordable && (
                    <span className="plan__need">
                      Needs {naira(p.price - profile.airtime_naira)} more airtime
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modal()}
    </>
  );
}
