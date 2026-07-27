// Seed the MeetPilot Supabase database with the demo org, users, and meetings
// the app's login page promises. Idempotent: refuses to run if the Acme org
// already exists (wipe manually if you want a fresh seed).
//
// Run:  node scripts/seed.mjs
//
// Talks to the same PostgREST layer the app uses (src/lib/db/supabase.ts),
// so anything this script can insert, the app can read — no drift.

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs"); // app dependency — same hashes the login check expects

// ---- env ------------------------------------------------------------------
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
// RLS is default-deny with no anon policies — seeding must use the
// service_role key (same one the app's server-side data layer uses).
const KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

async function insert(table, rows) {
  const res = await fetch(`${BASE}/${table}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  const out = await res.json();
  console.log(`  ✓ ${table}: ${out.length} row(s)`);
  return out;
}

async function selectOne(table, qs) {
  const res = await fetch(`${BASE}/${table}?${qs}&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows = await res.json();
  return rows[0];
}

const genId = (p) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

// ---- seed -----------------------------------------------------------------
const existing = await selectOne("Org", "slug=eq.acme");
if (existing) {
  console.log(`Org 'acme' already exists (${existing.id}) — nothing to do.`);
  process.exit(0);
}

console.log("Seeding MeetPilot demo data…");
const hash = bcrypt.hashSync("acme1234", 10);

// NOTE: the app's data layer is single-tenant with a HARD-CODED org id
// (src/lib/db/store.ts: ORG_ID = "org_acme") — the seed must match it or
// every org-scoped query (dashboard, members, meetings list) comes back empty.
const orgId = "org_acme";
await insert("Org", { id: orgId, name: "Acme Industries", slug: "acme" });

// Demo users — the ones the login page hint advertises, plus the three
// speakers referenced in the demo meeting transcript.
const USERS = [
  ["varan", "Varan Batra", "varan@acme.io", "GLOBAL_ADMIN"],
  ["hulk", "Hulk Hoganson", "hulk@acme.io", "ADMIN"],
  ["batman", "Bruce Wayne", "batman@acme.io", "REVIEWER"],
  ["priya", "Priya Sharma", "priya@acme.io", "REVIEWER"],
  ["marco", "Marco Diaz", "marco@acme.io", "REVIEWER"],
  ["dana", "Dana Reyes", "dana@acme.io", "REVIEWER"],
];
const uid = {};
for (const [k] of USERS) uid[k] = genId("u");

await insert(
  "User",
  USERS.map(([k, name, email]) => ({ id: uid[k], email, name, passwordHash: hash }))
);
await insert(
  "OrgMembership",
  USERS.map(([k, , , role]) => ({ id: genId("m"), orgId, userId: uid[k], role }))
);

// ---- Meeting 1: completed weekly sync with a real transcript ---------------
// The transcript content intentionally matches concrete, extractable action
// items so the AI Review tab has something meaningful to work with.
const day = 24 * 60 * 60 * 1000;
const m1 = genId("mtg");
await insert("Meeting", {
  id: m1,
  orgId,
  title: "Weekly Sync — Acme pilot",
  type: "ONLINE",
  status: "COMPLETED",
  agenda: "Acme pilot status\nCRM integration timeline\nOnboarding docs\nSecurity review",
  startTime: new Date(Date.now() - 1 * day).toISOString(),
  endTime: new Date(Date.now() - 1 * day + 45 * 60 * 1000).toISOString(),
  createdById: uid.varan,
  callProvider: "MeetPilot Video",
});
await insert(
  "MeetingParticipant",
  ["varan", "priya", "marco", "dana"].map((k) => ({ id: genId("mp"), meetingId: m1, userId: uid[k] }))
);

const LINES = [
  ["varan", "Alright, let's run through the Acme pilot. Where are we on the CRM side?", 0],
  ["priya", "I'll take the CRM API integration for the Acme pilot. Targeting end of month.", 2],
  ["marco", "I'll draft the customer onboarding runbook so support can self-serve.", 5],
  ["dana", "We should get a security review booked for the new data export path.", 9],
  ["varan", "Agreed. Let's make sure nothing ships to a customer without sign-off.", 12],
];
await insert(
  "TranscriptSegment",
  LINES.map(([k, text, t]) => ({ id: genId("ts"), meetingId: m1, speakerUserId: uid[k], text, tMinutes: t }))
);

await insert("MeetingSummary", {
  id: genId("sum"),
  meetingId: m1,
  executiveSummary:
    "The team reviewed Acme pilot progress. Priya owns the CRM API integration (end of month), Marco is drafting the onboarding runbook, and Dana will book a security review for the data export path. Nothing ships without sign-off.",
  keyDecisions: [
    "CRM API integration targeted for end of month",
    "Customer-facing work requires sign-off before shipping",
  ],
  // Weighted topics power the "Topics covered" chart on the meeting's Summary
  // tab and the org-wide "Top topics" rollup on Analytics. The AI produces
  // these for uploaded meetings; the seed supplies them for the demo meeting.
  topicsJson: [
    { topic: "CRM integration", weight: 9 },
    { topic: "Acme pilot", weight: 8 },
    { topic: "Customer onboarding", weight: 6 },
    { topic: "Security review", weight: 5 },
    { topic: "Release sign-off", weight: 3 },
  ],
  consentGiven: true,
});

await insert("ActionItem", [
  { id: genId("ai"), meetingId: m1, description: "Ship CRM API integration for the Acme pilot", assigneeId: uid.priya, status: "IN_PROGRESS" },
  { id: genId("ai"), meetingId: m1, description: "Draft customer onboarding runbook", assigneeId: uid.marco, status: "OPEN" },
  // One item owned by the demo login (varan) so "My action items" on the
  // Profile page isn't an empty state during a walkthrough.
  { id: genId("ai"), meetingId: m1, description: "Confirm Acme pilot go-live date with the customer", assigneeId: uid.varan, status: "OPEN" },
  { id: genId("ai"), meetingId: m1, description: "Share the pilot scope doc with the Acme team", assigneeId: uid.varan, status: "DONE" },
]);

// ---- Meeting 2: upcoming, so the dashboard isn't empty ---------------------
const m2 = genId("mtg");
await insert("Meeting", {
  id: m2,
  orgId,
  title: "Q3 Roadmap Planning",
  type: "HYBRID",
  status: "SCHEDULED",
  agenda: "Q3 priorities\nHiring plan\nPilot learnings",
  startTime: new Date(Date.now() + 1 * day).toISOString(),
  endTime: new Date(Date.now() + 1 * day + 60 * 60 * 1000).toISOString(),
  createdById: uid.varan,
});
await insert(
  "MeetingParticipant",
  ["varan", "hulk", "batman"].map((k) => ({ id: genId("mp"), meetingId: m2, userId: uid[k] }))
);

console.log(`\nDone. Meeting to demo the AI Review tab: /meetings/${m1}`);
console.log("Login: varan@acme.io / acme1234 (all demo users share the password)");
