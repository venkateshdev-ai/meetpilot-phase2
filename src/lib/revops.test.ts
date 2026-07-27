// Tests for the RevOps policy module.
//
//   npm test
//
// This module is where the product's promises live — when a request is due,
// when it counts as breached, and what order a queue owner sees. Those are
// pure functions over time, which makes them both easy to get subtly wrong and
// easy to pin down. Everything else in the app is I/O around these rules.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SLA_HOURS,
  slaDueAt,
  slaState,
  triageSort,
  suggestPriority,
  suggestRequestType,
  type RequestPriority,
} from "./revops";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-07-26T12:00:00.000Z");
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();

test("slaDueAt derives the deadline from the priority ladder", () => {
  for (const [priority, hours] of Object.entries(SLA_HOURS)) {
    const due = new Date(slaDueAt(priority as RequestPriority, NOW)).getTime();
    assert.equal(due - NOW.getTime(), hours * HOUR, `${priority} should be ${hours}h out`);
  }
});

test("slaState reports time remaining before the deadline", () => {
  // P2 is a 72h window, so "comfortable" has to be more than 18h out — at 5h
  // remaining this would (correctly) already be at risk.
  const s = slaState(at(40), "P2", null, NOW);
  assert.ok(s);
  assert.equal(s.breached, false);
  assert.equal(s.atRisk, false);
  assert.match(s.label, /left/);
});

test("slaState flags a breach once the deadline has passed", () => {
  const s = slaState(at(-3), "P1", null, NOW);
  assert.ok(s);
  assert.equal(s.breached, true);
  assert.equal(s.label, "Overdue by 3h");
});

test("slaState flags at-risk inside the final quarter of the window", () => {
  // P1 = 24h window, so anything with <= 6h left is at risk.
  const atRisk = slaState(at(5), "P1", null, NOW);
  assert.equal(atRisk?.atRisk, true);
  const healthy = slaState(at(10), "P1", null, NOW);
  assert.equal(healthy?.atRisk, false);
});

test("resolving stops the clock — a request closed on time never later reads as breached", () => {
  // Due 2h ago, but it was resolved 5h ago: on time, and must stay that way
  // however long the app runs afterwards.
  const s = slaState(at(-2), "P2", at(-5), NOW);
  assert.ok(s);
  assert.equal(s.breached, false);
  assert.match(s.label, /Resolved with .* to spare/);

  // A genuinely late resolution still reads as late.
  const late = slaState(at(-10), "P2", at(-2), NOW);
  assert.equal(late?.breached, true);
  assert.match(late!.label, /Resolved .* late/);
});

test("slaState returns null when no deadline has been set", () => {
  assert.equal(slaState(null, "P2", null, NOW), null);
});

test("triageSort puts breached first, then priority, then soonest due", () => {
  const rows = [
    { id: "p3-later", status: "OPEN", priority: "P3" as const, slaDueAt: at(200), resolvedAt: null },
    { id: "p0-fine", status: "OPEN", priority: "P0" as const, slaDueAt: at(3), resolvedAt: null },
    { id: "p2-breached", status: "OPEN", priority: "P2" as const, slaDueAt: at(-1), resolvedAt: null },
    { id: "p1-soon", status: "OPEN", priority: "P1" as const, slaDueAt: at(2), resolvedAt: null },
    { id: "p1-later", status: "OPEN", priority: "P1" as const, slaDueAt: at(20), resolvedAt: null },
  ];
  const order = triageSort(rows, NOW).map((r) => r.id);
  assert.deepEqual(order, ["p2-breached", "p0-fine", "p1-soon", "p1-later", "p3-later"]);
});

test("triageSort sinks resolved requests even when they breached", () => {
  const rows = [
    { id: "done-breached", status: "DONE", priority: "P0" as const, slaDueAt: at(-50), resolvedAt: at(-40) },
    { id: "open-p3", status: "OPEN", priority: "P3" as const, slaDueAt: at(100), resolvedAt: null },
  ];
  assert.deepEqual(triageSort(rows, NOW).map((r) => r.id), ["open-p3", "done-breached"]);
});

test("suggestRequestType distinguishes a data fix from a mention of data", () => {
  // The bug this guards: "security review for the data export path" is not a
  // data fix just because the word "data" appears in it.
  assert.equal(suggestRequestType("book security review for new data export path"), "CHANGE_REQUEST");
  assert.equal(suggestRequestType("duplicate accounts created by the lead import"), "DATA_FIX");
  assert.equal(suggestRequestType("backfill missing renewal dates"), "DATA_FIX");
  assert.equal(suggestRequestType("crm is down for the field team"), "INCIDENT");
  assert.equal(suggestRequestType("grant the new AE cohort access to dashboards"), "ACCESS");
  assert.equal(suggestRequestType("quote totals are wrong on multi-year deals"), "RUN_THE_BUSINESS");
});

test("suggestPriority escalates incidents and urgent language, and de-escalates backlog talk", () => {
  assert.equal(suggestPriority("anything at all", "INCIDENT"), "P0");
  assert.equal(suggestPriority("reps are blocked and cannot send quotes", "RUN_THE_BUSINESS"), "P1");
  assert.equal(suggestPriority("nice to have when we get a chance", "CHANGE_REQUEST"), "P3");
  assert.equal(suggestPriority("add a renewal risk field", "CHANGE_REQUEST"), "P2");
});
