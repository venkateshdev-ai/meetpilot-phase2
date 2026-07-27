import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getUpcomingMeetings, listTicketsForOrg } from "@/lib/db/store";
import { slaState, triageSort } from "@/lib/revops";

// Slack slash command, e.g. "/meetpilot meetings" or "/meetpilot queue".
//
// Every request is signature-verified before it is acted on. Slack signs each
// call with X-Slack-Signature over the raw body plus a timestamp; this handler
// previously trusted the payload outright, meaning anyone who discovered the
// URL could invoke it.
//
// Still needed for production: a Slack App registered at api.slack.com/apps
// with the /meetpilot command pointed here and OAuth scopes for posting back
// to the channel.

const FIVE_MINUTES = 60 * 5;

/**
 * Verify Slack's request signature.
 *
 * Returns a reason string when the request should be rejected, or null when it
 * is good. Fails closed: if no signing secret is configured, requests are
 * refused rather than silently trusted, because the alternative is an open
 * unauthenticated endpoint.
 */
function verifySlackSignature(rawBody: string, req: NextRequest): string | null {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return "SLACK_SIGNING_SECRET is not configured on this deployment";

  const timestamp = req.headers.get("x-slack-request-timestamp");
  const signature = req.headers.get("x-slack-signature");
  if (!timestamp || !signature) return "Missing Slack signature headers";

  // Reject stale timestamps so a captured request cannot be replayed later.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > FIVE_MINUTES) return "Slack request timestamp is too old";

  const expected = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "Slack signature mismatch";

  return null;
}

export async function POST(req: NextRequest) {
  // The raw body is required for the HMAC, so read text() and parse manually —
  // formData() would consume the stream and lose the exact bytes Slack signed.
  const rawBody = await req.text();
  const failure = verifySlackSignature(rawBody, req);
  if (failure) {
    console.warn(`[slack] rejected request: ${failure}`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const text = params.get("text") ?? "";
  const [action] = text.trim().split(/\s+/);

  if (action === "meetings") {
    const upcoming = await getUpcomingMeetings();
    if (upcoming.length === 0) {
      return NextResponse.json({ response_type: "ephemeral", text: "No upcoming meetings." });
    }
    return NextResponse.json({
      response_type: "ephemeral",
      text: `Upcoming meetings:\n${upcoming
        .map(
          (m) =>
            `• *${m.title}* — ${new Date(m.startTime).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}`
        )
        .join("\n")}`,
    });
  }

  if (action === "queue") {
    const open = (await listTicketsForOrg()).filter((t) => t.status !== "DONE");
    if (open.length === 0) {
      return NextResponse.json({ response_type: "ephemeral", text: "The request queue is clear. 🎉" });
    }
    const top = triageSort(open).slice(0, 5);
    const breached = open.filter((t) => slaState(t.slaDueAt, t.priority, t.resolvedAt)?.breached).length;
    return NextResponse.json({
      response_type: "ephemeral",
      text:
        `*${open.length} open request(s)*${breached ? ` — :rotating_light: ${breached} past SLA` : ""}\n` +
        top
          .map((t) => {
            const sla = slaState(t.slaDueAt, t.priority, t.resolvedAt);
            return `• \`${t.priority}\` ${t.title}${sla ? ` — _${sla.label}_` : ""}`;
          })
          .join("\n"),
    });
  }

  return NextResponse.json({
    response_type: "ephemeral",
    text: "Try `/meetpilot meetings` for what's coming up, or `/meetpilot queue` for the request queue.",
  });
}
