#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================="
echo "🚀 Starting CampusOS Backend API (FastAPI)"
echo "========================================="
cd backend
# Loopback only. This process holds live VTOP session cookies and has no
# authentication of its own, so binding 0.0.0.0 would expose your portal session
# to anyone on the same network (campus wifi included).
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
