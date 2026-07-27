# MeetPilot — Agentic HITL Orchestrator

A **LangGraph** state machine that turns a raw meeting transcript into
**human-approved** tickets in a CRM / ticketing system (Jira, HubSpot, …).

It is the governance layer the MeetPilot web app is missing: today the Next.js
app extracts action items ([`src/lib/ai/summarize.ts`](../src/lib/ai/summarize.ts))
and can push them straight to Jira/Asana/Trello
([`src/lib/integrations/`](../src/lib/integrations/)). This service inserts a
**durable, auditable human approval gate** between "the AI proposed these" and
"these were written to a system of record."

```
START → extractor_node → human_review_node ──approved──→ execution_node → END
                ▲                    │
                └──── feedback ◄──────┘   (self-correction loop)
```

## Quick start

```bash
cd orchestrator
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python hitl_graph.py
```

No API keys needed — it ships with a deterministic `MockChatModel` so the whole
graph runs offline. The demo performs three interactions against one durable
checkpoint thread:

1. **Run 1** — submit the transcript; graph extracts a draft and **pauses**.
2. **Run 2** — human rejects with feedback; the graph loops back, revises
   (deadline → Friday, priority → High), and **pauses again**.
3. **Run 3** — human approves; the graph flows to `execution_node` and mock-POSTs
   each ticket, then prints the append-only audit trail.

## Swapping the mock for a real LLM

The extractor talks to the model through a provider-agnostic seam
(`get_llm()`). Switch with env vars — no code change:

```bash
export MEETPILOT_LLM_PROVIDER=anthropic        # or openai | bedrock
export MEETPILOT_LLM_MODEL=claude-sonnet-4-5
pip install langchain-anthropic                # (see requirements.txt)
export ANTHROPIC_API_KEY=...
python hitl_graph.py
```

`bedrock` uses `langchain-aws` / `ChatBedrock` for the AWS migration path.

## How the four architecture requirements map to the code

| Requirement | Where | Notes |
|---|---|---|
| **1. Typed state machine** | `GraphState` (TypedDict) | `transcript`, `extracted_tasks`, `human_feedback`, `is_approved`, `execution_status` + `revision_count`, `audit_log`. |
| **2. HITL + checkpointing** | `MemorySaver` + `interrupt()` in `human_review_node` | The graph literally cannot reach `execution_node` without a human decision resuming it via `Command(resume=…)`. |
| **3. Three nodes** | `extractor_node`, `human_review_node`, `execution_node` | Execution POST payload matches the real Jira adapter (`project.key`/`summary`/`issuetype`). |
| **4. Self-correction loop** | `route_after_review()` conditional edge | Rejection + feedback re-enters `extractor_node`; approval routes to execution. |

## Governance & auditability (Product-Owner talking points)

- **Single source of truth** — everything the agent knows is in one typed
  `GraphState`; nothing hides in node-local scope.
- **Durable checkpoints** — LangGraph snapshots the full state after every node,
  so a crash mid-review resumes exactly where it paused. `MemorySaver` for local
  dev; swap one import for `SqliteSaver` / `PostgresSaver` for real persistence.
- **Append-only audit log** — `audit_log` uses an append reducer so history can't
  be silently rewritten. Every entry has a UTC timestamp, actor
  (`agent`/`human`/`system`), action, and the state delta — the record you hand
  to compliance to answer *"who approved this CRM write, and what did the AI
  originally propose vs. what shipped?"*
- **Explicit HITL barrier** — `interrupt()` makes the pause a first-class,
  inspectable event (`graph.get_state(config)`), not a `sleep()` or polling hack.

## The HTTP API (`main.py`)

A FastAPI facade that lets the stateless Next.js frontend drive the stateful
graph. State is checkpointed to **`state.db` via `SqliteSaver`**, so a paused
review survives server restarts and deploys. The contract:
**`meeting_id` == LangGraph `thread_id`** — every meeting is its own durable,
replayable, auditable thread.

```bash
cd orchestrator && source .venv/bin/activate
uvicorn main:app --port 8001          # OpenAPI docs at /docs
```

| Route | Verb | Behaviour |
|---|---|---|
| `/meetings/{id}/process` | POST | `{transcript}` → extract, checkpoint, **pause**. Returns **202** + `extracted_tasks`. **409** if the meeting already has a workflow. |
| `/meetings/{id}/state` | GET | Pure read of the SQLite checkpoint: tasks, `execution_status`, full `audit_log`. **404** if unknown. |
| `/meetings/{id}/review` | POST | `{is_approved, feedback}` → `Command(resume=…)`. Approve → **200** final executed state; reject → self-correction loop revises and re-pauses → **202** revised state. **409** if not awaiting review. |

Validation firewall (Pydantic): malformed bodies die with **422** before they
can touch a checkpoint — including a governance rule that a **rejection must
carry feedback** (otherwise the correction loop would spin with no new input).

Example session:

```bash
curl -X POST localhost:8001/meetings/m1/process \
  -H 'Content-Type: application/json' \
  -d '{"transcript": "Priya: I will take the CRM API integration..."}'          # 202

curl -X POST localhost:8001/meetings/m1/review \
  -H 'Content-Type: application/json' \
  -d '{"is_approved": false, "feedback": "Deadline to Friday, high priority"}'  # 202 revised

# (kill and restart uvicorn here — the paused review survives in state.db)

curl localhost:8001/meetings/m1/state                                           # still awaiting_review
curl -X POST localhost:8001/meetings/m1/review \
  -H 'Content-Type: application/json' -d '{"is_approved": true}'                # 200 executed
```

From the Next.js side, call these routes from the existing API layer (e.g.
`src/app/api/meetings/[id]/…` route handlers) with the MeetPilot meeting id as
`{id}`; render `extracted_tasks` for review and `audit_log` as the governance
trail. Scale-out note: swap `SqliteSaver` → `PostgresSaver` (one import) when
running more than one API instance.
