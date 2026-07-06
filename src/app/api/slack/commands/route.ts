import { NextRequest, NextResponse } from "next/server";
import { getUpcomingMeetings } from "@/lib/db/store";

// Scaffold for a Slack slash command, e.g. "/meetpilot meetings".
// This closes the PRD gap-analysis item "Slack/Teams bot — highest-leverage
// adoption lever" by giving MeetPilot a chat-native entry point.
//
// TO GO TO PRODUCTION, this route still needs:
// 1. Signature verification — Slack signs every request with an
//    X-Slack-Signature header + timestamp, verified against your app's
//    Signing Secret using the raw request body (HMAC SHA-256). Requests that
//    fail verification MUST be rejected with 401. This handler currently
//    trusts the payload — do not deploy without adding this check.
// 2. A real Slack App registered at api.slack.com/apps with the
//    `/meetpilot` slash command configured to POST here, and OAuth scopes
//    for posting confirmation messages back to the channel.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const text = (form.get("text") as string) ?? "";

  const [action] = text.trim().split(/\s+/);

  if (action === "meetings") {
    const upcoming = await getUpcomingMeetings();
    if (upcoming.length === 0) {
      return NextResponse.json({ response_type: "ephemeral", text: "No upcoming meetings." });
    }
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Upcoming meetings:\n${upcoming
        .map((m) => `• *${m.title}* — ${new Date(m.startTime).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`)
        .join("\n")}`,
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: "Try `/meetpilot meetings` to see what's coming up.",
  });
}
