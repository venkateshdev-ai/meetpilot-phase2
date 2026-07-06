// ---------------------------------------------------------------------------
// DEMO DATA LAYER
// ---------------------------------------------------------------------------
// Everything in src/lib/mock/* implements the exact same shapes as the Prisma
// models in prisma/schema.prisma. It exists so the app is fully click-through
// runnable without a live Postgres connection or the Prisma query-engine binary
// (which this sandbox's network allowlist cannot download).
//
// Swapping to the real database later is a data-layer change only: replace the
// functions in store.ts with Prisma calls that return the same shapes. No page
// or component in src/app needs to change.
// ---------------------------------------------------------------------------

export type Role = "ORG_ADMIN" | "TEAM_LEAD" | "MEMBER" | "GUEST";
export type MeetingType = "ONLINE" | "OFFLINE" | "HYBRID";
export type MeetingStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type ActionItemStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";
export type IntegrationProvider =
  | "JIRA" | "ASANA" | "LINEAR"
  | "GOOGLE_CALENDAR" | "OUTLOOK_CALENDAR" | "SLACK" | "SALESFORCE" | "HUBSPOT" | "STRIPE";
export type VisitorStatus = "INVITED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
export type InvoiceStatus = "DRAFT" | "SENT" | "PAID" | "OVERDUE";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarColor: string;
  initials: string;
  presence: "Active" | "In Meeting" | "Away";
}

export interface DemoRoom {
  id: string;
  name: string;
  capacity: number;
  areaSqft: number;
  floor: string;
  zone: string;
  tariffPerHour: number;
  amenities: string[];
  rating: number;
  reviews: { author: string; text: string }[];
}

export interface DemoDesk {
  id: string;
  label: string;
  floor: string;
  zone: string;
  amenities: string[];
  isActive: boolean;
}

export interface DemoDeskBooking {
  id: string;
  deskId: string;
  userId: string;
  date: string;
  status: "BOOKED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
}

export interface DemoVisitor {
  id: string;
  name: string;
  email: string;
  hostUserId: string;
  purpose: string;
  badgeCode: string | null;
  status: VisitorStatus;
  expectedAt: string;
  checkedInAt: string | null;
}

export interface DemoInvoice {
  id: string;
  number: string;
  description: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
}

export interface DemoTranscriptSegment {
  meetingId: string;
  speakerUserId: string;
  text: string;
  tMinutes: number;
}

export interface DemoActionItem {
  id: string;
  meetingId: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: ActionItemStatus;
  syncedProvider: IntegrationProvider | null;
  syncedTicketId: string | null;
  syncedStatus: string | null;
}

export interface DemoMeetingSummary {
  executiveSummary: string;
  keyDecisions: string[];
  sentimentTrend: { t: string; score: number }[];
  talkTimeByUser: { userId: string; minutes: number }[];
  meetingRoiPercent: number;
  topics: { topic: string; weight: number }[];
  consentGiven: boolean;
}

export interface DemoMeeting {
  id: string;
  orgId: string;
  title: string;
  type: MeetingType;
  status: MeetingStatus;
  agenda: string[];
  meetLink: string | null;
  callProvider: string | null;
  roomId: string | null;
  startTime: string;
  endTime: string;
  createdById: string;
  participantIds: string[];
  participantSetHash: string;
  previousMeetingId: string | null;
  summary: DemoMeetingSummary | null;
}

export interface DemoIntegration {
  provider: IntegrationProvider;
  connected: boolean;
  connectedBy: string | null;
  connectedAt: string | null;
}

export const DEMO_ORG = {
  id: "org_acme",
  name: "Acme Industries",
  slug: "acme",
};

export const DEMO_USERS: DemoUser[] = [
  { id: "u_hulk", name: "Hulk", email: "hulk@acme.io", role: "ORG_ADMIN", avatarColor: "#22c55e", initials: "HK", presence: "Active" },
  { id: "u_batman", name: "Batman", email: "batman@acme.io", role: "TEAM_LEAD", avatarColor: "#ef4444", initials: "BM", presence: "In Meeting" },
  { id: "u_ironman", name: "Ironman", email: "ironman@acme.io", role: "MEMBER", avatarColor: "#f59e0b", initials: "IM", presence: "Away" },
  { id: "u_varan", name: "Varan", email: "venkateshvaranedu@gmail.com", role: "TEAM_LEAD", avatarColor: "#6d5bf8", initials: "VR", presence: "Active" },
  { id: "u_thor", name: "Thor", email: "thor@acme.io", role: "MEMBER", avatarColor: "#2e5aac", initials: "TH", presence: "Active" },
  { id: "u_widow", name: "Black Widow", email: "widow@acme.io", role: "GUEST", avatarColor: "#94a3b8", initials: "BW", presence: "Away" },
];

export const DEMO_ROOMS: DemoRoom[] = [
  {
    id: "r_shivaji",
    name: "Shivaji Room",
    capacity: 20,
    areaSqft: 120,
    floor: "3rd Floor",
    zone: "West Wing, near the elevator",
    tariffPerHour: 2398,
    amenities: ["4K Display", "Whiteboard", "Video Bar", "Soundproof"],
    rating: 4.6,
    reviews: [{ author: "Varan", text: "Best room, has loads of features and no noise from outside." }],
  },
  {
    id: "r_tagor",
    name: "Tagor Room",
    capacity: 8,
    areaSqft: 70,
    floor: "3rd Floor",
    zone: "East Wing, next to the pantry",
    tariffPerHour: 1299,
    amenities: ["TV Screen", "Whiteboard"],
    rating: 4.2,
    reviews: [{ author: "Thor", text: "Cozy, good for stand-ups." }],
  },
  {
    id: "r_ashoka",
    name: "Ashoka Room",
    capacity: 12,
    areaSqft: 95,
    floor: "4th Floor",
    zone: "North Wing, opposite reception",
    tariffPerHour: 1799,
    amenities: ["4K Display", "Video Bar"],
    rating: 4.4,
    reviews: [],
  },
  {
    id: "r_ramana",
    name: "Ramana Room",
    capacity: 4,
    areaSqft: 40,
    floor: "4th Floor",
    zone: "South Wing, near the stairwell",
    tariffPerHour: 699,
    amenities: ["Monitor"],
    rating: 4.0,
    reviews: [],
  },
];

// Two meetings with the SAME participant set (Hulk, Batman, Ironman, Varan) so the
// MoM-recall banner on the newer one has real history to surface — this is the
// concrete demonstration of PRD Section 5's "recall previous MoM" requirement.
const REPEAT_GROUP_HASH = "hash_hulk_batman_ironman_varan";

export const DEMO_MEETINGS: DemoMeeting[] = [
  {
    id: "m_prev_llm",
    orgId: DEMO_ORG.id,
    title: 'Which LLM we can use for better response and why?',
    type: "ONLINE",
    status: "COMPLETED",
    agenda: ["Choosing the color palette", "Making it available in French, English, others", "Answering users by crawling company info"],
    meetLink: "https://meet.google.com/abc-defg-hij",
    callProvider: "MeetPilot Video (mock)",
    roomId: null,
    startTime: "2025-12-12T10:00:00.000Z",
    endTime: "2025-12-12T10:45:00.000Z",
    createdById: "u_varan",
    participantIds: ["u_hulk", "u_batman", "u_ironman", "u_varan"],
    participantSetHash: REPEAT_GROUP_HASH,
    previousMeetingId: null,
    summary: {
      executiveSummary:
        "The team scoped the first version of the AI meeting-copilot: high-level requirements, resourcing, and a beta timeline.",
      keyDecisions: [
        "High-level requirement set agreed for the copilot MVP",
        "Resourcing, feasibility, and timeline discussed for a beta release",
      ],
      sentimentTrend: [
        { t: "0m", score: 0.6 }, { t: "10m", score: 0.72 }, { t: "20m", score: 0.55 }, { t: "30m", score: 0.8 }, { t: "45m", score: 0.75 },
      ],
      talkTimeByUser: [
        { userId: "u_hulk", minutes: 12 }, { userId: "u_batman", minutes: 11 }, { userId: "u_ironman", minutes: 10 }, { userId: "u_varan", minutes: 12 },
      ],
      meetingRoiPercent: 82,
      topics: [
        { topic: "Roadmap", weight: 9 }, { topic: "Feasibility", weight: 7 }, { topic: "Timeline", weight: 6 }, { topic: "Beta", weight: 5 },
      ],
      consentGiven: true,
    },
  },
  {
    id: "m_automation_review",
    orgId: DEMO_ORG.id,
    title: "CoPilot Meeting Review on Automation",
    type: "ONLINE",
    status: "COMPLETED",
    agenda: ["Review unified API strategy", "Confirm OAuth 2.0 standard", "Decide MVP integration target"],
    meetLink: "https://meet.google.com/xyz-uvwx-rst",
    callProvider: "MeetPilot Video (mock)",
    roomId: null,
    startTime: "2026-02-01T10:00:00.000Z",
    endTime: "2026-02-01T10:30:00.000Z",
    createdById: "u_varan",
    participantIds: ["u_hulk", "u_batman", "u_ironman", "u_varan"],
    participantSetHash: REPEAT_GROUP_HASH,
    previousMeetingId: "m_prev_llm",
    summary: {
      executiveSummary:
        'The team discussed the technical feasibility of integrating Jira, Asana, and Linear APIs for the upcoming POC. The primary goal is a "single source of truth" where meeting action items are automatically synced to the user\'s preferred task manager.',
      keyDecisions: [
        "Unified API strategy: one abstraction layer across Jira, Asana, and Linear, cutting initial dev time ~40%",
        "Authentication: OAuth 2.0 standard for all external connections",
        "MVP scope: prioritize Linear first for the fastest functional demo (GraphQL API)",
      ],
      sentimentTrend: [
        { t: "0m", score: 0.5 }, { t: "10m", score: 0.65 }, { t: "20m", score: 0.7 }, { t: "30m", score: 0.78 },
      ],
      talkTimeByUser: [
        { userId: "u_hulk", minutes: 9 }, { userId: "u_batman", minutes: 8 }, { userId: "u_ironman", minutes: 6 }, { userId: "u_varan", minutes: 7 },
      ],
      meetingRoiPercent: 75,
      topics: [
        { topic: "API Latency", weight: 10 }, { topic: "User Feedback", weight: 8 }, { topic: "Deployment", weight: 7 }, { topic: "Roadmap", weight: 6 }, { topic: "Sync", weight: 5 },
      ],
      consentGiven: true,
    },
  },
  {
    id: "m_sprint_sync",
    orgId: DEMO_ORG.id,
    title: "Sprint Sync",
    type: "HYBRID",
    status: "SCHEDULED",
    agenda: ["Review sprint burndown", "Groom backlog", "Assign carryover"],
    meetLink: "https://meet.google.com/ppp-qqqq-rrr",
    callProvider: "MeetPilot Video (mock)",
    roomId: "r_tagor",
    startTime: "2026-07-06T14:30:00.000Z",
    endTime: "2026-07-06T15:15:00.000Z",
    createdById: "u_batman",
    participantIds: ["u_batman", "u_thor", "u_widow"],
    participantSetHash: "hash_batman_thor_widow",
    previousMeetingId: null,
    summary: null,
  },
];

export const DEMO_ACTION_ITEMS: DemoActionItem[] = [
  { id: "a1", meetingId: "m_automation_review", description: "Wireframe high fidelity screens for booking flow", assigneeId: "u_hulk", dueDate: "2026-02-10", status: "OPEN", syncedProvider: "JIRA", syncedTicketId: "MEET-001", syncedStatus: "To-Do" },
  { id: "a2", meetingId: "m_automation_review", description: "Validate platform feasibility for end user", assigneeId: "u_ironman", dueDate: "2026-02-12", status: "IN_PROGRESS", syncedProvider: "JIRA", syncedTicketId: "AUTO-234", syncedStatus: "In Progress" },
  { id: "a3", meetingId: "m_automation_review", description: "Fix OAuth callback latency", assigneeId: "u_varan", dueDate: "2026-02-08", status: "OPEN", syncedProvider: "LINEAR", syncedTicketId: "LN-42", syncedStatus: "Backlog" },
  { id: "a4", meetingId: "m_automation_review", description: "Build transcript parser", assigneeId: "u_batman", dueDate: "2026-02-05", status: "DONE", syncedProvider: "LINEAR", syncedTicketId: "LN-43", syncedStatus: "Done" },
  { id: "a5", meetingId: "m_prev_llm", description: "Testing and feasibility analysis on discussed items", assigneeId: "u_hulk", dueDate: "2025-12-20", status: "DONE", syncedProvider: null, syncedTicketId: null, syncedStatus: null },
];

export const DEMO_INTEGRATIONS: DemoIntegration[] = [
  { provider: "LINEAR", connected: true, connectedBy: "Varan", connectedAt: "2026-01-15" },
  { provider: "JIRA", connected: true, connectedBy: "Hulk", connectedAt: "2026-01-20" },
  { provider: "ASANA", connected: false, connectedBy: null, connectedAt: null },
  { provider: "GOOGLE_CALENDAR", connected: true, connectedBy: "Varan", connectedAt: "2026-03-02" },
  { provider: "OUTLOOK_CALENDAR", connected: false, connectedBy: null, connectedAt: null },
  { provider: "SLACK", connected: true, connectedBy: "Hulk", connectedAt: "2026-03-10" },
  { provider: "SALESFORCE", connected: false, connectedBy: null, connectedAt: null },
  { provider: "HUBSPOT", connected: false, connectedBy: null, connectedAt: null },
  { provider: "STRIPE", connected: false, connectedBy: null, connectedAt: null },
];

// ---------------------------------------------------------------------------
// Desk booking (hot-desking)
// ---------------------------------------------------------------------------
export const DEMO_DESKS: DemoDesk[] = [
  { id: "d_1", label: "Desk A1", floor: "3rd Floor", zone: "Window row, West Wing", amenities: ["Dual Monitor", "Docking Station"], isActive: true },
  { id: "d_2", label: "Desk A2", floor: "3rd Floor", zone: "Window row, West Wing", amenities: ["Docking Station"], isActive: true },
  { id: "d_3", label: "Desk B1", floor: "3rd Floor", zone: "Quiet zone, East Wing", amenities: ["Standing Desk", "Dual Monitor"], isActive: true },
  { id: "d_4", label: "Desk C1", floor: "4th Floor", zone: "Collab area, North Wing", amenities: ["Docking Station"], isActive: true },
  { id: "d_5", label: "Desk C2", floor: "4th Floor", zone: "Collab area, North Wing", amenities: ["Standing Desk"], isActive: true },
  { id: "d_6", label: "Desk D1", floor: "4th Floor", zone: "Quiet zone, South Wing", amenities: ["Dual Monitor"], isActive: false },
];

export const DEMO_DESK_BOOKINGS: DemoDeskBooking[] = [
  { id: "db_1", deskId: "d_1", userId: "u_varan", date: "2026-07-04", status: "CHECKED_IN" },
  { id: "db_2", deskId: "d_3", userId: "u_thor", date: "2026-07-04", status: "BOOKED" },
  { id: "db_3", deskId: "d_4", userId: "u_hulk", date: "2026-07-04", status: "BOOKED" },
  { id: "db_4", deskId: "d_2", userId: "u_batman", date: "2026-07-03", status: "CHECKED_OUT" },
];

// ---------------------------------------------------------------------------
// Visitor management
// ---------------------------------------------------------------------------
export const DEMO_VISITORS: DemoVisitor[] = [
  { id: "v_1", name: "Priya Sharma", email: "priya@clientco.com", hostUserId: "u_varan", purpose: "Product demo — Sprint Sync", badgeCode: "VIS-4821", status: "CHECKED_IN", expectedAt: "2026-07-04T09:30:00.000Z", checkedInAt: "2026-07-04T09:34:00.000Z" },
  { id: "v_2", name: "Alex Chen", email: "alex@partnerlabs.io", hostUserId: "u_hulk", purpose: "Partnership discussion", badgeCode: "VIS-4822", status: "INVITED", expectedAt: "2026-07-06T14:00:00.000Z", checkedInAt: null },
  { id: "v_3", name: "Meera Rao", email: "meera@vendor.com", hostUserId: "u_batman", purpose: "Vendor onboarding", badgeCode: null, status: "CHECKED_OUT", expectedAt: "2026-07-02T11:00:00.000Z", checkedInAt: "2026-07-02T11:05:00.000Z" },
];

// ---------------------------------------------------------------------------
// Billing / invoicing
// ---------------------------------------------------------------------------
export const DEMO_INVOICES: DemoInvoice[] = [
  { id: "inv_1", number: "INV-1042", description: "MeetPilot Pro — 6 seats (June)", amount: 174, currency: "USD", status: "PAID", issuedAt: "2026-06-30", dueAt: "2026-07-07" },
  { id: "inv_2", number: "INV-1043", description: "AI transcription add-on (June)", amount: 29, currency: "USD", status: "SENT", issuedAt: "2026-07-01", dueAt: "2026-07-15" },
  { id: "inv_3", number: "INV-1044", description: "MeetPilot Pro — 6 seats (July, in progress)", amount: 174, currency: "USD", status: "DRAFT", issuedAt: "2026-07-04", dueAt: null },
];

// ---------------------------------------------------------------------------
// Live transcript (mock feed for the meeting "Call" tab)
// ---------------------------------------------------------------------------
export const DEMO_TRANSCRIPT: DemoTranscriptSegment[] = [
  { meetingId: "m_automation_review", speakerUserId: "u_hulk", text: "Let's start with the unified API strategy — I think one abstraction layer across Jira, Asana, and Linear is the right call.", tMinutes: 0.5 },
  { meetingId: "m_automation_review", speakerUserId: "u_varan", text: "Agreed. That also cuts our initial dev time by something like 40%.", tMinutes: 1.2 },
  { meetingId: "m_automation_review", speakerUserId: "u_batman", text: "What about auth? We can't have three different OAuth flows.", tMinutes: 2.0 },
  { meetingId: "m_automation_review", speakerUserId: "u_ironman", text: "OAuth 2.0 standard across all three, I'll draft the token refresh spec.", tMinutes: 2.6 },
  { meetingId: "m_automation_review", speakerUserId: "u_hulk", text: "For MVP, let's prioritize Linear first — GraphQL API means fastest working demo.", tMinutes: 3.4 },
];

export function currentUser(): DemoUser {
  return DEMO_USERS[3]; // Varan — the signed-in demo user
}
