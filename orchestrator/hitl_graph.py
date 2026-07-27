"""
MeetPilot — Agentic Action-Item Orchestrator (Human-in-the-Loop)
================================================================

A LangGraph state machine that turns a raw meeting transcript into governed,
human-approved work items in a CRM / ticketing system (Jira, HubSpot, ...).

Why this exists
---------------
The MeetPilot web app (Next.js/TypeScript) already extracts action items and
can *push* them straight to Jira/Asana/Trello. What it lacks is a **governed,
auditable, human-in-the-loop (HITL) approval gate** between "the AI proposed
these tasks" and "these tasks were created in a system of record." For an
enterprise RevOps tool that mutates customer/CRM data, an un-reviewed autonomous
write is a compliance and trust problem. This service is that missing gate.

The flow is a durable state machine:

    START
      │
      ▼
  ┌───────────────┐      feedback (revise)
  │ extractor_node│◄─────────────────────────────┐
  └───────┬───────┘                               │
          ▼                                        │
  ┌───────────────┐   interrupt() → PAUSE ─────────┘
  │human_review_..│   (graph halts; operator decides)
  └───────┬───────┘
          │ approved
          ▼
  ┌───────────────┐
  │ execution_node│  mock POST → Jira / HubSpot
  └───────┬───────┘
          ▼
         END

Governance & Auditability (the interview talking points)
--------------------------------------------------------
1. **Single source of truth**: every fact the agent knows lives in one typed
   `GraphState`. Nothing is hidden in a node's local scope. A Product Owner can
   point at the state and say exactly what the system believed at each step.
2. **Durable checkpoints**: LangGraph's checkpointer snapshots the ENTIRE state
   after every node. If the process dies mid-review, the pending approval is not
   lost — it resumes from the last checkpoint. (MemorySaver here for the local
   demo; swap for SqliteSaver/PostgresSaver for real persistence — one line.)
3. **Append-only audit log**: `state["audit_log"]` records every actor, action,
   and state delta with a UTC timestamp. This is the record you hand to
   security/compliance to answer "who approved writing this to the CRM, and
   what did the AI originally propose vs. what shipped?"
4. **Explicit HITL barrier**: `interrupt()` makes the pause a first-class,
   inspectable event — not a sleep() or a polling hack. The graph literally
   cannot reach `execution_node` without a human decision flowing back in.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Annotated, Any, Optional, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages  # noqa: F401  (kept for reference)
from langgraph.types import Command, interrupt


# ---------------------------------------------------------------------------
# 1. GRAPH STATE  —  the single, typed source of truth (Governance requirement)
# ---------------------------------------------------------------------------
def _append(existing: Optional[list], new: Optional[list]) -> list:
    """Reducer: make `audit_log` APPEND-ONLY across node updates.

    Governance note: a node returning `{"audit_log": [entry]}` *adds* to the
    trail instead of overwriting it. An append-only log is what makes the state
    defensible in an audit — history cannot be silently rewritten by a later
    node."""
    return (existing or []) + (new or [])


class GraphState(TypedDict):
    # --- inputs --------------------------------------------------------------
    transcript: str
    # --- AI working memory ---------------------------------------------------
    extracted_tasks: list  # list[dict]: the current DRAFT of proposed tickets
    # --- human-in-the-loop channel ------------------------------------------
    human_feedback: str  # free-text correction from the reviewer ("" = none)
    is_approved: bool  # True only when a human explicitly signs off
    # --- outcome -------------------------------------------------------------
    execution_status: str  # "pending" | "executed" | "rejected" ...
    # --- governance ----------------------------------------------------------
    revision_count: int  # how many self-correction loops we've run
    audit_log: Annotated[list, _append]  # append-only, timestamped trail


def _audit(actor: str, action: str, detail: Any) -> dict:
    """Build one immutable audit entry. Every state transition emits one of
    these so the trail reads like a governance ledger, not a debug print."""
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "actor": actor,  # "agent" | "human" | "system"
        "action": action,
        "detail": detail,
    }


# ---------------------------------------------------------------------------
# 2. LLM PROVIDER  —  swappable placeholder (OpenAI / Anthropic / Bedrock)
# ---------------------------------------------------------------------------
# The extractor talks to an LLM through a tiny, provider-agnostic seam. Set
# MEETPILOT_LLM_PROVIDER to swap providers without touching graph logic — the
# exact "swap for AWS Bedrock later" seam the brief asks for. Defaults to a
# deterministic MOCK so the whole graph runs offline with zero API keys (that
# is what makes this a *running* demo, not a stub that needs secrets).


class MockChatModel:
    """Deterministic stand-in for ChatOpenAI / ChatAnthropic / ChatBedrock.

    Mirrors the real LangChain chat-model interface (`.invoke(messages) ->
    obj.content`) so the extractor code is identical whether it is driving a
    mock or a live model. It also *honours human feedback* (deadline/priority
    keywords) so the self-correction loop produces visibly different output on
    the second pass — proving the loop actually feeds back into generation."""

    def invoke(self, messages: list) -> SimpleNamespace:
        system = next((m[1] for m in messages if m[0] == "system"), "")
        user = next((m[1] for m in messages if m[0] == "user"), "")
        feedback = ""
        if "FEEDBACK:" in user:
            feedback = user.split("FEEDBACK:", 1)[1].strip().lower()

        # Base draft "extracted" from the dummy transcript.
        friday = _next_weekday(4)  # 0=Mon ... 4=Fri
        eom = _end_of_month()
        tasks = [
            {
                "summary": "Ship CRM API integration for the Acme pilot",
                "assignee": "Priya",
                "due_date": eom,
                "priority": "Medium",
                "issue_type": "Task",
            },
            {
                "summary": "Draft customer onboarding runbook",
                "assignee": "Marco",
                "due_date": eom,
                "priority": "Medium",
                "issue_type": "Task",
            },
            {
                "summary": "Schedule security review of the new data export",
                "assignee": "Dana",
                "due_date": eom,
                "priority": "Low",
                "issue_type": "Task",
            },
        ]

        # --- apply reviewer feedback (the "self-correction" behaviour) --------
        if feedback:
            for t in tasks:
                is_api = "api" in t["summary"].lower()
                if is_api and "friday" in feedback:
                    t["due_date"] = friday
                if is_api and ("high priority" in feedback or "urgent" in feedback):
                    t["priority"] = "High"

        return SimpleNamespace(content=json.dumps({"tasks": tasks}))


def get_llm():
    """Factory: return a chat model matching MEETPILOT_LLM_PROVIDER.

    provider = mock (default) | anthropic | openai | bedrock
    Swapping to Bedrock later is a one-liner env change, not a code change."""
    provider = os.getenv("MEETPILOT_LLM_PROVIDER", "mock").lower()
    model = os.getenv("MEETPILOT_LLM_MODEL", "")

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic  # pip install langchain-anthropic

        return ChatAnthropic(model=model or "claude-sonnet-4-5", temperature=0)
    if provider == "openai":
        from langchain_openai import ChatOpenAI  # pip install langchain-openai

        # base_url makes this branch work with ANY OpenAI-compatible endpoint —
        # Groq, Together, vLLM, Ollama, LM Studio — not just api.openai.com.
        # Same "bring your own LLM" posture as the web app's src/lib/ai/groq.ts.
        return ChatOpenAI(
            model=model or "gpt-4o-mini",
            temperature=0,
            base_url=os.getenv("MEETPILOT_LLM_BASE_URL") or None,
            api_key=os.getenv("MEETPILOT_LLM_API_KEY") or os.getenv("OPENAI_API_KEY"),
        )
    if provider == "bedrock":
        from langchain_aws import ChatBedrock  # pip install langchain-aws

        return ChatBedrock(model_id=model or "anthropic.claude-3-5-sonnet-20241022-v2:0")
    return MockChatModel()


def _next_weekday(weekday: int) -> str:
    today = datetime.now(timezone.utc).date()
    ahead = (weekday - today.weekday()) % 7
    ahead = ahead or 7  # always land on the *next* one, never today
    return (today + timedelta(days=ahead)).isoformat()


def _end_of_month() -> str:
    today = datetime.now(timezone.utc).date()
    first_next = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
    return (first_next - timedelta(days=1)).isoformat()


def _parse_tasks(raw: str) -> list:
    """Tolerant JSON parse — strips ```json fences a real model might emit."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        cleaned = cleaned[4:] if cleaned.lower().startswith("json") else cleaned
    try:
        data = json.loads(cleaned)
        return data.get("tasks", data) if isinstance(data, dict) else data
    except (json.JSONDecodeError, AttributeError):
        return []


# ---------------------------------------------------------------------------
# 3. NODES
# ---------------------------------------------------------------------------
EXTRACTOR_SYSTEM = (
    "You are MeetPilot's action-item extractor. Read the meeting transcript and "
    "return STRICT JSON: {\"tasks\": [{\"summary\", \"assignee\", \"due_date\" "
    "(YYYY-MM-DD), \"priority\" (Low|Medium|High), \"issue_type\"}]}. Only use "
    "facts present in the transcript. If revision feedback is supplied, apply it "
    "faithfully and regenerate the full task list."
)


def extractor_node(state: GraphState) -> dict:
    """Extract (or REVISE) the draft task list from the transcript.

    Runs on the first pass AND on every self-correction loop. On a revision it
    folds `human_feedback` into the prompt so the LLM regenerates against the
    reviewer's correction — the state carries the context, the node stays
    stateless."""
    llm = get_llm()
    feedback = state.get("human_feedback", "")
    revision = state.get("revision_count", 0)

    user = f"TRANSCRIPT:\n{state['transcript']}"
    if feedback:
        # Governance: prior draft + correction are both shown to the model so
        # the revision is traceable to a specific human instruction.
        user += (
            f"\n\nPREVIOUS_DRAFT:\n{json.dumps(state.get('extracted_tasks', []))}"
            f"\n\nFEEDBACK: {feedback}"
        )

    resp = llm.invoke([("system", EXTRACTOR_SYSTEM), ("user", user)])
    tasks = _parse_tasks(resp.content)

    action = "revise_tasks" if feedback else "extract_tasks"
    return {
        "extracted_tasks": tasks,
        "human_feedback": "",  # consume the feedback so it doesn't re-trigger
        "revision_count": revision + (1 if feedback else 0),
        "audit_log": [
            _audit("agent", action, {"task_count": len(tasks), "tasks": tasks,
                                     "applied_feedback": feedback or None})
        ],
    }


def human_review_node(state: GraphState) -> dict:
    """THE HITL BARRIER. `interrupt()` durably pauses the graph here.

    Execution does not proceed past this node until a human resumes it with a
    decision. On resume, `interrupt(...)` returns the value passed via
    `Command(resume=...)`. That value is the reviewer's verdict:
        {"approved": bool, "feedback": str}

    Governance: because the checkpointer snapshots state *before* this returns,
    the pending approval survives a crash/restart and is fully inspectable
    (`graph.get_state(config)`)."""
    decision = interrupt(
        {
            "type": "action_item_review",
            "message": "Review proposed tickets before they are written to the CRM.",
            "proposed_tasks": state["extracted_tasks"],
            "respond_with": {"approved": "bool", "feedback": "str (optional)"},
        }
    )

    approved = bool(decision.get("approved", False))
    feedback = (decision.get("feedback") or "").strip()

    return {
        "is_approved": approved,
        "human_feedback": "" if approved else feedback,
        "execution_status": "approved" if approved else "revision_requested",
        "audit_log": [
            _audit(
                "human",
                "approve" if approved else "request_changes",
                {"approved": approved, "feedback": feedback or None},
            )
        ],
    }


def execution_node(state: GraphState) -> dict:
    """Mock the system-of-record write (Jira / HubSpot POST).

    Reached ONLY when `is_approved` is True (enforced by the conditional edge).
    The payload shape matches the real Jira adapter in the MeetPilot web app
    (src/lib/integrations/jira.ts): project.key + summary + description +
    issuetype — so making this a live call later is a drop-in."""
    created = []
    for task in state["extracted_tasks"]:
        payload = {
            "fields": {
                "project": {"key": os.getenv("JIRA_PROJECT_KEY", "MEET")},
                "summary": task.get("summary", ""),
                "description": (
                    f"Assignee: {task.get('assignee', 'Unassigned')}\n"
                    f"Due: {task.get('due_date', 'n/a')}\n"
                    f"Priority: {task.get('priority', 'Medium')}\n\n"
                    "Created by MeetPilot HITL orchestrator after human approval."
                ),
                "issuetype": {"name": task.get("issue_type", "Task")},
            }
        }
        # --- MOCK POST -------------------------------------------------------
        # Real call would be:
        #   requests.post(f"https://{site}/rest/api/2/issue", json=payload, auth=...)
        ticket_id = f"MEET-{1000 + len(created)}"
        print(f"    → POST /rest/api/2/issue  →  201 Created  {ticket_id}  "
              f"({payload['fields']['summary']})")
        created.append({"id": ticket_id, "summary": payload["fields"]["summary"]})

    return {
        "execution_status": "executed",
        "audit_log": [
            _audit("system", "crm_write", {"tickets_created": created,
                                           "count": len(created)})
        ],
    }


# ---------------------------------------------------------------------------
# 4. ROUTING  —  the self-correction loop lives in this conditional edge
# ---------------------------------------------------------------------------
def route_after_review(state: GraphState) -> str:
    """Approved → execute. Otherwise loop back to the extractor to revise.

    This single edge IS the self-correction loop: rejection with feedback
    re-enters `extractor_node`, which will halt again at review. There is no
    path to `execution_node` that skips human approval."""
    return "execution_node" if state.get("is_approved") else "extractor_node"


def build_graph(checkpointer=None):
    builder = StateGraph(GraphState)
    builder.add_node("extractor_node", extractor_node)
    builder.add_node("human_review_node", human_review_node)
    builder.add_node("execution_node", execution_node)

    builder.add_edge(START, "extractor_node")
    builder.add_edge("extractor_node", "human_review_node")
    builder.add_conditional_edges(
        "human_review_node",
        route_after_review,
        {"execution_node": "execution_node", "extractor_node": "extractor_node"},
    )
    builder.add_edge("execution_node", END)

    # The checkpointer is INJECTED so each runtime picks its own durability:
    #   - terminal demo (below): MemorySaver — in-process, zero setup
    #   - FastAPI service (main.py): SqliteSaver — survives restarts, which is
    #     what makes a stateless HTTP frontend safe to disconnect/reconnect.
    # Same interface either way (PostgresSaver too) — the graph never changes.
    # That swappable durability seam is the "auditability" backbone.
    return builder.compile(checkpointer=checkpointer or MemorySaver())


# ---------------------------------------------------------------------------
# 5. TERMINAL DEMO  —  three interactions against one durable thread
# ---------------------------------------------------------------------------
DUMMY_TRANSCRIPT = """\
[Weekly Sync — Acme pilot]
Priya: I'll take the CRM API integration for the Acme pilot. Targeting end of month.
Marco: I'll draft the customer onboarding runbook so support can self-serve.
Dana: We should get a security review booked for the new data export path.
Jordan: Agreed. Let's make sure nothing ships to a customer without sign-off.
"""


def _print_interrupt(graph, config) -> None:
    """Surface the pending HITL interrupt from the checkpointed state."""
    snapshot = graph.get_state(config)
    interrupts = [i for task in snapshot.tasks for i in task.interrupts]
    print(f"  ⏸  GRAPH PAUSED at node(s): {snapshot.next}")
    if interrupts:
        payload = interrupts[0].value
        print("  ⏸  Awaiting human review of proposed tasks:")
        for t in payload["proposed_tasks"]:
            print(f"        • [{t['priority']}] {t['summary']} "
                  f"(→ {t['assignee']}, due {t['due_date']})")


def main() -> None:
    graph = build_graph()
    # thread_id ties all three runs to ONE durable conversation/checkpoint line.
    # In production this is the meeting id — every meeting is its own auditable
    # thread the checkpointer can replay.
    config = {"configurable": {"thread_id": "meeting-acme-pilot-0001"}}

    print("=" * 72)
    print("RUN 1 — submit transcript; graph extracts then PAUSES for review")
    print("=" * 72)
    graph.invoke({"transcript": DUMMY_TRANSCRIPT}, config=config)
    _print_interrupt(graph, config)

    print("\n" + "=" * 72)
    print("RUN 2 — human REJECTS the draft with feedback → self-correction loop")
    print("=" * 72)
    print("  ▶  Human resumes with: approved=False, "
          "feedback='API deadline is too loose — change it to this Friday and "
          "make it high priority.'")
    graph.invoke(
        Command(
            resume={
                "approved": False,
                "feedback": "API deadline is too loose — change it to this "
                "Friday and make it high priority.",
            }
        ),
        config=config,
    )
    _print_interrupt(graph, config)  # revised draft, paused again

    print("\n" + "=" * 72)
    print("RUN 3 — human APPROVES the revised draft → flows to execution")
    print("=" * 72)
    print("  ▶  Human resumes with: approved=True")
    graph.invoke(Command(resume={"approved": True}), config=config)

    final = graph.get_state(config).values
    print(f"\n  ✅ execution_status = {final['execution_status']!r}  "
          f"(after {final['revision_count']} revision loop[s])")

    # ---- The governance artefact: the full append-only audit trail ----------
    print("\n" + "-" * 72)
    print("AUDIT TRAIL (append-only — the record you hand to compliance)")
    print("-" * 72)
    for i, entry in enumerate(final["audit_log"], 1):
        print(f"  {i}. [{entry['ts']}] {entry['actor']:<6} {entry['action']}")
        print(f"       {json.dumps(entry['detail'])[:120]}")


if __name__ == "__main__":
    main()
