"""
MeetPilot — HITL Orchestrator API (FastAPI wrapper around the LangGraph runtime)
================================================================================

Decoupled Architecture — why this layer exists
----------------------------------------------
The Next.js frontend is STATELESS HTTP: every request arrives with no memory of
the last one. The LangGraph orchestrator is deeply STATEFUL: a meeting's graph
may sit paused at `human_review_node` for hours while a manager reviews tasks.
This service is the seam between those two worlds:

    Next.js (stateless requests)  ──HTTP──▶  FastAPI (this file)
                                                │  translates request ⇄ state
                                                ▼
                                        LangGraph runtime (hitl_graph.py)
                                                │  checkpoints EVERY step
                                                ▼
                                        SqliteSaver → state.db (durable)

The contract that makes it work: **`meeting_id` == LangGraph `thread_id`.**
Every route derives `{"configurable": {"thread_id": meeting_id}}`, so any
number of disconnected API calls — from different browser tabs, sessions, or
after a full server restart — all address the same durable graph thread.

State Persistence — why SqliteSaver, not MemorySaver
----------------------------------------------------
MemorySaver dies with the process; fine for a terminal demo, disqualifying for
an API where the pause between /process and /review IS the product (the human
approval gate). SqliteSaver writes every checkpoint to `state.db`, so:
  * a paused review survives server restarts and deploys;
  * GET /state is a pure read of checkpointed truth (no in-RAM cache to drift);
  * the audit trail in the state is as durable as the state itself.
Scaling note: swap SqliteSaver → PostgresSaver for multi-instance deployments;
the graph and this API do not change (same checkpointer interface).

Run:  uvicorn main:app --app-dir orchestrator --port 8001
Docs: http://localhost:8001/docs  (OpenAPI, generated from the Pydantic models)
"""

from __future__ import annotations

import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.types import Command
from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator

from hitl_graph import build_graph

# Load orchestrator/.env (LLM provider + key) before the graph reads it. Anchored
# to this file so it works regardless of the directory uvicorn was launched from.
load_dotenv(Path(__file__).parent / ".env")

# ---------------------------------------------------------------------------
# App lifecycle — open the durable checkpointer once, compile the graph once
# ---------------------------------------------------------------------------
# Anchor the DB next to this file so the path is stable regardless of the
# working directory uvicorn was launched from.
DB_PATH = Path(__file__).parent / "state.db"

# Module-level singletons, initialised in the lifespan hook. One compiled graph
# serves every meeting: per-meeting isolation comes from thread_id, not from
# per-request objects — that's what keeps this layer stateless per request.
graph = None
_conn: Optional[sqlite3.Connection] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global graph, _conn
    # check_same_thread=False: FastAPI runs sync endpoints in a threadpool, so
    # the connection must be shareable across threads. SqliteSaver serialises
    # access with an internal lock, which makes this safe.
    _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    checkpointer = SqliteSaver(_conn)
    graph = build_graph(checkpointer=checkpointer)  # inject durable persistence
    yield
    _conn.close()


app = FastAPI(
    title="MeetPilot HITL Orchestrator API",
    description="Stateless HTTP facade over the stateful LangGraph approval workflow.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: the Next.js app calls this API straight from the browser
# (ReviewCenter.tsx fetches http://localhost:8001), which is a cross-origin
# request from :3000. Locked to the frontend origin — not "*" — so review
# decisions can only originate from the MeetPilot UI. Extend via env for
# staging/prod origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000"),
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def _config(meeting_id: str) -> dict:
    """meeting_id → thread_id: the ONE place the mapping is defined."""
    return {"configurable": {"thread_id": meeting_id}}


# ---------------------------------------------------------------------------
# Pydantic models — the validation firewall between the client and the graph
# ---------------------------------------------------------------------------
# Governance note: the graph trusts its state completely, so NOTHING enters it
# without passing these models first. Malformed JSON, wrong types, or empty
# transcripts die here with a 422 — they never reach (or corrupt) a checkpoint.


class ProcessRequest(BaseModel):
    transcript: str = Field(
        ...,
        min_length=20,
        max_length=200_000,
        description="Raw meeting transcript text to extract action items from.",
        examples=["[Weekly Sync] Priya: I'll take the CRM API integration..."],
    )


class ReviewRequest(BaseModel):
    is_approved: bool = Field(
        ..., description="True = human signs off; False = request a revision."
    )
    feedback: str = Field(
        default="",
        max_length=10_000,
        description="Required when rejecting: the correction to apply.",
    )

    @model_validator(mode="after")
    def rejection_requires_feedback(self) -> "ReviewRequest":
        # Governance: a rejection MUST carry an actionable correction —
        # otherwise the self-correction loop would spin without new input.
        if not self.is_approved and not self.feedback.strip():
            raise ValueError("feedback is required when is_approved is false")
        return self


class TaskItem(BaseModel):
    """One proposed ticket. Extra keys from the LLM are tolerated (ignored),
    unknown types are not — the frontend gets a stable, typed shape."""

    summary: str = ""
    assignee: str = ""
    due_date: str = ""
    priority: str = "Medium"
    issue_type: str = "Task"

    # Live models emit explicit nulls ("due_date": null) for anything the
    # transcript didn't state. A field default only covers a MISSING key, not a
    # present-but-null one, so without this every such task 500s the response.
    # Normalising here keeps the null-handling at the boundary and lets the
    # frontend keep treating every field as a plain string.
    @field_validator("summary", "assignee", "due_date", "priority", "issue_type", mode="before")
    @classmethod
    def _null_to_default(cls, v: Any, info: ValidationInfo) -> Any:
        if v is None:
            default = cls.model_fields[info.field_name].default
            return default if isinstance(default, str) else ""
        return v


class AuditEntry(BaseModel):
    ts: str
    actor: str
    action: str
    detail: Any = None


class MeetingState(BaseModel):
    """Canonical read model of a meeting's graph thread, used by all routes.

    `status` is derived server-side so the frontend never has to interpret
    LangGraph internals:
      awaiting_review — paused at the interrupt(); human decision needed
      executed        — approved and written to the CRM (terminal)
      in_progress     — anything between (rare; transient)
    """

    meeting_id: str
    status: Literal["awaiting_review", "executed", "in_progress"]
    extracted_tasks: list[TaskItem] = []
    execution_status: str = ""
    is_approved: bool = False
    revision_count: int = 0
    audit_log: list[AuditEntry] = []


class ProcessAccepted(BaseModel):
    """202 body for /process — extraction done, execution deliberately NOT."""

    meeting_id: str
    status: Literal["awaiting_review"]
    detail: str
    extracted_tasks: list[TaskItem]


# ---------------------------------------------------------------------------
# State helpers — one honest way to read a thread
# ---------------------------------------------------------------------------
def _snapshot(meeting_id: str):
    """Fetch the checkpointed snapshot for a meeting, or None if the thread
    has never been started. This reads from SqliteSaver — durable truth, not
    process memory."""
    snap = graph.get_state(_config(meeting_id))
    # A never-started thread yields an empty snapshot (no checkpoint).
    return snap if snap.values else None


def _is_paused(snap) -> bool:
    """Paused == the interrupt() in human_review_node is pending resolution."""
    return any(task.interrupts for task in snap.tasks)


def _to_meeting_state(meeting_id: str, snap) -> MeetingState:
    values = snap.values
    if _is_paused(snap):
        status = "awaiting_review"
    elif values.get("execution_status") == "executed":
        status = "executed"
    else:
        status = "in_progress"
    return MeetingState(
        meeting_id=meeting_id,
        status=status,
        extracted_tasks=values.get("extracted_tasks", []),
        execution_status=values.get("execution_status", ""),
        is_approved=values.get("is_approved", False),
        revision_count=values.get("revision_count", 0),
        audit_log=values.get("audit_log", []),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post(
    "/meetings/{meeting_id}/process",
    status_code=202,
    response_model=ProcessAccepted,
    responses={409: {"description": "Meeting already processed"}},
)
def process_meeting(meeting_id: str, body: ProcessRequest):
    """Start the workflow for a meeting: extract tasks, then PAUSE for review.

    Returns **202 Accepted** — deliberately not 200/201, because the request is
    accepted but the outcome (CRM tickets) is *pending human approval*. The
    graph runs until the interrupt() in human_review_node, checkpoints to
    SQLite, and parks. Nothing is written to any external system here.
    """
    # Idempotency guard: a thread that already exists must not be silently
    # re-run — that would overwrite an in-flight review or re-open an executed
    # meeting, corrupting the audit story. The client gets an explicit 409.
    if _snapshot(meeting_id) is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Meeting '{meeting_id}' already has a workflow "
            "(use GET /state to inspect it, or POST /review to act on it).",
        )

    graph.invoke({"transcript": body.transcript}, config=_config(meeting_id))

    snap = _snapshot(meeting_id)
    if snap is None or not _is_paused(snap):
        # Defensive: with this graph shape the first invoke ALWAYS parks at
        # review. If it didn't, something structural broke — surface it loudly.
        raise HTTPException(status_code=500, detail="Graph did not pause for review")

    return ProcessAccepted(
        meeting_id=meeting_id,
        status="awaiting_review",
        detail="Tasks extracted. Execution is paused pending human review "
        "(POST /meetings/{meeting_id}/review).",
        extracted_tasks=snap.values.get("extracted_tasks", []),
    )


@app.get(
    "/meetings/{meeting_id}/state",
    response_model=MeetingState,
    responses={404: {"description": "Unknown meeting"}},
)
def get_meeting_state(meeting_id: str):
    """Read the durable state of a meeting's workflow.

    Pure read of the SqliteSaver checkpoint — safe to poll from the frontend,
    valid across restarts, and returns the full audit_log so the UI can render
    the governance trail (who proposed / who approved / what shipped).
    """
    snap = _snapshot(meeting_id)
    if snap is None:
        raise HTTPException(status_code=404, detail=f"No workflow for meeting '{meeting_id}'")
    return _to_meeting_state(meeting_id, snap)


@app.post(
    "/meetings/{meeting_id}/review",
    response_model=MeetingState,
    responses={
        202: {"model": MeetingState, "description": "Revised; paused for re-review"},
        404: {"description": "Unknown meeting"},
        409: {"description": "Meeting is not awaiting review"},
    },
)
def review_meeting(meeting_id: str, body: ReviewRequest):
    """Resolve the human-review interrupt: approve, or reject with feedback.

    Resumes the parked graph with `Command(resume=...)` — the value surfaces as
    the return of `interrupt()` inside human_review_node, exactly where the
    graph stopped. Two outcomes:
      * approved  → conditional edge routes to execution_node → **200** final state
      * rejected  → self-correction loop re-extracts with feedback and parks at
                    review again → **202** revised state (still awaiting review)
    """
    snap = _snapshot(meeting_id)
    if snap is None:
        raise HTTPException(status_code=404, detail=f"No workflow for meeting '{meeting_id}'")
    # State guard: resuming a thread that isn't paused (already executed, or
    # mid-flight) is a client sequencing error, not a graph problem. 409 keeps
    # the graph's integrity instead of letting a stray resume mutate it.
    if not _is_paused(snap):
        raise HTTPException(
            status_code=409,
            detail=f"Meeting '{meeting_id}' is not awaiting review "
            f"(execution_status={snap.values.get('execution_status')!r}).",
        )

    graph.invoke(
        Command(resume={"approved": body.is_approved, "feedback": body.feedback}),
        config=_config(meeting_id),
    )

    result = _to_meeting_state(meeting_id, _snapshot(meeting_id))
    if result.status == "awaiting_review":
        # Rejected → revised draft is parked for another review round: 202.
        return JSONResponse(status_code=202, content=result.model_dump())
    return result  # approved → executed: 200 with the final state + audit trail


@app.get("/healthz")
def healthz():
    """Liveness probe; also confirms the checkpointer DB is reachable."""
    _conn.execute("SELECT 1")
    return {"ok": True, "db": str(DB_PATH.name)}
