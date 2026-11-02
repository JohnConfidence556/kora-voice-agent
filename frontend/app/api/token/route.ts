import { AccessToken } from "livekit-server-sdk";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, BACKEND_URL } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !BACKEND_URL) {
    return NextResponse.json({ error: "Server is not configured" }, { status: 500 });
  }

  // Ask the backend who this is, using the login token the browser sent
  let user: { id: number };
  try {
    const res = await fetch(`${BACKEND_URL}/me`, {
      headers: { Authorization: request.headers.get("authorization") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Please log in first" }, { status: 401 });
    }
    user = await res.json();
  } catch {
    return NextResponse.json({ error: "Could not reach the backend" }, { status: 502 });
  }

  // A fresh room per call, so every call gets its own agent
  const room = `call-${crypto.randomUUID()}`;
  const identity = `user-${user.id}-${crypto.randomUUID().slice(0, 6)}`;

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    ttl: "10m", // the token stops working after 10 minutes
    metadata: JSON.stringify({ user_id: user.id }), // signed, so the agent can trust it
  });
  token.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true });

  return NextResponse.json({ serverUrl: LIVEKIT_URL, token: await token.toJwt() });
}