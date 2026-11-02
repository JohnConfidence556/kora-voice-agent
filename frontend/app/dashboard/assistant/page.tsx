"use client";

import { CircleCheck, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ChatPanel from "@/components/ChatPanel";

const CAN = [
  "Answer questions about MTN plans, prices and codes from the saved plan pages",
  "Read your balances, plan and recent activity",
  "Prepare a data or airtime purchase for you to confirm",
];

export default function Assistant() {
  return (
    <>
      <PageHeader title="Assistant" subtitle="Ask about plans, check your balance, or request a recharge." />
      <div className="chatLayout">
        <ChatPanel />
        <aside className="sideInfo">
          <section>
            <h2 className="sideInfo__title">What it can do</h2>
            <ul className="ticks">
              {CAN.map((c) => (
                <li key={c}><CircleCheck size={18} />{c}</li>
              ))}
            </ul>
          </section>
          <section className="sideInfo__safe">
            <h2 className="sideInfo__title"><ShieldCheck size={18} />You stay in control</h2>
            <p>
              The assistant can prepare an order but can&apos;t pay for it. Orders it prepares appear at the top
              of the page until you press Confirm.
            </p>
            <p>If it can&apos;t find a reliable answer, it says so and points you to MTN&apos;s support line.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
