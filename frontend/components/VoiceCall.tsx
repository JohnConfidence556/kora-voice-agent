"use client";

import { RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom, RoomAudioRenderer, useLocalParticipant, useRoomContext,
  useTranscriptions, useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import type { LocalAudioTrack } from "livekit-client";
import CallScreen, { Caption } from "@/components/CallScreen";
import { getToken } from "@/lib/api";
import { useAccountState } from "@/lib/account";

const LIMIT_SECONDS = 300;      // demo calls end after 5 minutes (protects your API credits)
const RING_TIMEOUT_MS = 25_000; // give up if the voice agent never joins

type Connection = { serverUrl: string; token: string };
type Stage = "idle" | "starting" | "live" | "ended" | "error";

// Shared between the page and the live call, so the page knows how the call went.
type CallInfo = { seconds: number; answered: boolean; reason: "" | "user" | "limit" | "timeout" | "mic" };

// ---------- Inside the room: talks to LiveKit and feeds the screen ----------
function LiveCall({ info }: { info: RefObject<CallInfo> }) {
  const room = useRoomContext();
  const { state, audioTrack } = useVoiceAssistant();
  const { localParticipant, isMicrophoneEnabled, microphoneTrack } = useLocalParticipant();
  const streams = useTranscriptions();
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);

  const answered = state === "listening" || state === "thinking" || state === "speaking";

  const hangUp = useCallback(
    (reason: CallInfo["reason"]) => {
      info.current.reason = reason;
      room.disconnect();
    },
    [info, room]
  );

  // The timer starts the moment the assistant picks up
  useEffect(() => {
    if (answered && startedAt.current === null) {
      startedAt.current = Date.now();
      info.current.answered = true;
    }
  }, [answered, info]);

  useEffect(() => {
    const id = setInterval(() => {
      if (startedAt.current === null) return;
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      info.current.seconds = s;
      setSeconds(s);
      if (s >= LIMIT_SECONDS) hangUp("limit");
    }, 500);
    return () => clearInterval(id);
  }, [hangUp, info]);

  // Nobody picked up
  useEffect(() => {
    const id = setTimeout(() => {
      if (startedAt.current === null) hangUp("timeout");
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [hangUp]);

  const captions: Caption[] = streams
    .slice(-4)
    .map((s) => ({
      id: s.streamInfo.id,
      who: (s.participantInfo.identity === localParticipant.identity ? "you" : "agent") as Caption["who"],
      text: s.text,
    }))
    .filter((c) => c.text.trim().length > 0);

  return (
    <CallScreen
      phase={answered ? "connected" : "ringing"}
      agentState={state}
      seconds={seconds}
      limitSeconds={LIMIT_SECONDS}
      muted={answered && !isMicrophoneEnabled}
      agentTrack={audioTrack}
      micTrack={microphoneTrack?.track as LocalAudioTrack | undefined}
      captions={captions}
      onStart={() => {}}
      onViewActivity={() => {}}
      onEnd={() => hangUp("user")}
      onToggleMute={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
    />
  );
}

// ---------- The page-level component ----------
export default function VoiceCall() {
  const router = useRouter();
  const { refresh } = useAccountState();
  const [stage, setStage] = useState<Stage>("idle");
  const [conn, setConn] = useState<Connection | null>(null);
  const [message, setMessage] = useState("");
  const [lastSeconds, setLastSeconds] = useState(0);
  const info = useRef<CallInfo>({ seconds: 0, answered: false, reason: "" });
  const finished = useRef(true);

  async function start() {
    info.current = { seconds: 0, answered: false, reason: "" };
    finished.current = false;
    setMessage("");
    setStage("starting");
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start the call.");
      }
      setConn(await res.json());
      setStage("live");
    } catch (e) {
      finished.current = true;
      setMessage(e instanceof Error ? e.message : "Could not start the call.");
      setStage("error");
    }
  }

  // Runs once when the room closes, however it closed
  function finish() {
    if (finished.current) return;
    finished.current = true;
    const i = info.current;
    setConn(null);
    setLastSeconds(i.seconds);
    refresh(); // the assistant may have prepared an order during the call

    if (i.reason === "mic") {
      setMessage("Your browser blocked the microphone. Allow microphone access for this site, then try again.");
      setStage("error");
    } else if (i.reason === "timeout") {
      setMessage("Nobody picked up. The voice assistant may be offline. Check that the agent is running.");
      setStage("error");
    } else if (!i.answered && i.reason === "user") {
      setStage("idle");
    } else if (!i.answered) {
      setMessage("The call dropped before the assistant joined.");
      setStage("error");
    } else {
      setMessage(i.reason === "limit" ? "Demo calls are limited to 5 minutes." : "");
      setStage("ended");
    }
  }

  const phase = stage === "starting" ? "starting" : stage === "ended" ? "ended" : stage === "error" ? "error" : "idle";

  if (stage === "live" && conn) {
    return (
      <LiveKitRoom
        serverUrl={conn.serverUrl}
        token={conn.token}
        connect={true}
        audio={true}
        video={false}
        onDisconnected={finish}
        onMediaDeviceFailure={() => {
          info.current.reason = "mic";
          finish();
        }}
        data-lk-theme="default"
      >
        <LiveCall info={info} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <CallScreen
      phase={phase}
      seconds={lastSeconds}
      limitSeconds={LIMIT_SECONDS}
      muted={false}
      captions={[]}
      message={message}
      onStart={start}
      onEnd={() => { finished.current = true; setStage("idle"); }}
      onToggleMute={() => {}}
      onViewActivity={() => router.push("/dashboard/activity")}
    />
  );
}
