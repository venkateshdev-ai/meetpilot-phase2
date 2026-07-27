# MeetPilot

**Requests are captured where they're raised — in the meeting — classified,
triaged against an SLA, and executed only after a human approves, with a full
audit trail.**

MeetPilot is a RevOps request-intake tool with a human-in-the-loop AI gate. A
GTM stakeholder raises something in a meeting ("quotes are calculating tax
wrong", "the partner portal isn't sending confirmations"); MeetPilot extracts
it, classifies it, and files it against the revenue system it affects — but it
does **not** act on it until a named human approves. Every step is recorded.

> **This is a portfolio project**, not a commercial product. It runs against a
> real Postgres database with real auth and a real LLM, but it is a
> single-tenant demo: everyone who signs in shares one organisation and the
> seeded data is fictional. See [Known limitations](#known-limitations).

---

## Why this exists

The meeting-notes market is commoditised — Otter, Fireflies and Fathom all have
free tiers, and Zoom, Teams and Google now bundle transcription natively.
Summarising a meeting is not a product.

The unsolved part is what happens *after*: a decision gets made, and then
someone has to remember it, retype it into a backlog, decide how urgent it is,
and chase it. MeetPilot targets that gap, and does it in a way that is safe to
point at revenue systems — because the AI proposes and a human disposes.

That last property is the point. In regulated environments, "AI proposed →
human approved → immutably logged" isn't a nice-to-have; it's the control that
makes the automation permissible at all.

## What it does

**Meetings → requests.** Upload a recording or transcript; an LLM produces the
summary, decisions, topics and action items. In the **AI Review** tab it
proposes tickets — then stops.

**The human-in-the-loop gate.** A LangGraph state machine halts at an
`interrupt()` and checkpoints itself. A reviewer approves, or rejects *with
feedback* — in which case the agent re-reasons over the transcript with that
correction and comes back for another round. Nothing reaches an external system
until someone approves.

**The request queue.** Every request against a revenue system — from meetings,
filed directly, or raised by the health monitor — in one queue, ordered
breached-SLA first, then priority, then soonest due.

**The systems registry.** MeetPilot models the GTM systems it governs requests
for (CRM, quoting/CPQ, billing, support desk, partner portal…) rather than
integrating one vendor's API, so a request is filed against a capability with a
named owner regardless of what implements it.

**Monitoring.** A scheduled sweep looks for unowned systems, SLA breaches
clustering on one system, and an ageing untriaged backlog — and files those as
requests itself.

**Audit.** Creation, triage, re-triage, status changes, system registration and
password resets are written to an append-only log with actor and before/after
values.

## Architecture

```
Next.js 14 (App Router)  ──►  Supabase Postgres (RLS on, service-role reads)
        │
        └── HTTP ──►  FastAPI + LangGraph  ──►  checkpointer (SQLite / Postgres)
                      the HITL state machine
```

- **Web** — Next.js 14, TypeScript, Tailwind, NextAuth (credentials + bcrypt), RBAC
- **Data** — Supabase Postgres over PostgREST. RLS is on with no anon policies;
  the app reads through a server-only service-role key
- **Agent** — Python, LangGraph, FastAPI. `meeting_id` doubles as the graph's
  `thread_id`, so a paused approval survives a restart
- **LLM** — any OpenAI-compatible endpoint (`MEETPILOT_LLM_BASE_URL`), currently
  Groq/Llama 3.3, or a deterministic offline mock for demos

## Running it

Prerequisites: Node 18+, Python 3.11+, a Supabase project.

```bash
cp .env.example .env.local          # fill in Supabase + LLM credentials
npm install
npm run db:push                     # schema + DB defaults + RLS
npm run seed && npm run seed:revops # demo org, users, systems, request queue

python3 -m venv orchestrator/.venv
orchestrator/.venv/bin/pip install -r orchestrator/requirements.txt

npm run start:all                   # both services, waits until both answer
```

Then sign in at `http://localhost:3000` — the seed script prints the demo
credentials.

| Script | Purpose |
|---|---|
| `npm run start:all` | Next.js + orchestrator, with readiness checks |
| `npm run start:demo` | …and reset the AI Review state first |
| `npm run db:push` | Prisma push **plus** the defaults/RLS/timestamptz fixes Prisma drops |
| `npm run demo:reset` | Re-date meetings and clear a previous demo run |
| `npm test` | SLA and request-classification tests |

`DEMO.md` has a scene-by-scene walkthrough script.

## Known limitations

Being explicit, because these are things a reviewer shouldn't have to discover
for themselves:

- **Single-tenant.** `ORG_ID` is hardcoded — every signup joins the same
  organisation and sees the same data. This is the main blocker to real users.
- **Integration tokens are stored in plain text** in a column named
  `accessTokenEnc`. Encryption at rest is not implemented.
- **Transcription requires an upload.** There is no calendar integration and no
  auto-join bot, which is what the incumbents lead with.
- **PM-tool sync is one-way.** Pushing to Jira/Asana/Trello works; changes made
  in those tools don't flow back.
- **Email is optional and off by default.** Without `RESEND_API_KEY`, invites
  and password resets can't be delivered — the UI says so rather than
  pretending otherwise, and reset links are logged server-side instead.
- **No rate limiting** on the AI endpoints.

## Licence

MIT — see [LICENSE](LICENSE).
