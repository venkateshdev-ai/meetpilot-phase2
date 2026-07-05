import { NextRequest, NextResponse } from "next/server";
import { listRooms, listDesks } from "@/lib/mock/store";

// Scaffold for a Slack slash command, e.g. "/meetpilot book tagor 3pm".
// This closes the PRD gap-analysis item "Slack/Teams bot — highest-leverage
// adoption lever" by giving MeetPilot a chat-native booking entry point
// instead of requiring people to open the web app.
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
// 3. Replacing the mock command parser below with real create/lookup calls
//    against prisma.room / prisma.desk / prisma.roomBooking.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const text = (form.get("text") as string) ?? "";
  const userName = (form.get("user_name") as string) ?? "someone";

  const [action, ...rest] = text.trim().split(/\s+/);
  const query = rest.join(" ").toLowerCase();

  if (action === "book") {
    const rooms = listRooms();
    const desks = listDesks();
    const match =
      rooms.find((r) => query.includes(r.name.split(" ")[0].toLowerCase())) ??
      desks.find((d) => query.includes(d.label.toLowerCase()));

    if (!match) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `Couldn't find a room or desk matching "${query}". Try \`/meetpilot rooms\` to see what's available.`,
      });
    }

    const label = "name" in match ? match.name : match.label;
    return NextResponse.json({
      response_type: "in_channel",
      text: `✅ ${userName} booked *${label}* via MeetPilot. (Demo response — production wires this to a real RoomBooking/DeskBooking write and a wayfinding note.)`,
    });
  }

  if (action === "rooms") {
    const rooms = listRooms();
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Available rooms: ${rooms.map((r) => r.name).join(", ")}`,
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: "Try `/meetpilot book <room or desk name>` or `/meetpilot rooms`.",
  });
}
