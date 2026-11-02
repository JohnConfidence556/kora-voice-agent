import Link from "next/link";
import { LayoutDashboard, MessageSquareText, Phone, Zap } from "lucide-react";
import Logo from "@/components/Logo";
import NavActions from "@/components/NavActions";
import HeroPreview from "@/components/landing/HeroPreview";
import { BRAND } from "@/lib/brand";

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: "Your line at a glance",
    text: "Airtime, data, active plan, SIM status and every transaction on one screen.",
  },
  {
    icon: Zap,
    title: "Recharge without guessing",
    text: "Pick a plan or an airtime amount, see what it costs and what you'll have left, then confirm.",
  },
  {
    icon: MessageSquareText,
    title: "Ask in writing",
    text: "The chat assistant answers plan and price questions, reads your account, and prepares purchases.",
  },
  {
    icon: Phone,
    title: "Or pick up the phone",
    text: "Call the assistant from your browser. It listens, answers out loud, and works from the same account and plan data.",
  },
];

const STEPS = [
  { title: "Ask", text: "Say or type \"Get me the 1GB weekly plan.\"" },
  { title: "Review", text: "The assistant prepares the order. A bar shows the price. Nothing has been charged." },
  { title: "Confirm", text: "You press Confirm. Only then does your balance change." },
];

const HONEST = [
  {
    title: "Answers come from saved plan pages",
    text: "Prices, rates and codes are looked up in plan information collected from MTN Nigeria's public pages, not recalled from memory.",
  },
  {
    title: "It says when it isn't sure",
    text: "If nothing in the saved pages matches the question, the assistant says so and points you to MTN's support line instead of guessing.",
  },
  {
    title: "Simulated money, real flow",
    text: "Balances and payments are simulated, but the account, the recharge flow and the confirmation step work the way a real product would.",
  },
];

const BUILT_WITH = [
  "Next.js", "FastAPI", "SQLite", "LiveKit Agents", "Groq: Whisper, Llama, Orpheus", "FastEmbed and FAISS retrieval",
];

export default function Landing() {
  return (
    <>
      <header className="nav">
        <div className="container nav__inner">
          <Link href="/" aria-label={`${BRAND.name} home`}><Logo /></Link>
          <div className="nav__actions"><NavActions /></div>
        </div>
      </header>

      <main>
        <div className="container hero">
          <div className="hero__copy">
            <h1 className="hero__title">Check your balance, buy data, or just ask.</h1>
            <p className="hero__lead">
              {BRAND.name} is a mobile self-service account with an assistant you can chat with or call. It reads
              your balance, answers plan questions from published MTN Nigeria information, and prepares purchases
              for you to confirm.
            </p>
            <div className="hero__cta">
              <Link className="btn btn--primary btn--lg" href="/signup">Create a demo account</Link>
              <Link className="btn btn--ghost btn--lg" href="/login">Sign in</Link>
            </div>
            <p className="hero__note">An independent portfolio project. Balances and payments are simulated.</p>
          </div>
          <HeroPreview />
        </div>

        <div className="container">
          <section className="section">
            <div>
              <h2 className="section__title">Everything a self-service line needs</h2>
              <p className="section__lead">
                One account, one place to manage it, and two ways to get help when you don&apos;t want to dig.
              </p>
            </div>
            <ul className="featureList">
              {FEATURES.map((f) => (
                <li className="feature" key={f.title}>
                  <span className="feature__icon"><f.icon size={22} /></span>
                  <div>
                    <h3 className="feature__title">{f.title}</h3>
                    <p className="feature__text">{f.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="sequence">
            <h2 className="section__title">A purchase, start to finish</h2>
            <p className="section__lead">
              The assistant can prepare an order. It can never pay for one. That step is always yours.
            </p>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li className="step" key={s.title}>
                  <span className="step__n num">{i + 1}</span>
                  <h3 className="step__title">{s.title}</h3>
                  <p className="step__text">{s.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="section">
            <div>
              <h2 className="section__title">Honest by design</h2>
            </div>
            <div className="honest">
              {HONEST.map((h) => (
                <div className="honest__item" key={h.title}>
                  <h3 className="feature__title">{h.title}</h3>
                  <p className="feature__text">{h.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div>
              <h2 className="section__title">Built with</h2>
              <p className="section__lead">A full-stack, voice-enabled AI application, from retrieval to deployment.</p>
            </div>
            <ul className="chips">
              {BUILT_WITH.map((t) => <li className="chip chip--static" key={t}>{t}</li>)}
            </ul>
          </section>

          <section className="band">
            <h2 className="band__title">See it work in two minutes.</h2>
            <Link className="btn btn--light btn--lg" href="/signup">Create a demo account</Link>
          </section>
        </div>
      </main>

      <footer className="container foot">
        <p className="foot__legal">{BRAND.disclaimer}</p>
        <p className="foot__links">
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Sign up</Link>
        </p>
      </footer>
    </>
  );
}
