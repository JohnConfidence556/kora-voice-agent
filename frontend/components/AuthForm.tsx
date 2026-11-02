"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MessageSquareText, Phone, TriangleAlert, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import { api, getToken, Profile, setToken } from "@/lib/api";

const POINTS = [
  { icon: Zap, text: "See your balances and plan, and recharge in a few taps" },
  { icon: MessageSquareText, text: "Ask the assistant by chat about plans and prices" },
  { icon: Phone, text: "Or call it from your browser and talk it through" },
];

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already signed in? Go straight to the dashboard.
  useEffect(() => {
    if (getToken()) router.replace("/dashboard");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await api<{ token: string; user: Profile }>(
        isLogin ? "/auth/login" : "/auth/signup",
        { method: "POST", body: JSON.stringify({ email, password }) }
      );
      setToken(data.token);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <Link href="/" aria-label="Kora home"><Logo /></Link>
        <div className="auth__pitch">
          <h2 className="auth__headline">Your line, your balance, one conversation away.</h2>
          <ul className="auth__points">
            {POINTS.map((p) => (
              <li key={p.text}><p.icon size={20} />{p.text}</li>
            ))}
          </ul>
        </div>
        <p className="auth__fine">Independent demo with simulated data. Not an official MTN service.</p>
      </aside>

      <main className="auth__main">
        <form className="auth__form" onSubmit={submit}>
          <h1 className="auth__title">{isLogin ? "Sign in" : "Create your account"}</h1>
          <p className="auth__sub">
            {isLogin
              ? "Welcome back. Sign in to see your balances and pick up where you left off."
              : "Use any email address. You start with ₦2,000 airtime and 1,000 MB of simulated data. No real SIM or money is involved."}
          </p>

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <span className="field__wrap">
              <input
                className="input"
                type={show ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "Your password" : "At least 6 characters"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="field__toggle"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && <p className="formError" role="alert"><TriangleAlert size={18} />{error}</p>}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={loading}>
            {loading ? "Please wait..." : isLogin ? "Sign in" : "Sign up"}
          </button>

          <p className="auth__switch">
            {isLogin ? "New to Kora?" : "Already have an account?"}{" "}
            <Link href={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Sign in"}</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
