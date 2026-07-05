import {
  DEMO_USERS, DEMO_ROOMS, DEMO_MEETINGS, DEMO_ACTION_ITEMS, DEMO_INTEGRATIONS,
  DemoUser, DemoRoom, DemoMeeting, DemoActionItem, DemoIntegration, currentUser,
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
