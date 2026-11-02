"use client";

import Link from "next/link";
import { Copy, MessageSquareText, Phone, TriangleAlert, Info } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ActivityRow from "@/components/ActivityRow";
import { LogoMark } from "@/components/Logo";
import { useAccount } from "@/lib/account";
import { useToast } from "@/lib/toast";
import { useNow } from "@/lib/useNow";
import {
  describeTimeLeft, formatData, formatExpiry, greeting, naira, parsePlanExpiry, timeLeft,
} from "@/lib/format";

type Nudge = { tone: "warn" | "info"; text: string; href: string; action: string };

export default function Overview() {
  const { profile, catalog, transactions } = useAccount();
  const toast = useToast();
  const now = useNow(60_000);

  const expiry = parsePlanExpiry(profile.plan_expires_at);
  const plan = catalog.find((p) => p.name === profile.plan_name);
  const left = expiry && now ? timeLeft(expiry, now) : null;
  const progress =
    left && plan ? (left.expired ? 0 : Math.min(1, left.ms / (plan.validity_days * 86_400_000))) : null;

  const nudges: Nudge[] = [];
  if (profile.airtime_naira < 300) {
    nudges.push({
      tone: "warn",
      text: `Your airtime is down to ${naira(profile.airtime_naira)}. Top up so you can buy a plan.`,
      href: "/dashboard/recharge", action: "Top up",
    });
  }
  if (left?.expired) {
    nudges.push({
      tone: "warn",
      text: `Your ${profile.plan_name} has expired.`,
      href: "/dashboard/recharge#data-bundles", action: "Buy a plan",
    });
  } else if (left && left.ms < 2 * 86_400_000) {
    nudges.push({
      tone: "warn",
      text: `Your ${profile.plan_name} ends soon: ${describeTimeLeft(left).toLowerCase()}.`,
      href: "/dashboard/recharge#data-bundles", action: "Renew",
    });
  } else if (!profile.plan_expires_at) {
    nudges.push({
      tone: "info",
      text: "You're on pay-as-you-go. A data plan gives you data at a lower cost per MB.",
      href: "/dashboard/recharge#data-bundles", action: "See plans",
    });
  }

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(profile.demo_number);
      toast("Number copied.", "success");
    } catch {
      toast("Couldn't copy. Select the number and copy it by hand.", "error");
    }
  }

  const active = profile.sim_status.toLowerCase() === "active";

  return (
    <>
      <PageHeader title={greeting(now)} subtitle="Here is your line at a glance." />

      <section className="sim" aria-label="Your SIM">
        <div className="sim__head">
          <span className="sim__brand"><LogoMark size={22} />Kora SIM</span>
          <span className={`status ${active ? "status--active" : "status--other"}`}>
            <i />{profile.sim_status}
          </span>
        </div>

        <button className="sim__number" onClick={copyNumber} aria-label={`Copy demo number ${profile.demo_number}`}>
          {profile.demo_number}
          <Copy size={16} />
        </button>
        <p className="sim__hint">Demo number</p>

        <dl className="sim__figures">
          <div>
            <dt>Airtime</dt>
            <dd className="num">{naira(profile.airtime_naira)}</dd>
          </div>
          <div>
            <dt>Data</dt>
            <dd className="num">{formatData(profile.data_mb)}</dd>
          </div>
          <div>
            <dt>Plan</dt>
            <dd className="sim__plan">
              {profile.plan_name}
              <span>
                {expiry ? (left?.expired ? "Expired" : `Ends ${formatExpiry(expiry)}`) : "No expiry"}
              </span>
            </dd>
          </div>
        </dl>

        {progress !== null && (
          <div
            className="meter"
            role="progressbar"
            aria-label="Plan time remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        )}

        <div className="sim__actions">
          <Link className="btn btn--light" href="/dashboard/recharge">Recharge airtime</Link>
          <Link className="btn btn--glass" href="/dashboard/recharge#data-bundles">Buy data</Link>
        </div>
      </section>

      {nudges.length > 0 && (
        <div className="nudges">
          {nudges.slice(0, 2).map((n) => (
            <p key={n.text} className={`nudge nudge--${n.tone}`}>
              {n.tone === "warn" ? <TriangleAlert size={18} /> : <Info size={18} />}
              <span>{n.text}</span>
              <Link className="nudge__link" href={n.href}>{n.action}</Link>
            </p>
          ))}
        </div>
      )}

      <div className="cols">
        <section>
          <div className="block__head">
            <h2 className="block__title">Recent activity</h2>
            <Link className="block__link" href="/dashboard/activity">See all</Link>
          </div>
          {transactions.length === 0 ? (
            <div className="empty">
              <p className="empty__title">No activity yet</p>
              <p>Top up airtime or buy a data plan and it shows up here.</p>
              <Link className="btn btn--primary btn--sm" href="/dashboard/recharge">Go to recharge</Link>
            </div>
          ) : (
            <ul className="acts">
              {transactions.slice(0, 5).map((t) => <ActivityRow key={t.id} tx={t} />)}
            </ul>
          )}
        </section>

        <div className="stack">
          <section>
            <div className="block__head"><h2 className="block__title">Need help?</h2></div>
            <div className="stack stack--tight">
              <Link className="helpTile" href="/dashboard/assistant">
                <span className="helpTile__icon"><MessageSquareText size={22} /></span>
                <span className="helpTile__text">
                  <strong>Chat with the assistant</strong>
                  <span>Plans, prices, balance, recharges</span>
                </span>
              </Link>
              <Link className="helpTile" href="/dashboard/call">
                <span className="helpTile__icon helpTile__icon--call"><Phone size={22} /></span>
                <span className="helpTile__text">
                  <strong>Call the assistant</strong>
                  <span>Talk it through, hands-free</span>
                </span>
              </Link>
            </div>
          </section>

          <section>
            <div className="block__head"><h2 className="block__title">Account details</h2></div>
            <dl className="details">
              <div><dt>Email</dt><dd>{profile.email}</dd></div>
              <div><dt>Demo number</dt><dd>{profile.demo_number}</dd></div>
              <div><dt>SIM status</dt><dd>{profile.sim_status}</dd></div>
              <div><dt>Active plan</dt><dd>{profile.plan_name}</dd></div>
              <div><dt>Plan ends</dt><dd>{expiry ? formatExpiry(expiry) : "No expiry"}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
