"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, MailCheck } from "lucide-react";
import { Button, TextField } from "@/components/ui";

// This screen used to flip a local boolean and tell every visitor a reset link
// was on its way — while sending nothing. It now calls the real endpoint and
// reports what actually happened, including the case where the deployment has
// no mail provider configured.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ message: string; emailConfigured: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) setResult({ message: body.message, emailConfigured: !!body.emailConfigured });
      else setError(body.error ?? `Something went wrong (HTTP ${res.status})`);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-hero-glow px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-700/80 bg-base-800/60 p-8 text-center shadow-card backdrop-blur-sm">
        <span className="mx-auto mb-4 block h-12 w-12 rounded-2xl bg-brand-gradient shadow-glow" />
        {result ? (
          <>
            <span
              className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full ${
                result.emailConfigured ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              }`}
            >
              {result.emailConfigured ? <MailCheck size={18} /> : <AlertTriangle size={18} />}
            </span>
            <h1 className="mb-2 text-xl font-bold">
              {result.emailConfigured ? "Check your email" : "Email isn't set up here"}
            </h1>
            <p className="mb-2 text-sm text-slate-400">{result.message}</p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">Reset your password</h1>
            <p className="mb-6 text-sm text-slate-400">
              Enter your work email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleSubmit} className="text-left">
              <TextField
                label="Email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {error && <p className="mb-3 text-xs text-danger">{error}</p>}
              <Button type="submit" className="w-full justify-center" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
        <p className="mt-6 text-sm text-slate-400">
          <Link href="/login" className="text-accent-400 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
