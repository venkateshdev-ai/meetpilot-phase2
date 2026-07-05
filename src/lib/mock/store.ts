import {
  DEMO_USERS, DEMO_ROOMS, DEMO_MEETINGS, DEMO_ACTION_ITEMS, DEMO_INTEGRATIONS,
  DEMO_DESKS, DEMO_DESK_BOOKINGS, DEMO_VISITORS, DEMO_INVOICES, DEMO_TRANSCRIPT,
  DemoUser, DemoRoom, DemoMeeting, DemoActionItem, DemoIntegration, currentUser,
  DemoDesk, DemoDeskBooking, DemoVisitor, DemoInvoice, DemoTranscriptSegment,
} from "./data";

// Repository-pattern functions. Every one of these has an obvious 1:1 Prisma
// equivalent (see comments) — this is intentional so Stage "go live" is a
// mechanical swap, not a rewrite.

export function getCurrentUser(): DemoUser {
  return currentUser();
}

export function listUsers(): DemoUser[] {
  return DEMO_USERS; // prisma.user.findMany({ where: { memberships: { some: { orgId } } } })
}

export function getUser(id: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.id === id);
}

export function listRooms(): DemoRoom[] {
  return DEMO_ROOMS; // prisma.room.findMany({ where: { orgId, isActive: true } })
}

export function getRoom(id: string): DemoRoom | undefined {
  return DEMO_ROOMS.find((r) => r.id === id);
}

export function listMeetings(): DemoMeeting[] {
  return [...DEMO_MEETINGS].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  ); // prisma.meeting.findMany({ where: { orgId }, orderBy: { startTime: "desc" } })
}

export function getMeeting(id: string): DemoMeeting | undefined {
  return DEMO_MEETINGS.find((m) => m.id === id);
}

export function getUpcomingMeetings(): DemoMeeting[] {
  const now = new Date("2026-07-04T12:00:00.000Z").getTime();
  return DEMO_MEETINGS.filter((m) => new Date(m.startTime).getTime() >= now).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

// The MoM-recall lookup: "has this exact participant set met before?"
// Real impl: prisma.meeting.findFirst({ where: { participantSetHash, id: { not: meetingId } }, orderBy: { startTime: "desc" } })
export function findPreviousMeetingForGroup(meeting: DemoMeeting): DemoMeeting | undefined {
  if (!meeting.previousMeetingId) return undefined;
  return getMeeting(meeting.previousMeetingId);
}

export function listActionItemsForMeeting(meetingId: string): DemoActionItem[] {
  return DEMO_ACTION_ITEMS.filter((a) => a.meetingId === meetingId);
}

export function listActionItemsForUser(userId: string): DemoActionItem[] {
  return DEMO_ACTION_ITEMS.filter((a) => a.assigneeId === userId);
}

export function listIntegrations(): DemoIntegration[] {
  return DEMO_INTEGRATIONS;
}

// ---------------------------------------------------------------------------
// Desk booking (hot-desking)
// ---------------------------------------------------------------------------
export function listDesks(): DemoDesk[] {
  return DEMO_DESKS; // prisma.desk.findMany({ where: { orgId, isActive: true } })
}

export function getDesk(id: string): DemoDesk | undefined {
  return DEMO_DESKS.find((d) => d.id === id);
}

// prisma.deskBooking.findMany({ where: { desk: { orgId }, date } })
export function listDeskBookingsForDate(date: string): DemoDeskBooking[] {
  return DEMO_DESK_BOOKINGS.filter((b) => b.date === date);
}

export function deskUtilizationByFloor(): { floor: string; total: number; booked: number }[] {
  const today = "2026-07-04";
  const bookedIds = new Set(listDeskBookingsForDate(today).map((b) => b.deskId));
  const floors = Array.from(new Set(DEMO_DESKS.map((d) => d.floor)));
  return floors.map((floor) => {
    const deskOnFloor = DEMO_DESKS.filter((d) => d.floor === floor && d.isActive);
    return {
      floor,
      total: deskOnFloor.length,
      booked: deskOnFloor.filter((d) => bookedIds.has(d.id)).length,
    };
  });
}

// ---------------------------------------------------------------------------
// Visitor management
// ---------------------------------------------------------------------------
export function listVisitors(): DemoVisitor[] {
  return [...DEMO_VISITORS].sort(
    (a, b) => new Date(a.expectedAt).getTime() - new Date(b.expectedAt).getTime()
  ); // prisma.visitor.findMany({ where: { orgId }, orderBy: { expectedAt: "asc" } })
}

export function getVisitor(id: string): DemoVisitor | undefined {
  return DEMO_VISITORS.find((v) => v.id === id);
}

// ---------------------------------------------------------------------------
// Billing / invoicing
// ---------------------------------------------------------------------------
export function listInvoices(): DemoInvoice[] {
  return DEMO_INVOICES; // prisma.invoice.findMany({ where: { orgId }, orderBy: { issuedAt: "desc" } })
}

export function invoiceTotals() {
  const paid = DEMO_INVOICES.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
  const outstanding = DEMO_INVOICES.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + i.amount, 0);
  const draft = DEMO_INVOICES.filter((i) => i.status === "DRAFT").reduce((s, i) => s + i.amount, 0);
  return { paid, outstanding, draft };
}

// ---------------------------------------------------------------------------
// Live transcript (video call mock)
// ---------------------------------------------------------------------------
// prisma.transcriptSegment.findMany({ where: { meetingId }, orderBy: { tMinutes: "asc" } })
export function listTranscriptForMeeting(meetingId: string): DemoTranscriptSegment[] {
  return DEMO_TRANSCRIPT.filter((t) => t.meetingId === meetingId).sort((a, b) => a.tMinutes - b.tMinutes);
}

// ---------------------------------------------------------------------------
// Room utilization (analytics)
// ---------------------------------------------------------------------------
export function roomUtilization(): { room: string; bookedHoursThisWeek: number; capacity: number }[] {
  // Deterministic mock utilization derived from each room's tariff tier, so the
  // analytics chart has believable, stable-looking spread without random jitter.
  // prisma equivalent: aggregate RoomBooking duration per room over the trailing 7 days.
  return DEMO_ROOMS.map((r) => ({
    room: r.name,
    bookedHoursThisWeek: Math.round((r.tariffPerHour / 100) % 23) + 4,
    capacity: 40,
  }));
}

export function orgWideAnalytics() {
  const meetings = DEMO_MEETINGS.filter((m) => m.summary);
  const avgRoi =
    meetings.reduce((sum, m) => sum + (m.summary?.meetingRoiPercent ?? 0), 0) /
    (meetings.length || 1);

  const statusCounts: Record<string, number> = { OPEN: 0, IN_PROGRESS: 0, DONE: 0, BLOCKED: 0 };
  DEMO_ACTION_ITEMS.forEach((a) => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });

  const topicWeights: Record<string, number> = {};
  meetings.forEach((m) =>
    m.summary?.topics.forEach((t) => {
      topicWeights[t.topic] = (topicWeights[t.topic] ?? 0) + t.weight;
    })
  );

  return {
    avgRoi: Math.round(avgRoi),
    totalMeetings: DEMO_MEETINGS.length,
    completedMeetings: DEMO_MEETINGS.filter((m) => m.status === "COMPLETED").length,
    statusCounts,
    topics: Object.entries(topicWeights)
      .map(([topic, weight]) => ({ topic, weight }))
      .sort((a, b) => b.weight - a.weight),
  };
}
