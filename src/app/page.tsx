import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-brand-gradient" />
        <span className="text-2xl font-bold">MeetPilot</span>
      </div>
      <h1 className="max-w-xl text-3xl font-bold sm:text-4xl">
        Your AI-powered meeting copilot &amp; workspace booking platform
      </h1>
      <p className="max-w-lg text-slate-400">
        Schedule online or offline, recall past decisions automatically, and push action
        items straight into Jira, Asana, or Linear.
      </p>
      <div className="flex gap-3">
        <Link
          href="/signup"
          className="rounded-xl bg-brand-gradient px-5 py-2.5 font-medium text-white"
        >
          Get Started
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-base-700 px-5 py-2.5 font-medium text-slate-200"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
