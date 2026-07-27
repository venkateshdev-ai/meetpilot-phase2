"use client";

// ReviewCenter — the Human-in-the-Loop governance gate for a meeting.
//
// Control panel over the Python LangGraph orchestrator (orchestrator/main.py):
//   GET  {ORCHESTRATOR}/meetings/{id}/state    → read durable graph state
//   POST {ORCHESTRATOR}/meetings/{id}/process  → start extraction (parks at review)
//   POST {ORCHESTRATOR}/meetings/{id}/review   → approve / request changes
//
// Design decision: tasks are NOT edited inline in the browser. Every change
// goes through the reject-with-feedback loop so the agent revises and the
// append-only audit_log records who asked for what — direct client-side edits
// would bypass the governance trail the orchestrator exists to provide.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Bot, CheckCircle2, ClipboardCheck, Loader2, RefreshCw,
  Send, ServerCog, ShieldCheck, Sparkles, Ticket, UserCheck, XCircle,
} from "lucide-react";
import { Badge, Button, Card } from "@/components/ui";

const ORCHESTRATOR =
  process.env.NEXT_PUBLIC_ORCHESTRATOR_URL ?? "http://localhost:8001";

// ---- Types mirroring the FastAPI Pydantic response models -------------------
interface TaskItem {
  summary: string;
  assignee: string;
  due_date: string;
  priority: string;
  issue_type: string;
}
interface AuditEntry {
  ts: string;
  actor: "agent" | "human" | "system" | string;
  action: string;
  detail: any;
}
interface MeetingState {
  meeting_id: string;
  status: "awaiting_review" | "executed" | "in_progress";
  extracted_tasks: TaskItem[];
  execution_status: string;
  is_approved: boolean;
  revision_count: number;
  audit_log: AuditEntry[];
}

// FastAPI errors: `detail` is a string (HTTPException) or an array of
// {msg, loc} objects (422 validation). Normalize both to one clean sentence
// so backend guardrails surface as readable inline errors, never a crash.
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return body.detail;
    if (Array.isArray(body.detail))
      return body.detail.map((d: any) => d.msg ?? String(d)).join("; ");
  } catch {
    /* non-JSON body */
  }
  return `Backend error (HTTP ${res.status})`;
}

const PRIORITY_TONE: Record<string, "danger" | "warning" | "neutral"> = {
  High: "danger",
  Medium: "warning",
  Low: "neutral",
};

export default function ReviewCenter({
  meetingId,
  transcript,
}: {
  meetingId: string;
  /** Raw transcript text; enables "Run AI extraction" when no workflow exists yet. */
  transcript?: string;
}) {
  const [state, setState] = useState<MeetingState | null>(null);
  const [loading, setLoading] = useState(true); // initial mount fetch
  const [busy, setBusy] = useState<"approve" | "reject" | "process" | null>(null);
  const [noWorkflow, setNoWorkflow] = useState(false); // 404: never started
  const [error, setError] = useState<string | null>(null); // inline error banner
  const [offline, setOffline] = useState(false); // orchestrator unreachable
  const [feedback, setFeedback] = useState("");
  // How many approved tasks were mirrored into MeetPilot's Ticket table.
  const [syncedTickets, setSyncedTickets] = useState<number | "syncing" | "failed" | null>(null);

  // ---- Data fetching: on mount, read the durable state from SQLite ---------
  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`${ORCHESTRATOR}/meetings/${meetingId}/state`);
      setOffline(false);
      if (res.status === 404) {
        setNoWorkflow(true);
        setState(null);
      } else if (res.ok) {
        setNoWorkflow(false);
        setState(await res.json());
      } else {
        setError(await errorMessage(res));
      }
    } catch {
      // fetch() rejects on network failure — the Python service isn't up.
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ---- Actions --------------------------------------------------------------
  async function startExtraction() {
    if (!transcript || transcript.trim().length < 20) {
      setError("This meeting has no transcript yet — extraction needs one.");
      return;
    }
    setBusy("process");
    setError(null);
    try {
      const res = await fetch(`${ORCHESTRATOR}/meetings/${meetingId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      // 202 = extracted & parked for review; 409 = already exists (just load it)
      if (res.status === 202 || res.status === 409) await refresh();
      else setError(await errorMessage(res));
    } catch {
      setOffline(true);
    } finally {
      setBusy(null);
    }
  }

  async function submitReview(isApproved: boolean) {
    // Mirror the backend governance rule client-side for instant feedback —
    // the server still enforces it (422) as the source of truth.
    if (!isApproved && !feedback.trim()) {
      setError("Add feedback describing what to change before requesting changes.");
      return;
    }
    setBusy(isApproved ? "approve" : "reject");
    setError(null);
    try {
      const res = await fetch(`${ORCHESTRATOR}/meetings/${meetingId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_approved: isApproved,
          feedback: isApproved ? "" : feedback.trim(),
        }),
      });
      if (res.ok || res.status === 202) {
        // 200 executed / 202 revised — both bodies are the fresh MeetingState.
        const next: MeetingState = await res.json();
        setState(next);
        setFeedback("");
        // On approval, mirror the approved tasks into MeetPilot's own Ticket
        // table so the Tickets page reflects what was just signed off. The
        // orchestrator only writes to the external CRM; this is the in-app
        // half. Deliberately non-blocking: the approval itself already
        // succeeded, so a hiccup here must not present as a failed approval.
        if (next.status === "executed" && next.extracted_tasks.length > 0) {
          setSyncedTickets("syncing");
          try {
            const t = await fetch(`/api/meetings/${meetingId}/ai-tickets`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ tasks: next.extracted_tasks }),
            });
            setSyncedTickets(t.ok ? (await t.json()).created : "failed");
          } catch {
            setSyncedTickets("failed");
          }
        }
      } else {
        // 409 (not awaiting review) / 422 (validation) → inline, no crash.
        setError(await errorMessage(res));
        if (res.status === 409) await refresh(); // resync stale UI
      }
    } catch {
      setOffline(true);
    } finally {
      setBusy(null);
    }
  }

  // ---- Render: loading skeleton --------------------------------------------
  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-base-700" />
          <div className="h-16 rounded-xl bg-base-700/60" />
          <div className="h-16 rounded-xl bg-base-700/60" />
          <div className="h-9 w-64 rounded-xl bg-base-700" />
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin" /> Contacting orchestrator…
        </p>
      </Card>
    );
  }

  // ---- Render: orchestrator down -------------------------------------------
  if (offline) {
    return (
      <Card className="border-warning/40">
        <div className="flex items-start gap-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-warning">AI orchestrator unreachable</p>
            <p className="mt-1 text-slate-400">
              Could not reach <code className="text-slate-300">{ORCHESTRATOR}</code>. Start it with{" "}
              <code className="text-slate-300">uvicorn main:app --app-dir orchestrator --port 8001</code>.
            </p>
            <Button variant="secondary" className="mt-3" onClick={() => { setLoading(true); refresh(); }}>
              <span className="flex items-center gap-1.5"><RefreshCw size={14} /> Retry</span>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ---- Render: no workflow yet — offer to start one ------------------------
  if (noWorkflow) {
    return (
      <Card>
        <SectionHeader status={null} revisionCount={0} />
        <p className="mb-4 text-sm text-slate-400">
          No AI extraction has been run for this meeting. Kick one off and the proposed
          tasks will park here for human approval before anything is written to your CRM.
        </p>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
        <Button onClick={startExtraction} disabled={busy === "process"}>
          <span className="flex items-center gap-1.5">
            {busy === "process" ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {busy === "process" ? "Extracting…" : "Run AI extraction"}
          </span>
        </Button>
      </Card>
    );
  }

  if (!state) {
    return (
      <Card>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      </Card>
    );
  }

  const executed = state.status === "executed";
  const crmWrites = state.audit_log.filter((e) => e.action === "crm_write");

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader status={state.status} revisionCount={state.revision_count} />

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* ---- Task list: draft under review, or finalized read-only -------- */}
        <div className="space-y-2">
          {state.extracted_tasks.map((t, i) => (
            <div
              key={`${t.summary}-${i}`}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-base-700 bg-base-900/60 px-4 py-3"
            >
              <ClipboardCheck size={16} className={executed ? "text-success" : "text-accent-400"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{t.summary}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {t.assignee || "Unassigned"} · due {t.due_date || "n/a"} · {t.issue_type}
                </p>
              </div>
              <Badge tone={PRIORITY_TONE[t.priority] ?? "neutral"}>{t.priority}</Badge>
            </div>
          ))}
        </div>

        {/* ---- Executed: read-only success state ---------------------------- */}
        {executed && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium text-success">
              <CheckCircle2 size={16} /> Approved &amp; written to CRM
            </p>
            {crmWrites.map((w, i) => (
              <ul key={i} className="mt-2 space-y-1 text-xs text-slate-400">
                {(w.detail?.tickets_created ?? []).map((tk: any) => (
                  <li key={tk.id} className="flex items-center gap-2">
                    <ServerCog size={12} className="text-slate-500" />
                    <span className="font-mono text-slate-300">{tk.id}</span> {tk.summary}
                  </li>
                ))}
              </ul>
            ))}
            {syncedTickets !== null && (
              <p className="mt-3 flex items-center gap-1.5 border-t border-success/20 pt-2.5 text-xs text-slate-400">
                {syncedTickets === "syncing" ? (
                  <>
                    <Loader2 size={12} className="animate-spin" /> Creating MeetPilot tickets…
                  </>
                ) : syncedTickets === "failed" ? (
                  <>
                    <AlertTriangle size={12} className="text-warning" /> Approved, but the in-app tickets
                    couldn&apos;t be created — check the Tickets page.
                  </>
                ) : (
                  <>
                    <Ticket size={12} className="text-success" />
                    {syncedTickets} ticket{syncedTickets === 1 ? "" : "s"} created in MeetPilot —{" "}
                    <a href="/tickets" className="font-medium text-accent-400 hover:underline">
                      view in Tickets
                    </a>
                  </>
                )}
              </p>
            )}
          </div>
        )}

        {/* ---- Action panel: only while the graph is parked at review ------- */}
        {state.status === "awaiting_review" && (
          <div className="mt-5 border-t border-base-700 pt-4">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">
              Request changes — feedback for the AI (required to reject)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && feedback.trim()) submitReview(false); }}
                placeholder='e.g. "Move the API deadline to Friday and make it high priority"'
                className="flex-1 rounded-xl border border-base-700 bg-base-900 px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-accent-500 focus:outline-none"
              />
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="secondary"
                  onClick={() => submitReview(false)}
                  disabled={busy !== null}
                >
                  <span className="flex items-center gap-1.5">
                    {busy === "reject" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Request changes
                  </span>
                </Button>
                <Button onClick={() => submitReview(true)} disabled={busy !== null}>
                  <span className="flex items-center gap-1.5">
                    {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Approve &amp; execute
                  </span>
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Nothing is written to Jira/HubSpot until a human approves. Rejections loop the
              draft back to the AI with your feedback and return here for re-review.
            </p>
          </div>
        )}
      </Card>

      {/* ---- Audit trail: the revision history / governance ledger ---------- */}
      <Card>
        <h4 className="mb-3 text-sm font-semibold">Audit trail</h4>
        <ol className="space-y-0">
          {state.audit_log.map((e, i) => (
            <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
              {i < state.audit_log.length - 1 && (
                <span className="absolute left-[11px] top-6 h-full w-px bg-base-700" aria-hidden />
              )}
              <AuditIcon actor={e.actor} />
              <div className="min-w-0 text-sm">
                <p className="text-slate-200">{auditLabel(e)}</p>
                {e.action === "request_changes" && e.detail?.feedback && (
                  <p className="mt-0.5 truncate text-xs italic text-slate-400">“{e.detail.feedback}”</p>
                )}
                <p className="mt-0.5 text-xs text-slate-500">
                  {new Date(e.ts).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
                  })}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

// ---- Small presentational pieces -------------------------------------------
function SectionHeader({
  status,
  revisionCount,
}: {
  status: MeetingState["status"] | null;
  revisionCount: number;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck size={16} className="text-accent-400" /> AI task review
        <span className="font-normal text-slate-500">· human-in-the-loop gate</span>
      </h4>
      <div className="flex items-center gap-2">
        {revisionCount > 0 && <Badge tone="accent">rev {revisionCount}</Badge>}
        {status === "awaiting_review" && <Badge tone="warning">Awaiting review</Badge>}
        {status === "executed" && <Badge tone="success">Executed</Badge>}
        {status === "in_progress" && <Badge tone="neutral">In progress</Badge>}
        {status === null && <Badge tone="neutral">Not started</Badge>}
      </div>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
      <span className="flex items-start gap-2">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {message}
      </span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <XCircle size={15} />
      </button>
    </div>
  );
}

function AuditIcon({ actor }: { actor: string }) {
  const map: Record<string, { icon: typeof Bot; cls: string }> = {
    agent: { icon: Bot, cls: "bg-accent-500/15 text-accent-400" },
    human: { icon: UserCheck, cls: "bg-warning/15 text-warning" },
    system: { icon: ServerCog, cls: "bg-success/15 text-success" },
  };
  const { icon: Icon, cls } = map[actor] ?? map.agent;
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`}>
      <Icon size={13} />
    </span>
  );
}

function auditLabel(e: AuditEntry): string {
  switch (e.action) {
    case "extract_tasks":
      return `AI extracted ${e.detail?.task_count ?? "?"} task(s) from the transcript`;
    case "revise_tasks":
      return `AI revised the draft (${e.detail?.task_count ?? "?"} task(s)) per feedback`;
    case "request_changes":
      return "Human requested changes";
    case "approve":
      return "Human approved the draft";
    case "crm_write":
      return `Wrote ${e.detail?.count ?? "?"} ticket(s) to the CRM`;
    default:
      return `${e.actor}: ${e.action}`;
  }
}
