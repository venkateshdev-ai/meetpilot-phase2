"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Button, TextField } from "@/components/ui";

type Provider = "JIRA" | "ASANA" | "TRELLO" | "SLACK";

const PROVIDER_FIELDS: Record<Provider, { key: string; label: string; placeholder: string }[]> = {
  JIRA: [
    { key: "siteUrl", label: "Site URL", placeholder: "yourcompany.atlassian.net" },
    { key: "userEmail", label: "Account email", placeholder: "you@company.com" },
    { key: "projectKey", label: "Project key", placeholder: "MEET" },
  ],
  ASANA: [{ key: "projectGid", label: "Project GID", placeholder: "1234567890123456" }],
  TRELLO: [
    { key: "boardId", label: "Board ID", placeholder: "abc123" },
    { key: "listId", label: "Target list ID", placeholder: "def456" },
  ],
  SLACK: [{ key: "channelId", label: "Channel ID", placeholder: "C0123ABC456" }],
};

const SECRET_LABEL: Record<Provider, string> = {
  JIRA: "API token",
  ASANA: "Personal access token",
  TRELLO: "key:token (colon-separated)",
  SLACK: "Bot token (xoxb-...)",
};

interface IntegrationStatus {
  provider: Provider;
  connected: boolean;
  config: Record<string, string> | null;
}

// Real per-org credential storage for Jira/Asana/Trello/Slack — a personal
// access token/API key you generate on each tool's own site, not a
// registered OAuth app (see .env.example for where to get each one). Stored
// via POST /api/org/integrations into the Integration table.
export default function IntegrationsPanel() {
  const [statuses, setStatuses] = useState<Record<Provider, IntegrationStatus | undefined>>({} as any);
  const [openProvider, setOpenProvider] = useState<Provider | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/org/integrations")
      .then((r) => r.json())
      .then((rows: IntegrationStatus[]) => {
        const byProvider = Object.fromEntries(rows.map((r) => [r.provider, r])) as Record<
          Provider,
          IntegrationStatus | undefined
        >;
        setStatuses(byProvider);
      });
  }, []);

  function openForm(provider: Provider) {
    setOpenProvider(provider);
    setForm(statuses[provider]?.config ?? {});
    setSecret("");
    setMessage(null);
  }

  async function handleSave(provider: Provider) {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/org/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, secret, config: form }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage({ ok: false, text: body.error ?? "Could not save" });
    } else {
      setMessage({ ok: true, text: `${provider} connected.` });
      setStatuses((prev) => ({ ...prev, [provider]: { provider, connected: true, config: form } }));
      setOpenProvider(null);
    }
    setSaving(false);
  }

  const providers: Provider[] = ["JIRA", "ASANA", "TRELLO", "SLACK"];

  return (
    <Card className="divide-y divide-base-700 p-0">
      {providers.map((provider) => {
        const status = statuses[provider];
        return (
          <div key={provider} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">
                  {provider[0]}
                  {provider.slice(1).toLowerCase()}
                </div>
                <div className="text-xs text-slate-500">
                  {status?.connected ? "Connected" : "Not connected"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {status?.connected && <Badge tone="success">Connected</Badge>}
                <Button variant="secondary" onClick={() => openForm(provider)}>
                  {status?.connected ? "Reconfigure" : "Connect"}
                </Button>
              </div>
            </div>

            {openProvider === provider && (
              <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
                {PROVIDER_FIELDS[provider].map((f) => (
                  <TextField
                    key={f.key}
                    label={f.label}
                    placeholder={f.placeholder}
                    value={form[f.key] ?? ""}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                ))}
                <TextField
                  label={SECRET_LABEL[provider]}
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                />
                {message && (
                  <p className={`mb-3 text-xs ${message.ok ? "text-emerald-400" : "text-danger"}`}>{message.text}</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => handleSave(provider)} disabled={saving || !secret}>
                    {saving ? "Saving…" : "Save & connect"}
                  </Button>
                  <Button variant="secondary" onClick={() => setOpenProvider(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
