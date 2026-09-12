#!/usr/bin/env bash
# ==============================================================================
# CampusOS - Local Hosting Launcher
# Starts both the FastAPI Python backend and the Vite React frontend
# ==============================================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

BACKEND_PORT=8000
FRONTEND_PORT=5173

echo "======================================================="
echo "  🚀 Starting CampusOS Local Development Environment   "
echo "======================================================="

# Function to clean up child processes on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down CampusOS servers..."
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "$FRONTEND_PID" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo "✓ CampusOS local servers stopped cleanly."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Clean up any stale processes on the target ports
if ss -tulpn 2>/dev/null | grep -q ":$BACKEND_PORT "; then
  echo "⚠️  Port $BACKEND_PORT is already in use. Freeing port $BACKEND_PORT..."
  fuser -k -n tcp "$BACKEND_PORT" 2>/dev/null || true
  sleep 1
fi

if ss -tulpn 2>/dev/null | grep -q ":$FRONTEND_PORT "; then
  echo "⚠️  Port $FRONTEND_PORT is already in use. Freeing port $FRONTEND_PORT..."
  fuser -k -n tcp "$FRONTEND_PORT" 2>/dev/null || true
  sleep 1
fi

# 2. Start FastAPI Backend
echo "📦 Starting FastAPI backend on http://127.0.0.1:$BACKEND_PORT..."
python3 -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend health check..."
for i in {1..20}; do
  if curl -s "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    echo "✓ Backend is healthy at http://127.0.0.1:$BACKEND_PORT"
    break
  fi
  sleep 0.5
done

# 3. Start Vite Frontend
echo "🌐 Starting Vite frontend on http://localhost:$FRONTEND_PORT..."
npm --prefix frontend run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "⏳ Waiting for frontend to be ready..."
for i in {1..20}; do
  if curl -s -I "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1; then
    echo "✓ Frontend is ready at http://localhost:$FRONTEND_PORT"
    break
  fi
  sleep 0.5
done

echo ""
echo "======================================================="
echo "  🎉 CampusOS is now running locally!                  "
echo "                                                       "
echo "  • Frontend UI:    http://localhost:$FRONTEND_PORT         "
echo "  • Backend API:    http://127.0.0.1:$BACKEND_PORT         "
echo "  • API Docs:       http://127.0.0.1:$BACKEND_PORT/docs    "
echo "  • Health Check:   http://127.0.0.1:$BACKEND_PORT/health  "
echo "                                                       "
echo "  Press Ctrl+C to stop all servers.                    "
echo "======================================================="
echo ""

# Keep running and wait for signals
wait
