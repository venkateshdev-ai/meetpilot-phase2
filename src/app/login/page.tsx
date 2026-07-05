"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, TextField } from "@/components/ui";

// DEMO-MODE AUTH: this posts nowhere — it just navigates to /dashboard so the
// full click-through flow works without a live database in this sandbox.
// Stage 1 already wired real NextAuth (src/lib/auth.ts, Google + Credentials
// providers) — swapping this form to call `signIn()` is the only change needed
// once DATABASE_URL points at a real Postgres instance.
export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-700 bg-base-800/60 p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <span className="h-12 w-12 rounded-2xl bg-brand-gradient" />
          <h1 className="text-xl font-bold">MeetPilot</h1>
          <p className="text-sm text-slate-400">Sign in to your account</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/dashboard");
          }}
        >
          <TextField label="Email" type="email" placeholder="name@company.com" defaultValue="varan@acme.io" required />
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-slate-300">Password</span>
            <Link href="/forgot-password" className="text-xs text-accent-400 hover:underline">
              Forgot?
            </Link>
          </div>
          <input
            type="password"
            defaultValue="demo-password"
            required
            className="mb-5 w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
          />
          <Button type="submit" className="w-full justify-center">
            Sign In
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-px flex-1 bg-base-700" /> OR <div className="h-px flex-1 bg-base-700" />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/dashboard")}>
            Google
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => router.push("/dashboard")}>
            Microsoft
          </Button>
        </div>
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
