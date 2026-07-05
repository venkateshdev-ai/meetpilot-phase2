"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, TextField } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-800/60 p-8 text-center">
        <span className="mx-auto mb-4 block h-12 w-12 rounded-2xl bg-brand-gradient" />
        {sent ? (
          <>
            <h1 className="mb-2 text-xl font-bold">Check your email</h1>
            <p className="mb-6 text-sm text-slate-400">
              If an account exists for that address, we've sent a reset link.
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-bold">Reset your password</h1>
            <p className="mb-6 text-sm text-slate-400">
              Enter your work email and we'll send you a reset link.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
              className="text-left"
            >
              <TextField label="Email" type="email" placeholder="name@company.com" required />
              <Button type="submit" className="w-full justify-center">
                Send reset link
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
