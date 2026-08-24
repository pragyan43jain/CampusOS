#!/usr/bin/env bash
# ============================================================
#  CampusOS — local launcher
#
#  Usage:
#     ./start_local.sh              # backend + frontend
#     ./start_local.sh --backend    # backend only (review the API at /docs)
#     ./start_local.sh --frontend   # frontend only (UI still has mock data)
#
#  Stop everything with Ctrl+C.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
BACKEND_LOG="$ROOT/.backend.log"

MODE="both"
case "${1:-}" in
  --frontend|-f) MODE="frontend" ;;
  --backend|-b)  MODE="backend" ;;
  "")            MODE="both" ;;
  *) echo "Unknown option: $1  (use --backend, --frontend, or no argument)"; exit 64 ;;
esac

pids=()
cleanup() {
  echo
  echo "Shutting down CampusOS..."
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
  exit "${1:-0}"
}
trap cleanup INT TERM

# ---------- Backend (FastAPI) ----------
if [[ "$MODE" != "frontend" ]]; then
  if [[ ! -d "$BACKEND" ]]; then
    echo "!! No backend directory at $BACKEND"
    exit 1
  fi

  # Is something already on :8000? Checked before anything slow, and before the
  # dependency install, so a stale server is reported in a second rather than
  # after a package download. If it's an older build, reviewing it would show you
  # the code you're trying to replace.
  running_version="$(python3 - <<'PY' 2>/dev/null || true
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:8000/", timeout=1.5) as r:
        print(json.load(r).get("version", "unknown"))
except Exception:
    pass
PY
)"
  if [[ -n "$running_version" ]]; then
    echo "!! Something is already serving http://127.0.0.1:8000 (version: $running_version)."
    if [[ "$running_version" != "2.0.0" ]]; then
      echo "   That is not this build (expected 2.0.0) — stop it first, or you will"
      echo "   be reviewing the old backend."
      exit 1
    fi
    echo "   It reports version 2.0.0, so it is probably this build already running."
    echo "   Stop it and re-run if you want a clean start."
    exit 1
  fi

  # Check every import the backend actually needs. The old check only looked for
  # uvicorn, so a machine with uvicorn but no fastapi skipped the install and then
  # died on import — after which the UI quietly served invented data instead.
  if ! python3 -c "import fastapi, uvicorn, requests, bs4, pydantic" >/dev/null 2>&1; then
    echo "==> Installing Python dependencies (first run only)..."
    if ! python3 -m pip install -r "$BACKEND/requirements.txt"; then
      echo
      echo "!! pip install failed. Fix that before continuing — a half-installed"
      echo "   backend is worse than none, because the UI hides the failure."
      exit 1
    fi
  fi

  echo "==> Backend  -> http://localhost:8000   (interactive API docs at /docs)"
  echo "    log: $BACKEND_LOG"
  # Logged to a file rather than the shared terminal: when a request fails, the
  # traceback is the evidence, and interleaved Vite output buries it.
  ( cd "$BACKEND" && exec python3 -m uvicorn app.main:app \
      --host 127.0.0.1 --port 8000 --reload ) >"$BACKEND_LOG" 2>&1 &
  backend_pid=$!
  pids+=("$backend_pid")

  # Wait for it to actually answer. Claiming success before this point is how the
  # previous script let a crashed backend look like a working dashboard.
  echo -n "    waiting for the backend to answer"
  health=""
  backend_died=0
  for _ in $(seq 1 40); do
    health="$(python3 - <<'PY' 2>/dev/null || true
import json, urllib.request
try:
    with urllib.request.urlopen("http://127.0.0.1:8000/", timeout=1) as r:
        body = json.load(r)
    print(f"{body.get('version')}|{body.get('vtopConnected')}|{body.get('lastSynced')}")
except Exception:
    pass
PY
)"
    [[ -n "$health" ]] && break
    # If the process is already gone there is nothing to wait for; spinning out
    # the full timeout just delays the error you need to read.
    if ! kill -0 "$backend_pid" 2>/dev/null; then
      backend_died=1
      break
    fi
    echo -n "."
    sleep 0.5
  done
  echo

  if [[ -z "$health" ]]; then
    echo
    if [[ "$backend_died" -eq 1 ]]; then
      echo "!! The backend process exited immediately."
    else
      echo "!! The backend started but never answered on :8000."
    fi
    if [[ -s "$BACKEND_LOG" ]]; then
      echo "   Last 25 lines of $BACKEND_LOG:"
      echo "------------------------------------------------------------"
      tail -n 25 "$BACKEND_LOG" || true
      echo "------------------------------------------------------------"
    else
      echo "   It produced no output at all ($BACKEND_LOG is empty), which usually"
      echo "   means uvicorn itself is not installed properly. Try:"
      echo "       python3 -m pip install -r backend/requirements.txt"
      echo "       cd backend && python3 -m uvicorn app.main:app --port 8000"
    fi
    echo "   Not starting the frontend: it would fall back to mock data and look"
    echo "   like it was working."
    cleanup 1
  fi

  IFS='|' read -r api_version vtop_connected last_synced <<<"$health"
  echo "    ok — API version $api_version"
  if [[ "$vtop_connected" == "True" ]]; then
    echo "    VTOP: connected, last synced $last_synced"
  else
    echo "    VTOP: not connected — every academic field will be null until you"
    echo "          sign in. That is the intended behaviour now, not a bug."
  fi
fi

# ---------- Frontend (Vite + React) ----------
if [[ "$MODE" != "backend" ]]; then
  echo "==> Frontend -> http://localhost:5173"
  if [[ ! -d "$FRONTEND/node_modules" ]]; then
    echo "    Installing npm dependencies (first run only)..."
    ( cd "$FRONTEND" && npm install )
  fi
  ( cd "$FRONTEND" && exec npm run dev ) &
  pids+=($!)
  sleep 2
fi

echo
echo "============================================================"
echo "  CampusOS is running locally."
echo
if [[ "$MODE" != "backend" ]]; then
  echo "     UI:        http://localhost:5173"
fi
if [[ "$MODE" != "frontend" ]]; then
  echo "     API docs:  http://localhost:8000/docs"
  echo "     Truth:     http://localhost:8000/api/features"
  echo "                http://localhost:8000/api/vtop/sync-report"
fi
echo
if [[ "$MODE" != "backend" ]]; then
  echo "  Note: the React app still contains its own mock-data fallbacks"
  echo "  (frontend/src/services/mockData.ts). Until those are removed, the UI can"
  echo "  show invented values even when the API correctly returns null. Review the"
  echo "  backend endpoints above for what is actually true."
  echo
fi
echo "  Press Ctrl+C to stop."
echo "============================================================"
wait
