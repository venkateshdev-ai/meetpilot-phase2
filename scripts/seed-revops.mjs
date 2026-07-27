// Seed the RevOps layer: the GTM systems registry, plus a realistic starting
// queue of requests against them.
//
//   node scripts/seed-revops.mjs
//
// Idempotent — skips anything already present, so it is safe to re-run.

import { readFileSync } from "node:fs";
import crypto from "node:crypto";

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
const ORG = "org_acme";
const genId = (p) => `${p}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
const hoursFromNow = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const get = async (path) => (await fetch(`${BASE}/${path}`, { headers })).json();
const post = async (table, rows) => {
  const res = await fetch(`${BASE}/${table}`, { method: "POST", headers, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
};

const users = await get("User?select=id,email,name");
const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
const varan = byEmail["varan@acme.io"];
const hulk = byEmail["hulk@acme.io"];
const priya = byEmail["priya@acme.io"];
const marco = byEmail["marco@acme.io"];
const dana = byEmail["dana@acme.io"];
if (!varan) {
  console.error("✗ Users not seeded — run `node scripts/seed.mjs` first.");
  process.exit(1);
}

// --- Systems registry ------------------------------------------------------
// A deliberately vendor-neutral set: these are the *capabilities* a GTM org
// depends on, which is the level requests are actually raised at.
const SYSTEMS = [
  ["Sales CRM", "CRM", "Accounts, contacts, opportunities and pipeline for the field team.", varan],
  ["Quoting engine", "CPQ", "Quote generation, discount approvals and order forms.", priya],
  ["Billing & invoicing", "BILLING", "Subscription billing, invoices and revenue recognition.", hulk],
  ["Support desk", "SUPPORT", "Customer cases, entitlements and escalation routing.", dana],
  ["Partner portal", "PARTNER", "Deal registration and partner-sourced pipeline.", marco],
  ["Forecasting & analytics", "ANALYTICS", "Pipeline inspection, forecast rollups and GTM dashboards.", varan],
  ["Sales engagement", "ENGAGEMENT", "Sequences, dialer and activity capture for reps.", priya],
];

const existingSystems = await get(`GtmSystem?orgId=eq.${ORG}&select=id,name`);
const systemByName = Object.fromEntries(existingSystems.map((s) => [s.name, s]));

const toCreate = SYSTEMS.filter(([name]) => !systemByName[name]).map(([name, category, description, owner]) => ({
  id: genId("sys"),
  orgId: ORG,
  name,
  category,
  description,
  ownerId: owner?.id ?? null,
  status: "HEALTHY",
}));
if (toCreate.length) {
  const created = await post("GtmSystem", toCreate);
  created.forEach((s) => (systemByName[s.name] = s));
  console.log(`✓ registered ${created.length} system(s)`);
} else {
  console.log("✓ systems already registered");
}

// One system deliberately degraded so the registry shows a non-trivial state
// and the "impact" story on the queue has something to point at.
await fetch(`${BASE}/GtmSystem?orgId=eq.${ORG}&name=eq.Quoting%20engine`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ status: "DEGRADED" }),
});

// --- Request queue ---------------------------------------------------------
// Spread across priorities and SLA states so the queue demonstrates real
// triage behaviour: one already breached, one at risk, several healthy.
const sys = (n) => systemByName[n]?.id ?? null;
const REQUESTS = [
  {
    title: "Quote totals show pre-discount tax on multi-year deals",
    description: "Reps are manually correcting totals before sending. Affects any deal with a term > 12 months.",
    whyScenario: "Finance flagged three quotes last week where the invoice did not match the signed order form.",
    acceptanceCriteria:
      "Given a multi-year quote with a discount, when the quote is generated, then tax is calculated on the post-discount subtotal and the order form total matches the invoice.",
    requestType: "RUN_THE_BUSINESS",
    priority: "P1",
    source: "DIRECT",
    systemId: sys("Quoting engine"),
    requestedById: priya?.id,
    assigneeId: hulk?.id,
    status: "IN_PROGRESS",
    slaDueAt: hoursFromNow(-6), // breached — sits at the top of the queue
    triagedAt: hoursFromNow(-30),
    triagedById: varan?.id,
  },
  {
    title: "Partner deal registration emails not sending",
    description: "Partners submit a registration and never receive confirmation. Suspected webhook failure.",
    whyScenario: "Two partners escalated this week; deal reg volume is down 40% month over month.",
    requestType: "INCIDENT",
    priority: "P0",
    source: "MONITOR",
    systemId: sys("Partner portal"),
    assigneeId: marco?.id,
    status: "OPEN",
    slaDueAt: hoursFromNow(2), // at risk
  },
  {
    title: "Add renewal risk field to the opportunity record",
    description: "CS wants a structured risk rating visible to the account team during renewal cycles.",
    whyScenario: "Renewal risk currently lives in a spreadsheet only CS can see, so AEs are surprised late.",
    acceptanceCriteria:
      "Given a renewal opportunity, when a CSM sets risk to High, then the owning AE sees the rating on the record and in the renewal dashboard.",
    requestType: "CHANGE_REQUEST",
    priority: "P2",
    source: "MEETING",
    systemId: sys("Sales CRM"),
    requestedById: dana?.id,
    status: "OPEN",
    slaDueAt: hoursFromNow(50),
  },
  {
    title: "Grant the new AE cohort access to forecasting dashboards",
    description: "Six new hires start Monday and need the standard field-sales permission set.",
    requestType: "ACCESS",
    priority: "P2",
    source: "DIRECT",
    systemId: sys("Forecasting & analytics"),
    requestedById: marco?.id,
    status: "OPEN",
    slaDueAt: hoursFromNow(60),
  },
  {
    title: "Duplicate accounts created by the lead import job",
    description: "Nightly import is creating duplicates when company names differ only by punctuation.",
    whyScenario: "Duplicate accounts split pipeline reporting and cause two reps to work the same buyer.",
    requestType: "DATA_FIX",
    priority: "P1",
    source: "MONITOR",
    systemId: sys("Sales CRM"),
    assigneeId: priya?.id,
    status: "OPEN",
    slaDueAt: hoursFromNow(14),
  },
  {
    title: "Archive the legacy commission report",
    description: "Superseded by the new analytics workspace; still runs nightly and confuses managers.",
    requestType: "CHANGE_REQUEST",
    priority: "P3",
    source: "DIRECT",
    systemId: sys("Forecasting & analytics"),
    status: "DONE",
    slaDueAt: hoursFromNow(-100),
    resolvedAt: hoursFromNow(-120), // resolved before its deadline
    triagedAt: hoursFromNow(-200),
    triagedById: varan?.id,
  },
];

const existingTickets = await get(`Ticket?orgId=eq.${ORG}&select=title`);
const haveTitles = new Set(existingTickets.map((t) => t.title.trim().toLowerCase()));
const rows = REQUESTS.filter((r) => !haveTitles.has(r.title.toLowerCase())).map((r) => ({
  id: genId("tkt"),
  orgId: ORG,
  createdById: varan.id,
  ...r,
}));

// PostgREST rejects a bulk insert whose objects have differing key sets
// ("All object keys must match"), so pad every row out to the union of keys.
const allKeys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
const newRequests = rows.map((r) =>
  Object.fromEntries(allKeys.map((k) => [k, r[k] ?? null]))
);

if (newRequests.length) {
  await post("Ticket", newRequests);
  console.log(`✓ created ${newRequests.length} request(s) in the queue`);
} else {
  console.log("✓ requests already seeded");
}

console.log("\nOpen the queue:   http://localhost:3000/requests");
console.log("Systems registry: http://localhost:3000/systems");
