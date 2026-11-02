"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, SendHorizontal } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { api, ApiError, clearToken } from "@/lib/api";
import { useAccountState } from "@/lib/account";
import { BRAND } from "@/lib/brand";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

const STORAGE_KEY = "kora_chat_v1";

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi, I'm the Kora assistant. I can answer questions about MTN plans, check your balance, and prepare a data or airtime purchase for you to confirm.",
};

const SUGGESTIONS = [
  "What's my balance?",
  "How much is the 1GB weekly plan?",
  "Which plans last a month?",
  "Buy me the 1GB weekly plan",
  "Top up 500 naira airtime",
  "How do I switch to MTN X?",
];

function loadSaved(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
      .slice(-40);
  } catch {
    return [];
  }
}

export default function ChatPanel() {
  const router = useRouter();
  const { refresh } = useAccountState();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the conversation while moving between pages (it clears when the tab closes)
  useEffect(() => {
    setMessages(loadSaved());
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch {}
  }, [messages, loaded]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || sending) return;

    const next: Msg[] = [...messages, { role: "user", content: clean }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const history = next.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
      const data = await api<{ reply: string }>("/chat", {
        method: "POST",
        body: JSON.stringify({ messages: history }),
      });
      setMessages([...next, { role: "assistant", content: data.reply }]);
      refresh(); // an order may have been prepared: show it in the banner right away
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages([...next, { role: "assistant", content: `I couldn't answer that. ${msg}`, error: true }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const all = [GREETING, ...messages];

  return (
    <section className="chat" aria-label={`Chat with ${BRAND.assistantName}`}>
      <header className="chat__head">
        <span className="chat__avatar"><LogoMark size={22} /></span>
        <span className="chat__who">
          <strong>{BRAND.assistantName}</strong>
          <span><i className="chat__dot" />Online</span>
        </span>
        <button
          className="btn btn--ghost btn--sm"
          onClick={() => { setMessages([]); setInput(""); }}
          disabled={messages.length === 0 || sending}
        >
          <RotateCcw size={15} />
          New chat
        </button>
      </header>

      <div className="chat__list" ref={listRef} aria-live="polite">
        {all.map((m, i) => (
          <div key={i} className={`msg msg--${m.role}${m.error ? " msg--error" : ""}`}>
            {m.role === "assistant" && <span className="msg__avatar"><LogoMark size={16} /></span>}
            <p className="msg__bubble">{m.content}</p>
          </div>
        ))}
        {sending && (
          <div className="msg msg--assistant" aria-label="The assistant is typing">
            <span className="msg__avatar"><LogoMark size={16} /></span>
            <p className="msg__bubble msg__bubble--typing"><i /><i /><i /></p>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="chat__suggest" aria-label="Suggested questions">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)} disabled={sending}>{s}</button>
          ))}
        </div>
      )}

      <form className="chat__form" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a plan, or say what you'd like to buy"
          aria-label="Message"
          maxLength={500}
          autoComplete="off"
        />
        <button className="btn btn--primary" type="submit" disabled={sending || !input.trim()} aria-label="Send message">
          <SendHorizontal size={18} />
          Send
        </button>
      </form>
    </section>
  );
}
