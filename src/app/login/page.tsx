"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, TextField } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("varan@acme.io");
  const [password, setPassword] = useState("acme1234");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-hero-glow px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-700/80 bg-base-800/60 p-8 shadow-card backdrop-blur-sm">
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
            <span className="h-4 w-4 rounded bg-white/90" />
          </span>
          <h1 className="text-xl font-bold tracking-tight">MeetPilot</h1>
          <p className="text-sm text-slate-400">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-slate-300">Password</span>
            <Link href="/forgot-password" className="text-xs text-accent-400 hover:underline">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mb-2 w-full rounded-xl border border-base-700 bg-base-900/80 px-3.5 py-2.5 text-sm text-white outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
          />
          {error && <p className="mb-3 text-xs text-danger">{error}</p>}
          <p className="mb-4 text-xs text-slate-500">
            Seeded demo users: varan@acme.io, hulk@acme.io, batman@acme.io (etc.) — password{" "}
            <code className="text-slate-400">acme1234</code> for all of them.
          </p>
          <Button type="submit" className="w-full justify-center" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign In"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          New to MeetPilot?{" "}
          <Link href="/signup" className="text-accent-400 hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
