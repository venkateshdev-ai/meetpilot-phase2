"use client";

// Account details form. The Save button used to be decorative — no handler, no
// endpoint — so typing a new name and saving silently discarded it.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button, TextField } from "@/components/ui";

export default function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = name.trim() !== initialName.trim();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSaved(true);
        // Refresh so the sidebar/header pick up the new name immediately.
        router.refresh();
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError((await res.json().catch(() => ({}))).error ?? `Failed (HTTP ${res.status})`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave}>
      <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
      <label className="mb-4 block">
        <span className="mb-1.5 block text-sm text-slate-300">Email</span>
        <input
          value={email}
          readOnly
          disabled
          className="w-full cursor-not-allowed rounded-xl border border-base-700 bg-base-900/40 px-3.5 py-2.5 text-sm text-slate-500"
        />
        <span className="mt-1 block text-xs text-slate-600">
          Your email is your sign-in identity and can&apos;t be changed here.
        </span>
      </label>
      {error && <p className="mb-3 text-xs text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 size={13} /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
