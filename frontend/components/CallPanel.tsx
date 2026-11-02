"use client";

import { useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { getToken } from "@/lib/api";

type Connection = { serverUrl: string; token: string };

const LABELS: Record<string, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  initializing: "Agent is joining...",
  listening: "Listening",
  thinking: "Thinking...",
  speaking: "Speaking",
};

function AgentView() {
  const { state, audioTrack } = useVoiceAssistant();
  return (
    <div style={{ textAlign: "center" }}>
      <BarVisualizer state={state} barCount={7} trackRef={audioTrack} style={{ height: 120 }} />
      <p style={{ fontSize: 18 }}>{LABELS[state] ?? state}</p>
    </div>
  );
}

export default function CallPanel() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function startCall() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/token", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not start the call");
      }
      setConnection(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!connection) {
    return (
      <div>
        <button onClick={startCall} disabled={loading} style={{ padding: "12px 24px", fontSize: 16 }}>
          {loading ? "Starting..." : "Call support"}
        </button>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={connection.serverUrl}
      token={connection.token}
      connect={true}
      audio={true}
      video={false}
      onDisconnected={() => setConnection(null)}
      data-lk-theme="default"
    >
      <AgentView />
      <RoomAudioRenderer />
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <button onClick={() => setConnection(null)} style={{ padding: "10px 20px" }}>
          End call
        </button>
      </div>
    </LiveKitRoom>
  );
}