"use client";

import type { ComponentProps } from "react";
import { BarVisualizer } from "@livekit/components-react";
import { Clock3, Headphones, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { BRAND } from "@/lib/brand";
import { mmss } from "@/lib/format";

type Viz = ComponentProps<typeof BarVisualizer>;

export type CallPhase = "idle" | "starting" | "ringing" | "connected" | "ended" | "error";
export type Caption = { id: string; who: "you" | "agent"; text: string };

type Props = {
  phase: CallPhase;
  agentState?: string;              // "listening" | "thinking" | "speaking" ...
  seconds: number;                  // call length so far
  limitSeconds: number;             // demo cap
  muted: boolean;
  agentTrack?: Viz["track"];
  micTrack?: Viz["track"];
  captions: Caption[];
  message?: string;                 // error text, or why the call ended
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onViewActivity: () => void;
};

const TRY = ["What's my airtime balance?", "How much is the 1GB weekly plan?", "Get me 500 naira airtime"];

function ConnBars({ level }: { level: number }) {
  return (
    <span className="conn" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <i key={i} data-on={i <= level} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

const BADGE: Record<CallPhase, { text: string; level: number }> = {
  idle: { text: "Not connected", level: 0 },
  starting: { text: "Connecting", level: 1 },
  ringing: { text: "Ringing", level: 2 },
  connected: { text: "Connected", level: 4 },
  ended: { text: "Call ended", level: 0 },
  error: { text: "Call failed", level: 0 },
};

function statusText(phase: CallPhase, agentState?: string): string {
  switch (phase) {
    case "idle": return "Ready when you are";
    case "starting": return "Setting up your call...";
    case "ringing": return "Ringing...";
    case "connected":
      if (agentState === "thinking") return "Thinking";
      if (agentState === "speaking") return "Speaking";
      return "Listening";
    case "ended": return "Call ended";
    case "error": return "Couldn't connect";
  }
}

export default function CallScreen(p: Props) {
  const live = p.phase === "starting" || p.phase === "ringing" || p.phase === "connected";
  const connected = p.phase === "connected";
  const agent = connected ? p.agentState ?? "listening" : "idle";
  const secondsLeft = p.limitSeconds - p.seconds;
  const badge = BADGE[p.phase];
  const recent = p.captions.slice(-3);

  return (
    <section
      className="call"
      data-phase={p.phase}
      data-agent={agent}
      aria-label={`Voice call with ${BRAND.assistantName}`}
    >
      <div className="call__top">
        <span className="call__badge"><ConnBars level={badge.level} />{badge.text}</span>
        {connected && secondsLeft <= 60 && (
          <span className="call__limit"><Clock3 size={14} />Ends in {mmss(secondsLeft)}</span>
        )}
      </div>

      <div className="call__center">
        <div className="avatar" aria-hidden="true">
          <span className="avatar__ring" />
          <span className="avatar__ring avatar__ring--2" />
          <span className="avatar__core"><LogoMark size={46} /></span>
        </div>

        <h2 className="call__name">{BRAND.assistantName}</h2>
        <p className="call__status" aria-live="polite">{statusText(p.phase, p.agentState)}</p>

        {connected && <p className="call__timer" aria-label={`Call length ${mmss(p.seconds)}`}>{mmss(p.seconds)}</p>}

        {connected && (
          <div className="call__wave" aria-hidden="true">
            <BarVisualizer state={p.agentState as Viz["state"]} barCount={21} track={p.agentTrack} />
          </div>
        )}

        {connected && (
          <div className="captions" aria-label="Live captions">
            {recent.length === 0 ? (
              <p className="captions__hint">Captions appear here as you talk. Try &quot;{TRY[0]}&quot;</p>
            ) : (
              recent.map((c) => (
                <p key={c.id} className={`cap cap--${c.who}`}>
                  <span className="cap__who">{c.who === "you" ? "You" : "Assistant"}</span>
                  {c.text}
                </p>
              ))
            )}
          </div>
        )}

        {p.phase === "idle" && (
          <div className="tryList">
            <p className="tryList__title">You could ask</p>
            <ul>
              {TRY.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        )}

        {p.phase === "ended" && (
          <div className="summary">
            <p className="summary__time num">{mmss(p.seconds)}</p>
            <p>Call length</p>
            {p.message && <p className="summary__reason">{p.message}</p>}
          </div>
        )}

        {p.phase === "error" && <p className="call__error" role="alert">{p.message}</p>}
      </div>

      <div className="call__foot">
        {live && (
          <>
            <div className="micRow">
              <span className="micRow__state" data-on={!p.muted}>
                {p.muted ? <MicOff size={15} /> : <Mic size={15} />}
                {p.muted ? "Mic muted" : "Mic on"}
              </span>
              {connected && !p.muted && (
                <span className="micRow__meter" aria-hidden="true">
                  <BarVisualizer barCount={7} track={p.micTrack} />
                </span>
              )}
            </div>

            <div className="controls">
              <div className="ctlWrap">
                <button
                  className="ctl"
                  onClick={p.onToggleMute}
                  aria-pressed={p.muted}
                  disabled={!connected}
                  aria-label={p.muted ? "Unmute microphone" : "Mute microphone"}
                >
                  {p.muted ? <MicOff size={26} /> : <Mic size={26} />}
                </button>
                <span className="ctlLabel">{p.muted ? "Unmute" : "Mute"}</span>
              </div>
              <div className="ctlWrap">
                <button className="ctl ctl--end" onClick={p.onEnd} aria-label={connected ? "End call" : "Cancel call"}>
                  <PhoneOff size={28} />
                </button>
                <span className="ctlLabel">{connected ? "End call" : "Cancel"}</span>
              </div>
            </div>
          </>
        )}

        {p.phase === "idle" && (
          <>
            <div className="ctlWrap">
              <button className="ctl ctl--call" onClick={p.onStart} aria-label="Start call">
                <Phone size={32} />
              </button>
              <span className="ctlLabel">Start call</span>
            </div>
            <p className="call__fine">
              <Headphones size={15} />
              Uses your microphone. Use headphones to avoid echo. Demo calls end after 5 minutes.
            </p>
          </>
        )}

        {p.phase === "ended" && (
          <div className="endActions">
            <button className="btn btn--light btn--lg" onClick={p.onStart}>Call again</button>
            <button className="btn btn--glass btn--lg" onClick={p.onViewActivity}>View activity</button>
          </div>
        )}

        {p.phase === "error" && (
          <div className="endActions">
            <button className="btn btn--light btn--lg" onClick={p.onStart}>Try again</button>
          </div>
        )}
      </div>
    </section>
  );
}
