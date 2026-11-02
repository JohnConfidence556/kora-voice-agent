"use client";

import { ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import VoiceCall from "@/components/VoiceCall";

// Edit these if you change the models in backend/config.py
const PIPELINE = [
  { title: "Your voice", text: "Speech is turned into text with Whisper on Groq." },
  { title: "The answer", text: "A Llama model reads the text, looks up plan data and your account, and writes a reply." },
  { title: "Its voice", text: "The reply is spoken back with Orpheus text-to-speech on Groq." },
];

export default function Call() {
  return (
    <>
      <PageHeader
        title="Voice call"
        subtitle="Talk to the assistant like a support line. It can see your account and answer plan questions."
      />
      <div className="callLayout">
        <VoiceCall />
        <aside className="sideInfo">
          <section>
            <h2 className="sideInfo__title">How a call works</h2>
            <ol className="flow">
              {PIPELINE.map((s) => (
                <li key={s.title}>
                  <strong>{s.title}</strong>
                  <span>{s.text}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="sideInfo__safe">
            <h2 className="sideInfo__title"><ShieldCheck size={18} />You stay in control</h2>
            <p>
              The assistant can prepare a purchase but can&apos;t pay for it. If it prepares one during your call,
              a confirmation bar appears at the top of the page.
            </p>
            <p>It only reads the account you are signed in to.</p>
          </section>
        </aside>
      </div>
    </>
  );
}
