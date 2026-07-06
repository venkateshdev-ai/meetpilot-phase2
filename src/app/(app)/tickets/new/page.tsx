"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, TextField } from "@/components/ui";

const FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "description", label: "Description", placeholder: "What is this ticket about?" },
  { key: "whyScenario", label: "Possible why (scenario)", placeholder: "Why is this needed — what triggered it?" },
  { key: "featureDescription", label: "Feature description", placeholder: "What should be built?" },
  { key: "testCases", label: "Test cases", placeholder: "1. ...\n2. ..." },
  { key: "acceptanceCriteria", label: "Acceptance criteria", placeholder: "Given/When/Then, or a checklist" },
  { key: "telemetry", label: "Possible telemetry", placeholder: "Events to track for this feature" },
  { key: "successMetric", label: "Success metric", placeholder: "How will we know this worked?" },
];

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, ...fields }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "Could not create ticket");
      setSubmitting(false);
      return;
    }
    router.push(`/tickets/${body.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">New ticket</h1>
      <p className="mb-5 text-sm text-slate-400">
        Fill in whatever you know now — you can edit and push to a connected tool later.
      </p>
      <Card>
        <form onSubmit={handleSubmit}>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          {FIELDS.map((f) => (
            <label key={f.key} className="mb-4 block">
              <span className="mb-1.5 block text-sm text-slate-300">{f.label}</span>
              <textarea
                rows={3}
                placeholder={f.placeholder}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full rounded-xl border border-base-700 bg-base-900 px-3.5 py-2.5 text-sm text-white outline-none focus:border-accent-500"
              />
            </label>
          ))}
          {error && <p className="mb-3 text-xs text-danger">{error}</p>}
          <Button type="submit" disabled={submitting || !title}>
            {submitting ? "Creating…" : "Create ticket"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
