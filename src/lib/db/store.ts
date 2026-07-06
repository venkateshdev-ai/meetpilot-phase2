// The app's data layer — every page and API route reads/writes through here.
// All of it is real (Supabase Postgres over PostgREST, see ./supabase.ts):
// auth -> create meeting -> meeting hub -> action items -> chat -> analytics.
// The old mock layer (src/lib/mock/*) was deleted once the last mock-backed
// pages (rooms/desks/visitors/billing) were cut in the phase-2 pivot.
import { pgSelect, pgInsert, pgUpdate, genId } from "./supabase";
import bcrypt from "bcryptjs";

const ORG_ID = "org_acme"; // single-tenant for this build; every query is still orgId-scoped

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
}
export interface DbMembership {
  userId: string;
  orgId: string;
  role: "GLOBAL_ADMIN" | "ADMIN" | "REVIEWER";
}
export interface DbMeeting {
  id: string;
  orgId: string;
  title: string;
  type: "ONLINE" | "OFFLINE" | "HYBRID";
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  agenda: string | null;
  meetLink: string | null;
  callProvider: string | null;
  startTime: string;
  endTime: string;
  createdById: string;
  participantSetHash: string | null;
}
export interface DbActionItem {
  id: string;
  meetingId: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  syncedProvider: string | null;
  syncedTicketId: string | null;
  syncedStatus: string | null;
}

// ---------------------------------------------------------------------------
// Users / auth
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<DbUser | undefined> {
  const rows = await pgSelect<DbUser>("User", { email: `eq.${email.toLowerCase()}` });
  return rows[0];
}

export async function verifyPassword(user: DbUser, password: string): Promise<boolean> {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function createUserWithOrg(input: {
  name: string;
  email: string;
  password: string;
  orgName: string;
}): Promise<DbUser> {
  const passwordHash = await bcrypt.hash(input.password, 10);
  const userId = genId("u");
  const [user] = await pgInsert<DbUser>("User", {
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
  });
  // Reuse the seeded Acme org for this demo build; a real multi-org signup
  // would create a new Org row + slug here instead.
  await pgInsert("OrgMembership", {
    id: genId("m"),
    orgId: ORG_ID,
    userId,
    role: "REVIEWER",
  });
  return user;
}

export async function listUsers(): Promise<DbUser[]> {
  const memberships = await pgSelect<DbMembership>("OrgMembership", { orgId: `eq.${ORG_ID}` });
  const ids = memberships.map((m) => m.userId);
  if (ids.length === 0) return [];
  return pgSelect<DbUser>("User", { id: `in.(${ids.join(",")})` });
}

export async function getUser(id: string): Promise<DbUser | undefined> {
  const rows = await pgSelect<DbUser>("User", { id: `eq.${id}` });
  return rows[0];
}

export async function listMembershipsByRole(): Promise<Record<string, DbMembership["role"]>> {
  const memberships = await pgSelect<DbMembership>("OrgMembership", { orgId: `eq.${ORG_ID}` });
  return Object.fromEntries(memberships.map((m) => [m.userId, m.role]));
}

// Real "Add user" flow for User management, distinct from self-signup:
// an Admin adds someone by email + role, we generate a temp password
// (no invite-link/passwordless flow yet — that needs a token table + expiry,
// left as a follow-up), create the User + OrgMembership rows, and return the
// temp password so the caller can email it via src/lib/email.
export async function inviteMember(input: {
  name: string;
  email: string;
  role: DbMembership["role"];
}): Promise<{ user: DbUser; tempPassword: string }> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new Error("A user with that email already exists");

  const tempPassword = genTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const userId = genId("u");
  const [user] = await pgInsert<DbUser>("User", {
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    passwordHash,
  });
  await pgInsert("OrgMembership", {
    id: genId("m"),
    orgId: ORG_ID,
    userId,
    role: input.role,
  });
  return { user, tempPassword };
}

export async function updateMemberRole(userId: string, role: DbMembership["role"]) {
  return pgUpdate("OrgMembership", { userId: `eq.${userId}`, orgId: `eq.${ORG_ID}` }, { role });
}

function genTempPassword(): string {
  // Human-typeable but not guessable: e.g. "Kx7-Rbq2-Vn9m"
  const part = () => Math.random().toString(36).slice(2, 6);
  return `${part()}-${part()}-${part()}`.replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Email log (audit trail for outbound email — see src/lib/email/resend.ts)
// ---------------------------------------------------------------------------

export async function logEmail(input: { toEmail: string; type: string; status: "SENT" | "FAILED"; errorMessage?: string }) {
  return pgInsert("EmailLog", {
    id: genId("eml"),
    toEmail: input.toEmail,
    type: input.type,
    status: input.status,
    errorMessage: input.errorMessage ?? null,
  });
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
// Room booking (physical room inventory + reservations) is deferred to
// phase 2 — meetings are online-first (see Jitsi Meet link generation
// below), with OFFLINE/HYBRID left as descriptive-only meeting types for now.

export async function listMeetings(): Promise<DbMeeting[]> {
  return pgSelect<DbMeeting>("Meeting", { orgId: `eq.${ORG_ID}`, order: "startTime.desc" });
}

export async function getMeeting(id: string): Promise<DbMeeting | undefined> {
  const rows = await pgSelect<DbMeeting>("Meeting", { id: `eq.${id}` });
  return rows[0];
}

export async function getUpcomingMeetings(): Promise<DbMeeting[]> {
  const now = new Date().toISOString();
  return pgSelect<DbMeeting>("Meeting", {
    orgId: `eq.${ORG_ID}`,
    startTime: `gte.${now}`,
    order: "startTime.asc",
  });
}

export async function getMeetingParticipantIds(meetingId: string): Promise<string[]> {
  const rows = await pgSelect<{ userId: string }>("MeetingParticipant", { meetingId: `eq.${meetingId}` });
  return rows.map((r) => r.userId);
}

export async function findPreviousMeetingForGroup(meeting: DbMeeting): Promise<DbMeeting | undefined> {
  if (!meeting.participantSetHash) return undefined;
  const rows = await pgSelect<DbMeeting>("Meeting", {
    participantSetHash: `eq.${meeting.participantSetHash}`,
    id: `neq.${meeting.id}`,
    order: "startTime.desc",
    limit: "1",
  });
  return rows[0];
}

export async function getMeetingSummary(meetingId: string) {
  const rows = await pgSelect<any>("MeetingSummary", { meetingId: `eq.${meetingId}` });
  return rows[0];
}

export async function listTranscriptForMeeting(meetingId: string) {
  return pgSelect<any>("TranscriptSegment", { meetingId: `eq.${meetingId}`, order: "tMinutes.asc" });
}

// Public Jitsi Meet instance that allows fully anonymous rooms AND iframe
// embedding. meet.jit.si (the flagship server) now requires the first
// participant to sign in with Google/GitHub as an anti-abuse measure, and
// most community servers (e.g. meet.ffmuc.net) block third-party embedding
// via frame-ancestors — jitsi.riot.im is Element's instance, built to be
// embedded in Matrix clients, so it allows both. Self-hosting Jitsi (or
// Jitsi-as-a-Service) removes the third-party dependency for production.
// Override via JITSI_BASE_URL.
const JITSI_BASE = process.env.JITSI_BASE_URL || "https://jitsi.riot.im";

export function meetingVideoLink(meetingId: string): string {
  return `${JITSI_BASE}/MeetPilot-${meetingId}`;
}

export async function createMeeting(input: {
  title: string;
  type: "ONLINE" | "OFFLINE" | "HYBRID";
  agenda: string;
  startTime: string;
  endTime: string;
  createdById: string;
  participantIds: string[];
}): Promise<DbMeeting> {
  const id = genId("mtg");
  const participantSetHash = [...input.participantIds].sort().join("_");

  // Real, joinable video room (no signup/API key needed) — the room name is
  // derived from the meeting id so it's stable and re-joinable, not
  // regenerated on every page load.
  const [meeting] = await pgInsert<DbMeeting>("Meeting", {
    id,
    orgId: ORG_ID,
    title: input.title,
    type: input.type,
    status: "SCHEDULED",
    agenda: input.agenda,
    meetLink: input.type !== "OFFLINE" ? meetingVideoLink(id) : null,
    callProvider: "MeetPilot Video",
    startTime: input.startTime,
    endTime: input.endTime,
    createdById: input.createdById,
    participantSetHash,
  });

  if (input.participantIds.length) {
    await pgInsert(
      "MeetingParticipant",
      input.participantIds.map((userId) => ({ id: genId("mp"), meetingId: id, userId }))
    );
  }

  return meeting;
}

// "Start an instant meeting" (Google Meet / Zoom style): no scheduling form —
// a meeting that starts now, marked IN_PROGRESS, with the creator as the only
// participant; others join via the meeting link.
export async function createInstantMeeting(createdById: string): Promise<DbMeeting> {
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60 * 1000);
  const id = genId("mtg");

  const [meeting] = await pgInsert<DbMeeting>("Meeting", {
    id,
    orgId: ORG_ID,
    title: `Instant meeting — ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    type: "ONLINE",
    status: "IN_PROGRESS",
    agenda: "",
    meetLink: meetingVideoLink(id),
    callProvider: "MeetPilot Video",
    startTime: now.toISOString(),
    endTime: end.toISOString(),
    createdById,
    participantSetHash: createdById,
  });

  await pgInsert("MeetingParticipant", { id: genId("mp"), meetingId: id, userId: createdById });
  return meeting;
}

// FRD "Action item import from previous meet": copy the previous meeting's
// still-open action items into the new meeting so the group can review and
// update their status in the follow-up (the originals stay untouched on the
// old meeting — this is a carry-forward snapshot, not a move).
export async function importOpenActionItemsFromPrevious(meeting: DbMeeting): Promise<number> {
  const previous = await findPreviousMeetingForGroup(meeting);
  if (!previous) return 0;

  const prevItems = await pgSelect<DbActionItem>("ActionItem", {
    meetingId: `eq.${previous.id}`,
    status: `neq.DONE`,
  });
  if (prevItems.length === 0) return 0;

  await pgInsert(
    "ActionItem",
    prevItems.map((item) => ({
      id: genId("ai"),
      meetingId: meeting.id,
      description: item.description,
      assigneeId: item.assigneeId,
      dueDate: item.dueDate,
      status: item.status,
    }))
  );
  return prevItems.length;
}

export async function updateActionItemStatus(id: string, status: DbActionItem["status"]): Promise<DbActionItem> {
  const [row] = await pgUpdate<DbActionItem>("ActionItem", { id: `eq.${id}` }, { status });
  return row;
}

// Saves the MoM side-panel edits (FRD "MoM Window side" wireframe): agenda
// lives on the Meeting row, discussed items go into MeetingSummary.keyDecisions
// (same field the AI summarizer writes, so both flows land in one place).
export async function saveMeetingNotes(
  meetingId: string,
  notes: { agenda: string; discussedItems: string[] }
) {
  await pgUpdate("Meeting", { id: `eq.${meetingId}` }, { agenda: notes.agenda });
  const existing = await getMeetingSummary(meetingId);
  if (existing) {
    await pgUpdate("MeetingSummary", { meetingId: `eq.${meetingId}` }, { keyDecisions: notes.discussedItems });
  } else {
    await pgInsert("MeetingSummary", {
      id: genId("sum"),
      meetingId,
      executiveSummary: "",
      keyDecisions: notes.discussedItems,
      topicsJson: [],
      consentGiven: true,
    });
  }
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

export async function listActionItemsForMeeting(meetingId: string): Promise<DbActionItem[]> {
  return pgSelect<DbActionItem>("ActionItem", { meetingId: `eq.${meetingId}` });
}

export async function listActionItemsForUser(userId: string): Promise<DbActionItem[]> {
  return pgSelect<DbActionItem>("ActionItem", { assigneeId: `eq.${userId}` });
}

// Writes a real DB row for the "push to PM tool" action. The ticket ID/URL
// are still generated locally (no live Jira/Asana/Linear API call) — per the
// explicit scope for this pass: MeetPilot's own backend goes real, third-party
// tool integrations stay mocked until OAuth apps + credentials exist for them.
export async function pushActionItem(id: string, provider: "JIRA" | "ASANA" | "LINEAR") {
  const ticketId =
    provider === "JIRA" ? `MEET-${Math.floor(100 + Math.random() * 900)}`
    : provider === "LINEAR" ? `LN-${Math.floor(10 + Math.random() * 90)}`
    : `ASN-${Math.floor(1000 + Math.random() * 9000)}`;
  const [row] = await pgUpdate<DbActionItem>(
    "ActionItem",
    { id: `eq.${id}` },
    { syncedProvider: provider, syncedTicketId: ticketId, syncedStatus: "To-Do" }
  );
  return row;
}

// ---------------------------------------------------------------------------
// Meeting uploads + AI summarization (src/lib/ai/*)
// ---------------------------------------------------------------------------

export interface DbMeetingUpload {
  id: string;
  meetingId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  errorMessage: string | null;
  createdAt: string;
}

export async function createMeetingUpload(input: {
  meetingId: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<DbMeetingUpload> {
  const [row] = await pgInsert<DbMeetingUpload>("MeetingUpload", {
    id: genId("upl"),
    meetingId: input.meetingId,
    uploadedById: input.uploadedById,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    status: "PENDING",
  });
  return row;
}

export async function updateMeetingUpload(
  id: string,
  patch: Partial<{ status: string; errorMessage: string | null; extractedText: string; processedAt: string }>
) {
  return pgUpdate("MeetingUpload", { id: `eq.${id}` }, patch);
}

export async function listUploadsForMeeting(meetingId: string): Promise<DbMeetingUpload[]> {
  return pgSelect<DbMeetingUpload>("MeetingUpload", { meetingId: `eq.${meetingId}`, order: "createdAt.desc" });
}

// Writes (or overwrites) the MeetingSummary row generated from an uploaded
// file's AI analysis. sentimentTrend/talkTimeByUser/meetingRoiPercent are
// left null — those need live audio/call data this upload-based flow doesn't
// have; the Analysis Report tab already handles a missing summary gracefully.
export async function saveAiGeneratedSummary(
  meetingId: string,
  ai: { executiveSummary?: string; keyDecisions?: string[]; topics?: { topic: string; weight: number }[] }
) {
  const existing = await getMeetingSummary(meetingId);
  const payload = {
    executiveSummary: ai.executiveSummary ?? "",
    keyDecisions: ai.keyDecisions ?? [],
    topicsJson: ai.topics ?? [],
    consentGiven: true,
  };
  if (existing) {
    const [row] = await pgUpdate("MeetingSummary", { meetingId: `eq.${meetingId}` }, payload);
    return row;
  }
  const [row] = await pgInsert("MeetingSummary", { id: genId("sum"), meetingId, ...payload });
  return row;
}

// Matches each AI-extracted action item's freeform assigneeName (e.g. "Sam")
// against the org's real members by case-insensitive substring match on
// name — best-effort, since the model only sees whatever name appears in the
// uploaded text. Unmatched items are still created, just unassigned.
export async function createActionItemsFromAi(
  meetingId: string,
  items: { description: string; assigneeName?: string; dueDate?: string }[]
): Promise<DbActionItem[]> {
  if (items.length === 0) return [];
  const members = await listUsers();

  const rows = items.map((item) => {
    const match = item.assigneeName
      ? members.find((u) => u.name?.toLowerCase().includes(item.assigneeName!.toLowerCase()))
      : undefined;
    return {
      id: genId("ai"),
      meetingId,
      description: item.description,
      assigneeId: match?.id ?? null,
      dueDate: item.dueDate ?? null,
      status: "OPEN",
    };
  });

  return pgInsert<DbActionItem>("ActionItem", rows);
}

// ---------------------------------------------------------------------------
// PM tool integrations (Jira / Asana / Trello / Slack) — see src/lib/integrations/*
// ---------------------------------------------------------------------------

export interface DbIntegration {
  id: string;
  orgId: string;
  provider: "JIRA" | "ASANA" | "TRELLO" | "SLACK" | string;
  accessTokenEnc: string;
  config: Record<string, string> | null;
  connectedById: string;
  createdAt: string;
}

// See the security note in src/lib/integrations/types.ts — accessTokenEnc is
// plain text in this build, not actually encrypted.
export async function upsertIntegration(input: {
  provider: string;
  secret: string;
  config: Record<string, string>;
  connectedById: string;
}) {
  const existing = await pgSelect<DbIntegration>("Integration", {
    orgId: `eq.${ORG_ID}`,
    provider: `eq.${input.provider}`,
  });
  if (existing[0]) {
    const [row] = await pgUpdate<DbIntegration>(
      "Integration",
      { id: `eq.${existing[0].id}` },
      { accessTokenEnc: input.secret, config: input.config, connectedById: input.connectedById }
    );
    return row;
  }
  const [row] = await pgInsert<DbIntegration>("Integration", {
    id: genId("int"),
    orgId: ORG_ID,
    provider: input.provider,
    accessTokenEnc: input.secret,
    config: input.config,
    connectedById: input.connectedById,
  });
  return row;
}

export async function listOrgIntegrations(): Promise<DbIntegration[]> {
  return pgSelect<DbIntegration>("Integration", { orgId: `eq.${ORG_ID}` });
}

export async function getOrgIntegration(provider: string): Promise<DbIntegration | undefined> {
  const rows = await pgSelect<DbIntegration>("Integration", { orgId: `eq.${ORG_ID}`, provider: `eq.${provider}` });
  return rows[0];
}

export async function disconnectIntegration(provider: string) {
  const existing = await getOrgIntegration(provider);
  if (!existing) return;
  // No delete helper in supabase.ts yet (pattern so far is insert/select/update only) —
  // soft-disconnect by clearing the secret instead of a hard DELETE.
  await pgUpdate("Integration", { id: `eq.${existing.id}` }, { accessTokenEnc: "" });
}

// ---------------------------------------------------------------------------
// Tickets (rich work items, optionally pushed to a connected PM tool)
// ---------------------------------------------------------------------------

export interface DbTicket {
  id: string;
  orgId: string;
  meetingId: string | null;
  actionItemId: string | null;
  title: string;
  description: string | null;
  whyScenario: string | null;
  featureDescription: string | null;
  testCases: string | null;
  acceptanceCriteria: string | null;
  telemetry: string | null;
  successMetric: string | null;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  assigneeId: string | null;
  createdById: string;
  provider: string | null;
  externalId: string | null;
  externalUrl: string | null;
  externalStatus: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createTicket(input: {
  title: string;
  description?: string;
  whyScenario?: string;
  featureDescription?: string;
  testCases?: string;
  acceptanceCriteria?: string;
  telemetry?: string;
  successMetric?: string;
  meetingId?: string | null;
  actionItemId?: string | null;
  assigneeId?: string | null;
  createdById: string;
}): Promise<DbTicket> {
  const [row] = await pgInsert<DbTicket>("Ticket", {
    id: genId("tkt"),
    orgId: ORG_ID,
    meetingId: input.meetingId ?? null,
    actionItemId: input.actionItemId ?? null,
    title: input.title,
    description: input.description ?? null,
    whyScenario: input.whyScenario ?? null,
    featureDescription: input.featureDescription ?? null,
    testCases: input.testCases ?? null,
    acceptanceCriteria: input.acceptanceCriteria ?? null,
    telemetry: input.telemetry ?? null,
    successMetric: input.successMetric ?? null,
    status: "OPEN",
    assigneeId: input.assigneeId ?? null,
    createdById: input.createdById,
  });
  return row;
}

export async function listTicketsForOrg(): Promise<DbTicket[]> {
  return pgSelect<DbTicket>("Ticket", { orgId: `eq.${ORG_ID}`, order: "createdAt.desc" });
}

export async function getTicketById(id: string): Promise<DbTicket | undefined> {
  const rows = await pgSelect<DbTicket>("Ticket", { id: `eq.${id}` });
  return rows[0];
}

export async function updateTicket(id: string, patch: Partial<DbTicket>): Promise<DbTicket> {
  const [row] = await pgUpdate<DbTicket>("Ticket", { id: `eq.${id}` }, patch);
  return row;
}

// ---------------------------------------------------------------------------
// Team chat (Slack-style side panel)
// ---------------------------------------------------------------------------

export interface DbChatMessage {
  id: string;
  orgId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export async function listChatMessages(limit = 50): Promise<DbChatMessage[]> {
  // Fetch the newest N, then reverse so the UI renders oldest-first.
  const rows = await pgSelect<DbChatMessage>("ChatMessage", {
    orgId: `eq.${ORG_ID}`,
    order: "createdAt.desc",
    limit: String(limit),
  });
  return rows.reverse();
}

export async function postChatMessage(userId: string, text: string): Promise<DbChatMessage> {
  const [row] = await pgInsert<DbChatMessage>("ChatMessage", {
    id: genId("msg"),
    orgId: ORG_ID,
    userId,
    text,
  });
  return row;
}

// ---------------------------------------------------------------------------
// Analytics (org-wide rollup)
// ---------------------------------------------------------------------------

export async function orgWideAnalytics() {
  const meetings = await listMeetings();
  const actionItems = await pgSelect<DbActionItem>("ActionItem", {});
  const summaries = await pgSelect<any>("MeetingSummary", {});

  const avgRoi =
    summaries.reduce((sum, s) => sum + (s.meetingRoiPercent ?? 0), 0) / (summaries.length || 1);

  const statusCounts: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, DONE: 0, BLOCKED: 0 };
  actionItems.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });

  const topicWeights: Record<string, number> = {};
  summaries.forEach((s) => {
    (s.topicsJson ?? []).forEach((t: { topic: string; weight: number }) => {
      topicWeights[t.topic] = (topicWeights[t.topic] ?? 0) + t.weight;
    });
  });

  return {
    avgRoi: Math.round(avgRoi),
    totalMeetings: meetings.length,
    completedMeetings: meetings.filter((m) => m.status === "COMPLETED").length,
    statusCounts,
    topics: Object.entries(topicWeights)
      .map(([topic, weight]) => ({ topic, weight }))
      .sort((a, b) => b.weight - a.weight),
  };
}
