# MeetPilot — Demo Recording Guide

A ~5 minute walkthrough that shows the whole product: AI meeting minutes, the
human-in-the-loop approval gate, and the push to a ticketing system.

---

## 1. Before you hit record

```bash
cd ~/Desktop/meetpilot-work2
npm run start:demo            # both servers + fresh AI Review state
node scripts/reset-demo.mjs   # re-dates meetings so the dashboard looks full
npm run seed:revops           # GTM systems + a realistic request queue
```

`start:demo` runs `./scripts/start.sh --fresh`. It:
- frees ports 3000 / 8001 (so nothing drifts to port 3001 mid-demo),
- starts the Next.js app **and** the Python LangGraph orchestrator,
- waits until both actually answer before printing "MeetPilot is running",
- wipes `orchestrator/state.db` so the AI Review tab starts at "Not started".

Wait for:

```
  App:          http://localhost:3000
  Login:        varan@acme.io / acme1234
```

**Pre-flight checklist**
- [ ] Browser at `http://localhost:3000/login`, already filled with the demo user
- [ ] Zoom the browser to ~110% (`Cmd +`) — small text is unreadable in video
- [ ] Close other tabs; hide bookmarks bar (`Cmd+Shift+B`)
- [ ] Turn on Do Not Disturb (no notification popups on camera)
- [ ] Have this file open on a second screen/phone as your script

---

## 2. How to record

**Built into macOS (no install):** `Cmd + Shift + 5` → *Record Selected Portion*
or *Record Entire Screen* → **Options → Microphone → MacBook Microphone** (so
your narration is captured) → **Record**. Stop from the menu bar. Saves a `.mov`
to your Desktop.

**Loom** (`loom.com/download`) is nicer for sharing — it gives you a link
instantly, a webcam bubble, and trimming. Free tier caps at 5 min per video,
which is exactly this script's length.

---

## 3. The script

### Scene 1 — The problem (20s, on the landing page)
> "Every team has the same problem: decisions get made in meetings, and then
> they evaporate. Someone's supposed to take notes, tickets never get filed, and
> two weeks later nobody remembers who owned what. MeetPilot fixes that — and
> it does it without letting AI write to your systems unsupervised."

Show `http://localhost:3000` — scroll slowly through the feature grid.

### Scene 2 — Sign in + dashboard (25s)
Click **Sign In** → lands on the dashboard.
> "This is the workspace for Acme Industries. Upcoming meetings, recent meetings,
> the team and their roles. Everything here is live from Postgres — this isn't a
> prototype with mock data."

Point at: Upcoming meeting, Recent meeting with its **"Summary ready"** badge, and
the role badges (Global Admin / Admin / Reviewer).

### Scene 3 — The meeting hub (40s)
Open **Weekly Sync — Acme pilot** from Recent meetings.
> "Here's a meeting that already happened. There's a real video room — camera,
> mic, screen share. Alongside it are the minutes: agenda, decisions, and action
> items with owners."

Walk the tabs: **Call** → **Agenda** → **Summary** (executive summary, key
decisions, and a topics chart — all AI-generated) → **Action Items**.

### Scene 4 — AI extraction (45s) ⭐ the core
Click the **AI Review** tab. It reads *"Not started"*.
> "Now the interesting part. The meeting has a transcript. Let's have the AI turn
> it into tickets."

Click **Run AI extraction**. Wait ~2s.
> "That's a real LLM — Llama 3.3 running on Groq — reading the transcript and
> pulling out three tasks. It figured out the owners from who spoke, classified
> them by type, and assigned priority. Notice the security review got flagged
> High."

Point at the three task cards and the **"Awaiting review"** badge.

### Scene 5 — The governance gate (60s) ⭐ the differentiator
> "Here's what makes this enterprise-safe. The AI has *not* written anything
> anywhere. The workflow is paused, waiting for a human. This is a LangGraph
> state machine that literally halts execution at an interrupt and checkpoints
> itself to disk."

Type into the feedback box:
```
The CRM integration is the critical path — mark it High priority and set the due date to this Friday.
```
Click **Request changes**.
> "I'm not editing the ticket by hand — I'm sending the AI feedback. It
> re-reasons over the transcript with my correction and comes back for another
> round of approval."

Point at: the badge now reads **rev 1**, the CRM task flipped **Medium → High**
with **due this Friday**, and the other two are untouched.

Scroll to the **Audit trail**.
> "And every step is recorded: the AI proposed, a human rejected with this exact
> reason, the AI revised. That's your compliance trail."

### Scene 6 — Approve and execute (30s)
Click **Approve & execute**.
> "Now — and only now — it writes to the ticketing system."

Point at the green **"Approved & written to CRM"** block with MEET-1000/1001/1002,
the line underneath — **"3 tickets created in MeetPilot — view in Tickets"** — and
the audit trail's final entries: *Human approved* → *Wrote 3 tickets*.
> "Three tickets in the external tracker, and the same three created inside
> MeetPilot. Full chain of custody from a spoken sentence to a filed ticket,
> with a named human accountable for the decision."

Click **view in Tickets** — it navigates straight to the populated list.

### Scene 7 — The RevOps queue (45s) ⭐ the positioning
Click **Requests** in the sidebar.
> "Here's why this matters beyond meetings. Every request against a revenue
> system lands in one queue — the ones from meetings, the ones people file
> directly, and the ones our monitors raise automatically. It's ordered the way
> a RevOps owner actually works: anything with a breached SLA first, then by
> priority, then by what's due soonest."

Point at: the **Overdue by 6h** row at the top, the **SLA breached** and
**Awaiting triage** counters, and the three requests tagged *From meeting* that
you just created. Hit **Escalate** on one — the SLA recalculates instantly.

Click **Systems**.
> "And every request is filed against a system we own the definition of —
> CRM, quoting, billing, partner portal — each with a named owner and a health
> status. That's how you answer 'who owns this and what's it costing us'
> without opening a spreadsheet."

Point at **Quoting engine** showing *Degraded* with its breached request.

### Scene 8 — Governance evidence (20s)
Go to **Settings → Audit log**.
> "Every triage decision is recorded — who changed what, from what to what.
> Not a log file: a queryable audit trail in the product."

### Scene 9 — The rest (30s)
- **Analytics** — org-wide rollup: meetings, open/done items, top topics
- **Users** — invite teammates, change roles (RBAC)
- **Settings** — "bring your own AI": any OpenAI-compatible provider

> "Same story throughout: real database, real auth, real integrations."

### Scene 10 — Close (15s)
> "MeetPilot: requests captured where they're raised, triaged against an SLA,
> and executed only after a human signs off — with a full audit trail. Next.js
> and Postgres on the front, a Python LangGraph orchestrator doing the agentic
> work on the back."

---

## 4. If something goes wrong on camera

| Symptom | Fix |
|---|---|
| AI Review says "AI orchestrator unreachable" | The Python service died. `npm run start:demo` again. |
| Extraction hangs >10s | Groq rate limit. Set `MEETPILOT_LLM_PROVIDER=mock` in `orchestrator/.env` and restart — instant, deterministic, still shows the full flow. |
| AI Review shows "Executed" already | State wasn't reset. `rm -f orchestrator/state.db` then restart. |
| Dashboard says "No upcoming meetings" | `node scripts/reset-demo.mjs` |
| Dupe "Instant meeting" rows clutter the list | `node scripts/reset-demo.mjs --clean` (deletes only ad-hoc test meetings) |

**The safest possible recording setup:** set `MEETPILOT_LLM_PROVIDER=mock` in
`orchestrator/.env`. The graph then runs a deterministic built-in extractor —
no network, no rate limits, identical output every take. The flow, the pause,
the revision loop, and the audit trail all behave exactly the same. Use real
Groq if you want to say "that's a live LLM" on camera; use mock if you want
zero risk of a hiccup during a take.

---

## 5. What to say if asked "is this real?"

- **Database** — Supabase Postgres, 21 tables, Row Level Security on, app reads
  through a server-only service key.
- **Auth** — NextAuth with bcrypt password hashes and role-based access control.
- **AI** — any OpenAI-compatible provider (currently Groq / Llama 3.3), configured
  in Settings, not hardcoded.
- **Agent** — Python LangGraph state machine with `interrupt()` for the HITL gate
  and a SQLite checkpointer, so a paused approval survives a server restart.
- **Integrations** — Jira / Asana / Trello / Slack adapters against their real
  REST APIs; the CRM write in the demo is a mock endpoint so it's safe to run
  live without creating junk in a real Jira.
