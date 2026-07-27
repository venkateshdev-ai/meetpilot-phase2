// Put the demo data back into a known-good state before recording a walkthrough.
//
//   node scripts/reset-demo.mjs           # re-date the seeded meetings
//   node scripts/reset-demo.mjs --clean   # ALSO delete ad-hoc test meetings
//
// Why re-dating matters: the seed script writes meetings relative to the day it
// ran, so a few days later the "upcoming" meeting has drifted into the past and
// the dashboard renders an empty state. This pins one meeting to tomorrow and
// one to yesterday so both dashboard sections are populated on camera.
//
// --clean removes meetings that are NOT part of the seeded demo set (e.g.
// "Instant meeting" rows created while clicking around). It never touches the
// two seeded meetings, and it prints exactly what it deletes.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const BASE = `${env.SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const clean = process.argv.includes("--clean");
const day = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const meetings = await (await fetch(`${BASE}/Meeting?select=id,title,startTime,status`, { headers })).json();

// The two meetings the seed script creates — the backbone of the demo.
const SEEDED = ["Weekly Sync — Acme pilot", "Q3 Roadmap Planning"];

const weekly = meetings.find((m) => m.title === "Weekly Sync — Acme pilot");
const q3 = meetings.find((m) => m.title === "Q3 Roadmap Planning");

if (!weekly || !q3) {
  console.error("✗ Seeded meetings missing — run `node scripts/seed.mjs` first.");
  process.exit(1);
}

const patch = async (id, body) => {
  const res = await fetch(`${BASE}/Meeting?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
};

// Yesterday, already finished → lands in "Recent meetings" with a summary.
await patch(weekly.id, {
  startTime: iso(Date.now() - day),
  endTime: iso(Date.now() - day + 45 * 60 * 1000),
  status: "COMPLETED",
});
console.log(`✓ "Weekly Sync — Acme pilot" → yesterday (Recent meetings)`);

// Tomorrow → lands in "Upcoming meetings".
await patch(q3.id, {
  startTime: iso(Date.now() + day),
  endTime: iso(Date.now() + day + 60 * 60 * 1000),
  status: "SCHEDULED",
});
console.log(`✓ "Q3 Roadmap Planning" → tomorrow (Upcoming meetings)`);

// Tickets created by a previous AI Review run must go, or the next take of the
// demo reports "0 tickets created" — the sync is idempotent per meeting, so
// re-approving the same tasks is a no-op while those rows still exist.
const aiTickets = await (
  await fetch(`${BASE}/Ticket?meetingId=eq.${weekly.id}&select=id,title`, { headers })
).json();
if (aiTickets.length > 0) {
  await fetch(`${BASE}/Ticket?meetingId=eq.${weekly.id}`, { method: "DELETE", headers });
  console.log(`✓ cleared ${aiTickets.length} ticket(s) from the previous AI Review run`);
}

const extras = meetings.filter((m) => !SEEDED.includes(m.title));
if (extras.length === 0) {
  console.log("✓ No ad-hoc test meetings present.");
} else if (!clean) {
  console.log(`\n${extras.length} ad-hoc meeting(s) present (kept — pass --clean to remove):`);
  for (const m of extras) console.log(`   · ${m.title}  [${m.id}]`);
} else {
  for (const m of extras) {
    // Child rows first: no ON DELETE cascade is guaranteed through PostgREST.
    for (const table of ["TranscriptSegment", "ActionItem", "MeetingParticipant", "MeetingUpload", "MeetingSummary"]) {
      await fetch(`${BASE}/${table}?meetingId=eq.${m.id}`, { method: "DELETE", headers });
    }
    await fetch(`${BASE}/Meeting?id=eq.${m.id}`, { method: "DELETE", headers });
    console.log(`✗ deleted "${m.title}"  [${m.id}]`);
  }
}

console.log(`\nDemo meeting for the AI Review walkthrough:`);
console.log(`  http://localhost:3000/meetings/${weekly.id}`);
console.log(`\nAlso reset the HITL graph state so AI Review starts at "Not started":`);
console.log(`  rm -f orchestrator/state.db   (or run ./scripts/start.sh --fresh)`);
