"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { History, ShieldCheck, Send } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";
import { Card, Badge, Tabs, Avatar, Button, Modal } from "@/components/ui";
import {
  getMeeting, findPreviousMeetingForGroup, listActionItemsForMeeting, getUser,
} from "@/lib/mock/store";

const PIE_COLORS = ["#6d5bf8", "#2e5aac", "#22c55e", "#f59e0b", "#ef4444"];

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  OPEN: "neutral", IN_PROGRESS: "warning", DONE: "success", BLOCKED: "danger",
};

export default function MeetingHubPage({ params }: { params: { id: string } }) {
  const meeting = getMeeting(params.id);
  const [pushModalItem, setPushModalItem] = useState<string | null>(null);
  const [pushed, setPushed] = useState<Record<string, string>>({});

  if (!meeting) return notFound();

  const previous = findPreviousMeetingForGroup(meeting);
  const actionItems = listActionItemsForMeeting(meeting.id);
  const s = meeting.summary;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{meeting.title}</h1>
        <Badge tone={meeting.status === "COMPLETED" ? "success" : "accent"}>{meeting.status.replace("_", " ")}</Badge>
      </div>
      <p className="mb-5 text-sm text-slate-400">
        {new Date(meeting.startTime).toLocaleString()} · {meeting.type}
      </p>

      {previous ? (
        <Card className="mb-6 border-accent-500/40 bg-accent-500/5">
          <div className="flex items-start gap-3">
            <History size={18} className="mt-0.5 text-accent-400" />
            <div className="text-sm">
              <span className="font-medium text-accent-400">MoM recall — </span>
              this exact group last met on{" "}
              <span className="font-medium">{new Date(previous.startTime).toLocaleDateString()}</span> for "
              {previous.title}". Key decisions carried forward:
              <ul className="mt-2 list-disc pl-5 text-slate-300">
                {previous.summary?.keyDecisions.slice(0, 2).map((d) => <li key={d}>{d}</li>)}
              </ul>
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
            key: "agenda",
            label: "Agenda",
            content: (
              <Card>
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
                  {meeting.agenda.map((a) => <li key={a}>{a}</li>)}
                </ul>
              </Card>
            ),
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
                    {s.keyDecisions.map((d) => <li key={d}>{d}</li>)}
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
                  const isPushed = !!pushed[item.id] || !!item.syncedProvider;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{item.description}</div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          {assignee && (
                            <span className="flex items-center gap-1">
                              <Avatar name={assignee.name} color={assignee.avatarColor} size={16} /> {assignee.name}
                            </span>
                          )}
                          {item.dueDate && <span>Due {item.dueDate}</span>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge tone={STATUS_TONE[item.status]}>{item.status.replace("_", " ")}</Badge>
                        {isPushed ? (
                          <Badge tone="accent">
                            {pushed[item.id] ?? item.syncedProvider} · {item.syncedTicketId ?? "queued"}
                          </Badge>
                        ) : (
                          <Button variant="secondary" onClick={() => setPushModalItem(item.id)}>
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
                        {s.talkTimeByUser.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
                    <BarChart data={s.topics} layout="vertical">
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
        <p className="mb-4 text-sm text-slate-400">Choose a destination tool. Assignee and description carry over automatically.</p>
        <div className="flex flex-col gap-2">
          {["Jira", "Linear", "Asana"].map((tool) => (
            <button
              key={tool}
              onClick={() => {
                if (pushModalItem) setPushed((p) => ({ ...p, [pushModalItem]: tool }));
                setPushModalItem(null);
              }}
              className="rounded-xl border border-base-700 px-4 py-3 text-left text-sm hover:border-accent-500 hover:bg-accent-500/10"
            >
              Push to <span className="font-medium">{tool}</span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
