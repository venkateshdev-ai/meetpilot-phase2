import Link from "next/link";
import { Sparkles, ShieldCheck, Video, Ticket, History, BarChart3 } from "lucide-react";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI meeting minutes",
    body: "Upload a recording or notes — get an executive summary, decisions, and assigned action items in seconds.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop gate",
    body: "AI-proposed tickets pause for review. Nothing reaches Jira or your CRM without an explicit human sign-off.",
  },
  {
    icon: History,
    title: "MoM recall",
    body: "Meeting the same group again? MeetPilot resurfaces the decisions and open items from last time, automatically.",
  },
  {
    icon: Video,
    title: "Live video rooms",
    body: "Every online meeting gets a real video room — camera, mic, screen share — no extra accounts needed.",
  },
  {
    icon: Ticket,
    title: "Ticket push",
    body: "Turn action items into fully-specced tickets and push them to Jira, Asana, or Trello with one click.",
  },
  {
    icon: BarChart3,
    title: "Meeting analytics",
    body: "Talk-time balance, topic weights, and follow-through rates across every team and meeting series.",
  },
];

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-hero-glow">
      {/* Top nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
            <span className="h-3 w-3 rounded-sm bg-white/90" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">MeetPilot</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-base-800 hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-glow transition hover:brightness-110"
          >
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-16 text-center sm:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-500/30 bg-accent-500/10 px-3.5 py-1.5 text-xs font-medium text-accent-400">
          <Sparkles size={13} />
          AI minutes · HITL ticket approval · CRM push
        </span>
        <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Meetings that end with <span className="text-gradient">decisions shipped</span>, not
          notes lost
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
          MeetPilot turns every meeting into summaries, owned action items, and
          human-approved tickets in Jira, Asana, or Trello — automatically.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/signup"
            className="rounded-xl bg-brand-gradient px-6 py-3 font-medium text-white shadow-glow transition hover:brightness-110"
          >
            Get Started — it&apos;s free
          </Link>
          <Link
            href="/login"
            className="rounded-xl border border-base-700 bg-base-800/40 px-6 py-3 font-medium text-slate-200 transition hover:border-base-600 hover:bg-base-800"
          >
            Sign In
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-base-700/80 bg-base-800/50 p-6 shadow-card backdrop-blur-sm transition-colors hover:border-accent-500/30"
            >
              <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/10 text-accent-400 ring-1 ring-inset ring-accent-500/25 transition group-hover:bg-accent-500/15">
                <f.icon size={19} />
              </span>
              <h3 className="mb-1.5 font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-base-700/60 py-8 text-center text-xs text-slate-600">
        MeetPilot — AI meeting copilot for SMEs
      </footer>
    </main>
  );
}
