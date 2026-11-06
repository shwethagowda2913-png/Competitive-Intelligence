#!/usr/bin/env bash
# Starts backend (8000) and frontend (5173). Requires: python3.11+, node 18+.
set -e
cd "$(dirname "$0")"
[ -f backend/.env ] || cp .env.example backend/.env
(cd backend && pip install -r requirements.txt && python -m alembic upgrade head && python -m uvicorn app.main:app --port 8000) &
(cd frontend && npm install && npm run dev) &
wait
