#!/usr/bin/env bash
set -euo pipefail

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "${BACKEND_PID}" 2>/dev/null || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
}

trap cleanup SIGINT SIGTERM

cd /app/backend
python manage.py migrate --noinput
python manage.py runserver "0.0.0.0:${BACKEND_PORT}" &
BACKEND_PID=$!

cd /app/frontend
npm run preview -- --host 0.0.0.0 --port "${FRONTEND_PORT}" &
FRONTEND_PID=$!

wait -n "${BACKEND_PID}" "${FRONTEND_PID}"
EXIT_CODE=$?
cleanup
wait "${BACKEND_PID}" "${FRONTEND_PID}" 2>/dev/null || true
exit "${EXIT_CODE}"
