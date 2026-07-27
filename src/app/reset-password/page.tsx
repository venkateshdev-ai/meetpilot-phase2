"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, TextField } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      } else {
        setError(body.error ?? `Something went wrong (HTTP ${res.status})`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold">Missing reset link</h1>
        <p className="text-sm text-slate-400">
          Open the link from your reset email, or request a new one.
        </p>
      </>
    );
  }

  if (done) {
    return (
      <>
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 size={18} />
        </span>
        <h1 className="mb-2 text-xl font-bold">Password updated</h1>
        <p className="text-sm text-slate-400">Taking you to sign in…</p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-2 text-xl font-bold">Choose a new password</h1>
      <p className="mb-6 text-sm text-slate-400">At least 8 characters.</p>
      <form onSubmit={handleSubmit} className="text-left">
        <TextField
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <TextField
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        {error && <p className="mb-3 text-xs text-danger">{error}</p>}
        <Button type="submit" className="w-full justify-center" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-hero-glow px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-700/80 bg-base-800/60 p-8 text-center shadow-card backdrop-blur-sm">
        <span className="mx-auto mb-4 block h-12 w-12 rounded-2xl bg-brand-gradient shadow-glow" />
        {/* useSearchParams needs a Suspense boundary for static generation. */}
        <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="mt-6 text-sm text-slate-400">
          <Link href="/login" className="text-accent-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
