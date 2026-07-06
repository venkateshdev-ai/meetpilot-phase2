"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, TextField } from "@/components/ui";

// Real signup: POSTs to /api/auth/register (writes a User + OrgMembership
// row), then signs in immediately via NextAuth credentials. New accounts join
// the seeded Acme org as a MEMBER — see the comment on createUserWithOrg in
// src/lib/db/store.ts for why "create a brand-new org" isn't wired up yet.
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not create account");
      setSubmitting(false);
      return;
    }

    const signInRes = await signIn("credentials", { email, password, redirect: false });
    if (signInRes?.error) {
      setError("Account created, but sign-in failed — try signing in manually.");
      setSubmitting(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-800/60 p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="h-12 w-12 rounded-2xl bg-brand-gradient" />
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-slate-400">Start booking meetings in minutes</p>
        </div>
        <form onSubmit={handleSubmit}>
          <TextField label="Full name" placeholder="Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Work email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <p className="mb-4 text-xs text-slate-500">
            New accounts join the Acme Industries demo org as a Member.
          </p>
          {error && <p className="mb-3 text-xs text-danger">{error}</p>}
          <Button type="submit" className="mt-2 w-full justify-center" disabled={submitting}>
            {submitting ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-accent-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
