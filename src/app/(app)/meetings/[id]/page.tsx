import { notFound } from "next/navigation";
import {
  getMeeting, getMeetingSummary, findPreviousMeetingForGroup, listActionItemsForMeeting,
  listTranscriptForMeeting, getMeetingParticipantIds, getUser,
} from "@/lib/db/store";
import MeetingHubView from "./MeetingHubView";

export default async function MeetingHubPage({ params }: { params: { id: string } }) {
  const meeting = await getMeeting(params.id);
  if (!meeting) return notFound();

  const [summary, previous, actionItems, transcript, participantIds] = await Promise.all([
    getMeetingSummary(meeting.id),
    findPreviousMeetingForGroup(meeting),
    listActionItemsForMeeting(meeting.id),
    listTranscriptForMeeting(meeting.id),
    getMeetingParticipantIds(meeting.id),
  ]);

  // Every user we might need to render an avatar/name for: participants,
  // action-item assignees, transcript speakers.
  const neededIds = new Set<string>([
    ...participantIds,
    ...actionItems.map((a) => a.assigneeId).filter((x): x is string => !!x),
    ...transcript.map((t) => t.speakerUserId).filter((x): x is string => !!x),
  ]);
  const users = await Promise.all(Array.from(neededIds).map((id) => getUser(id)));
  const usersById = Object.fromEntries(users.filter(Boolean).map((u) => [u!.id, u!]));

  const agenda = (meeting.agenda ?? "").split("\n").filter(Boolean);

  return (
    <MeetingHubView
      meeting={meeting}
      agenda={agenda}
      summary={summary ?? null}
      previous={previous ?? null}
      participantIds={participantIds}
      usersById={usersById}
      actionItems={actionItems}
      transcript={transcript}
    />
  );
}
