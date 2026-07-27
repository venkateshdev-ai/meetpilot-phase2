#!/usr/bin/env bash
# Start the full MeetPilot stack (Next.js + LangGraph orchestrator) in one go.
#
#   ./scripts/start.sh              # start both, stream logs
#   ./scripts/start.sh --fresh      # also reset the HITL demo state (see below)
#
# Ctrl+C stops both. Logs stream to this terminal and to scripts/logs/.

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
mkdir -p scripts/logs

# --fresh wipes orchestrator/state.db, the LangGraph checkpoint store. That is
# demo state only (which meetings have been AI-reviewed) — no app data lives
# there, so a reset just puts every meeting's AI Review tab back to "Not
# started", which is what you want before recording a walkthrough.
if [[ "${1:-}" == "--fresh" ]]; then
  rm -f orchestrator/state.db
  echo "→ HITL demo state reset (every meeting's AI Review starts fresh)"
fi

# Free the ports so a stale process from a previous run can't shadow this one.
# This must actually succeed: if :3000 is still occupied, Next.js silently
# falls back to :3001, which breaks the orchestrator's CORS allow-list and the
# login callback URL — a failure you'd only notice mid-demo.
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [[ -z "$pids" ]] && return 0
  echo "→ freeing port $port (pids: $(echo "$pids" | tr '\n' ' '))"
  # shellcheck disable=SC2086 # word splitting is intended: one kill per pid
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 10); do
    sleep 0.5
    lsof -ti:"$port" -sTCP:LISTEN > /dev/null 2>&1 || return 0
  done
  # Still holding on — escalate, then confirm.
  pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
  [[ -n "$pids" ]] && kill -9 $pids 2>/dev/null || true
  sleep 1
  if lsof -ti:"$port" -sTCP:LISTEN > /dev/null 2>&1; then
    echo "   ✗ port $port is still occupied — stop that process and re-run"
    exit 1
  fi
}
free_port 3000
free_port 8001

cleanup() {
  echo ""
  echo "→ shutting down..."
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "→ starting orchestrator (FastAPI + LangGraph) on :8001"
( cd orchestrator && ./.venv/bin/uvicorn main:app --port 8001 ) \
  > scripts/logs/orchestrator.log 2>&1 &
API_PID=$!

echo "→ starting Next.js on :3000"
# -p 3000 pins the port: without it Next.js would drift to 3001 on a conflict.
npx next dev -p 3000 > scripts/logs/web.log 2>&1 &
WEB_PID=$!

# Wait for both to answer before declaring the stack ready, so you never start
# recording against a half-booted app.
wait_for() {
  local url=$1 name=$2
  for _ in $(seq 1 60); do
    if curl -sf -m 2 "$url" > /dev/null 2>&1; then
      echo "   ✓ $name ready"
      return 0
    fi
    sleep 1
  done
  echo "   ✗ $name did not come up — check scripts/logs/"
  return 1
}

wait_for http://localhost:8001/healthz "orchestrator"
wait_for http://localhost:3000 "web app"

echo ""
echo "  MeetPilot is running"
echo "  ─────────────────────────────────────────────"
echo "  App:          http://localhost:3000"
echo "  Login:        varan@acme.io / acme1234"
echo "  API docs:     http://localhost:8001/docs"
echo "  Logs:         scripts/logs/{web,orchestrator}.log"
echo ""
echo "  Ctrl+C to stop both."
echo ""

# Stream both logs until interrupted.
tail -f scripts/logs/web.log scripts/logs/orchestrator.log
