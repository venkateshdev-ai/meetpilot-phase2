"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, TextField } from "@/components/ui";

// This screen is one of the gaps called out in the PRD (Section 5): the original
// wireframes had a "Sign Up" button on the welcome screen but no signup form
// behind it. This closes that gap: name, work email, password, and either
// create-a-new-org or join-via-invite-code.
export default function SignupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-800/60 p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="h-12 w-12 rounded-2xl bg-brand-gradient" />
          <h1 className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-slate-400">Start booking meetings in minutes</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/dashboard");
          }}
        >
          <TextField label="Full name" placeholder="Jordan Lee" required />
          <TextField label="Work email" type="email" placeholder="name@company.com" required />
          <TextField label="Password" type="password" placeholder="At least 8 characters" required minLength={8} />

          <div className="mb-4 flex rounded-xl border border-base-700 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("create")}
              className={`flex-1 rounded-lg py-1.5 ${mode === "create" ? "bg-accent-500/20 text-accent-400" : "text-slate-400"}`}
            >
              Create org
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={`flex-1 rounded-lg py-1.5 ${mode === "join" ? "bg-accent-500/20 text-accent-400" : "text-slate-400"}`}
            >
              Join with invite code
            </button>
          </div>
          {mode === "create" ? (
            <TextField label="Organization name" placeholder="Acme Industries" required />
          ) : (
            <TextField label="Invite code" placeholder="ACME-7F3K2" required />
          )}

          <Button type="submit" className="mt-2 w-full justify-center">
            Create account
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
