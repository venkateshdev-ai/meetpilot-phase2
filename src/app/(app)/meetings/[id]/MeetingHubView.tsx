"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, ShieldCheck, Send, Video, Mic, FileSpreadsheet } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Card, Badge, Tabs, Avatar, Button, Modal } from "@/components/ui";
import type { DbMeeting, DbActionItem, DbUser } from "@/lib/db/store";
import UploadPanel from "./UploadPanel";
import MomPanel from "./MomPanel";

const PIE_COLORS = ["#6d5bf8", "#2e5aac", "#22c55e", "#f59e0b", "#ef4444"];

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  OPEN: "neutral", IN_PROGRESS: "warning", DONE: "success", BLOCKED: "danger",
};

function colorFor(id: string) {
  const AVATAR_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#6d5bf8", "#2e5aac", "#94a3b8"];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export interface MeetingHubProps {
  meeting: DbMeeting;
  agenda: string[];
  summary: any | null;
  previous: DbMeeting | null;
  participantIds: string[];
  usersById: Record<string, DbUser>;
  actionItems: DbActionItem[];
  transcript: { speakerUserId: string | null; text: string; tMinutes: number }[];
}

export default function MeetingHubView({
  meeting, agenda, summary: s, previous, participantIds, usersById, actionItems: initialActionItems, transcript,
}: MeetingHubProps) {
  const router = useRouter();
  const [pushModalItem, setPushModalItem] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState(initialActionItems);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [creatingTicketFor, setCreatingTicketFor] = useState<string | null>(null);

  const getUser = (id: string | null | undefined) => (id ? usersById[id] : undefined);

  // Turns an action item into a full Ticket (Description/Why/Feature/Test
  // cases/Acceptance/Telemetry/Success metric) pre-linked to this meeting,
  // then drops the user straight into the ticket's edit page to fill in the
  // rest and optionally push it to a connected PM tool.
  async function handleConvertToTicket(item: DbActionItem) {
    setCreatingTicketFor(item.id);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.description,
          meetingId: meeting.id,
          actionItemId: item.id,
          assigneeId: item.assigneeId,
        }),
      });
      if (res.ok) {
        const ticket = await res.json();
        router.push(`/tickets/${ticket.id}`);
      }
    } finally {
      setCreatingTicketFor(null);
    }
  }

  async function handlePush(itemId: string, tool: "JIRA" | "LINEAR" | "ASANA") {
    setPushingId(itemId);
    try {
      const res = await fetch(`/api/action-items/${itemId}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: tool }),
      });
      if (res.ok) {
        const updated = await res.json();
        setActionItems((prev) => prev.map((a) => (a.id === itemId ? updated : a)));
      }
    } finally {
      setPushingId(null);
      setPushModalItem(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-2xl font-bold">{meeting.title}</h1>
      <p className="mb-5 text-sm text-slate-400">
        {new Date(meeting.startTime).toLocaleString("en-US", {
          month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        })}{" "}
        · {meeting.type}
      </p>

      {previous ? (
        <Card className="mb-6 border-accent-500/40 bg-accent-500/5">
          <div className="flex items-start gap-3">
            <History size={18} className="mt-0.5 text-accent-400" />
            <div className="text-sm">
              <span className="font-medium text-accent-400">MoM recall — </span>
              this exact group last met on{" "}
              <span className="font-medium">{new Date(previous.startTime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>. Key
              decisions carried forward are in that meeting's summary tab.
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-6 border-base-700 bg-base-800/40">
          <div className="flex items-start gap-3 text-sm text-slate-400">
            <History size={18} className="mt-0.5" />
            <span>
              First time this group is meeting — no prior MoM found. A prep brief has been generated from
              participants' calendars and roles instead.
            </span>
          </div>
        </Card>
      )}

      <Tabs
        tabs={[
          {
            key: "call",
            label: "Call",
            content: (
              <div className="space-y-4">
                {/* FRD "MoM Window side": live video on the left, the MoM notes
                    panel (agenda / discussion items / action items with Done
                    toggles + Save/Share) alongside it on the right. */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr,360px]">
                  <Card>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">Video call</h4>
                      {meeting.meetLink && (
                        <a href={meeting.meetLink} target="_blank" rel="noreferrer">
                          <Button>
                            <span className="flex items-center gap-1.5"><Video size={14} /> Open in new tab</span>
                          </Button>
                        </a>
                      )}
                    </div>
                    {participantIds.length > 0 && (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">Invited:</span>
                        {participantIds.map((id) => {
                          const p = getUser(id);
                          if (!p) return null;
                          return (
                            <span key={id} className="flex items-center gap-1.5 rounded-full bg-base-900 py-1 pl-1 pr-2.5 text-xs text-slate-300">
                              <Avatar name={p.name ?? p.email} color={colorFor(p.id)} size={18} /> {p.name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {meeting.meetLink ? (
                      <div className="overflow-hidden rounded-xl border border-base-700 bg-base-900">
                        <iframe
                          src={`${meeting.meetLink}#config.prejoinPageEnabled=false`}
                          allow="camera; microphone; fullscreen; display-capture; autoplay"
                          className="aspect-video w-full"
                          style={{ border: 0 }}
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        This is an in-person meeting — no video room was created for it.
                      </p>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      Hosted via {meeting.callProvider ?? "MeetPilot Video"} — a real, live video room (camera, mic,
                      screen share, chat), free with no account needed.
                    </p>
                  </Card>
                  <MomPanel
                    meetingId={meeting.id}
                    meetingTitle={meeting.title}
                    initialAgenda={agenda}
                    initialDiscussedItems={s?.keyDecisions ?? []}
                    actionItems={actionItems}
                    usersById={usersById}
                    onActionItemUpdated={(updated) =>
                      setActionItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                    }
                  />
                </div>
                <Card>
                  <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
                    <Mic size={14} /> Live transcript
                  </h4>
                  {transcript.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      Transcript will appear here once the call starts real-time transcription (mock).
                    </p>
                  ) : (
                    <div className="max-h-64 space-y-3 overflow-y-auto">
                      {transcript.map((seg, i) => {
                        const speaker = getUser(seg.speakerUserId);
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            {speaker && <Avatar name={speaker.name ?? speaker.email} color={colorFor(speaker.id)} size={20} />}
                            <div>
                              <span className="mr-1.5 text-xs text-slate-500">{seg.tMinutes.toFixed(1)}m</span>
                              <span className="font-medium text-slate-200">{speaker?.name ?? "Unknown"}:</span>{" "}
                              <span className="text-slate-300">{seg.text}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            key: "agenda",
            label: "Agenda",
            content: (
              <Card>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                  {agenda.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </Card>
            ),
          },
          {
            key: "upload",
            label: "Upload",
            content: <UploadPanel meetingId={meeting.id} />,
          },
          {
            key: "summary",
            label: "Summary",
            content: s ? (
              <Card className="space-y-4">
                {!s.consentGiven && (
                  <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                    <ShieldCheck size={14} /> Recording consent was not captured for this meeting.
                  </div>
                )}
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Executive summary</h4>
                  <p className="text-sm text-slate-300">{s.executiveSummary}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Key decisions</h4>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {(s.keyDecisions ?? []).map((d: string) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              </Card>
            ) : (
              <Card className="text-sm text-slate-400">Summary will generate once the meeting has taken place.</Card>
            ),
          },
          {
            key: "actions",
            label: "Action Items",
            content: (
              <Card className="divide-y divide-base-700 p-0">
                {actionItems.length === 0 && <div className="p-5 text-sm text-slate-400">No action items yet.</div>}
                {actionItems.map((item) => {
                  const assignee = item.assigneeId ? getUser(item.assigneeId) : undefined;
                  const isPushed = !!item.syncedProvider;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{item.description}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          {assignee && (
                            <span className="flex items-center gap-1">
                              <Avatar name={assignee.name ?? assignee.email} color={colorFor(assignee.id)} size={16} /> {assignee.name}
                            </span>
                          )}
                          {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={STATUS_TONE[item.status]}>{item.status.replace("_", " ")}</Badge>
                        <Button
                          variant="secondary"
                          onClick={() => handleConvertToTicket(item)}
                          disabled={creatingTicketFor === item.id}
                        >
                          <span className="flex items-center gap-1.5">
                            <FileSpreadsheet size={13} /> {creatingTicketFor === item.id ? "Creating…" : "To ticket"}
                          </span>
                        </Button>
                        {isPushed ? (
                          <Badge tone="accent">
                            {item.syncedProvider} · {item.syncedTicketId ?? "queued"}
                          </Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            onClick={() => setPushModalItem(item.id)}
                            disabled={pushingId === item.id}
                          >
                            <span className="flex items-center gap-1.5"><Send size={13} /> Push</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </Card>
            ),
          },
          {
            key: "tickets",
            label: "Tickets Created",
            content: (
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr className="border-b border-base-700">
                      <th className="p-3">Provider</th>
                      <th className="p-3">Ticket</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Assignee</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionItems.filter((a) => a.syncedProvider).map((a) => {
                      const assignee = a.assigneeId ? getUser(a.assigneeId) : undefined;
                      return (
                        <tr key={a.id} className="border-b border-base-700/60">
                          <td className="p-3">{a.syncedProvider}</td>
                          <td className="p-3 font-mono text-xs text-accent-400">{a.syncedTicketId}</td>
                          <td className="p-3">{a.description}</td>
                          <td className="p-3">{assignee?.name ?? "—"}</td>
                          <td className="p-3"><Badge>{a.syncedStatus}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            ),
          },
          {
            key: "analysis",
            label: "Analysis Report",
            content: s ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                  <h4 className="mb-3 text-sm font-semibold">Meeting sentiment trend</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={s.sentimentTrend}>
                      <XAxis dataKey="t" stroke="#64748b" fontSize={11} />
                      <YAxis hide domain={[0, 1]} />
                      <Tooltip contentStyle={{ background: "#101627", border: "1px solid #1a2138" }} />
                      <Line type="monotone" dataKey="score" stroke="#6d5bf8" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <h4 className="mb-3 text-sm font-semibold">Talk time distribution</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={s.talkTimeByUser} dataKey="minutes" nameKey="userId" innerRadius={40} outerRadius={65}>
                        {(s.talkTimeByUser ?? []).map((_: unknown, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#101627", border: "1px solid #1a2138" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <h4 className="mb-3 text-sm font-semibold">Meeting ROI</h4>
                  <div className="flex h-40 flex-col items-center justify-center">
                    <div className="text-4xl font-bold text-accent-400">{s.meetingRoiPercent}%</div>
                    <div className="text-xs text-slate-500">time on-goal vs. spent</div>
                  </div>
                </Card>
                <Card>
                  <h4 className="mb-3 text-sm font-semibold">Frequent topics</h4>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={s.topicsJson ?? s.topics} layout="vertical">
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="topic" stroke="#64748b" fontSize={11} width={90} />
                      <Tooltip contentStyle={{ background: "#101627", border: "1px solid #1a2138" }} />
                      <Bar dataKey="weight" fill="#2e5aac" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            ) : (
              <Card className="text-sm text-slate-400">Analysis will generate once the meeting has taken place.</Card>
            ),
          },
        ]}
      />

      <Modal open={!!pushModalItem} onClose={() => setPushModalItem(null)} title="Push action item">
        <p className="mb-4 text-sm text-slate-400">
          Choose a destination tool. This writes a real status/ticket-id update to this action item — the ticket ID
          itself is generated locally, not from a live Jira/Asana/Linear call (no OAuth app configured yet).
        </p>
        <div className="flex flex-col gap-2">
          {(["JIRA", "LINEAR", "ASANA"] as const).map((tool) => (
            <button
              key={tool}
              disabled={!!pushingId}
              onClick={() => pushModalItem && handlePush(pushModalItem, tool)}
              className="rounded-xl border border-base-700 px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-accent-500/10 disabled:opacity-50"
            >
              Push to <span className="font-medium">{tool[0]}{tool.slice(1).toLowerCase()}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
