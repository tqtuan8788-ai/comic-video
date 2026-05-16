#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

APP_HOST="127.0.0.1"
APP_PORT="${APP_PORT:-3000}"
APP_URL="http://localhost:${APP_PORT}"
OMNIVOICE_HOST="127.0.0.1"
OMNIVOICE_PORT="${OMNIVOICE_PORT:-7861}"
OMNIVOICE_URL="http://localhost:${OMNIVOICE_PORT}"
PROJECT_CACHE_DIR="${PROJECT_CACHE_DIR:-$(pwd)/.cache}"
mkdir -p "${PROJECT_CACHE_DIR}/huggingface" "${PROJECT_CACHE_DIR}/npm"
export HF_HOME="${HF_HOME:-${PROJECT_CACHE_DIR}/huggingface}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HOME}/hub}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-${PROJECT_CACHE_DIR}/npm}"
OMNIVOICE_PYTHON="${OMNIVOICE_PYTHON:-$(pwd)/.venv-omnivoice/bin/python}"
[ -x "${OMNIVOICE_PYTHON}" ] || OMNIVOICE_PYTHON="python3"
KILL_STALE_PORTS="${KILL_STALE_PORTS:-1}"

APP_PID_FILE="comicvideoai-dev.pid"
OMNI_PID_FILE="omnivoice.pid"
APP_LOG="comicvideoai-dev.log"
OMNI_LOG="omnivoice.log"

print_header() {
  echo "========================================"
  echo " ComicVideoAI - Linux one click launcher"
  echo "========================================"
  echo "App:       ${APP_URL}"
  echo "OmniVoice: ${OMNIVOICE_URL}"
  echo
}

pids_on_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true
  elif command -v fuser >/dev/null 2>&1; then
    fuser "${port}/tcp" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+$' || true
  fi
}

stop_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [ -f "${pid_file}" ]; then
    local pid
    pid="$(cat "${pid_file}" 2>/dev/null || true)"
    if [ -n "${pid}" ] && kill -0 "${pid}" 2>/dev/null; then
      echo "Stopping stale ${label} pid ${pid}..."
      kill "${pid}" 2>/dev/null || true
      sleep 1
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${pid_file}"
  fi
}

stop_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(pids_on_port "${port}" | tr '\n' ' ' | xargs || true)"
  if [ -n "${pids}" ]; then
    echo "Stopping process(es) on ${label} port ${port}: ${pids}"
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempts="${3:-20}"
  local i
  for i in $(seq 1 "${attempts}"); do
    if command -v curl >/dev/null 2>&1 && curl -fsS "${url}" >/dev/null 2>&1; then
      echo "${label} is ready: ${url}"
      return 0
    fi
    sleep 0.5
  done
  echo "[WARN] ${label} did not become ready in time: ${url}"
  return 1
}

open_browser() {
  echo "Opening browser..."
  if command -v google-chrome >/dev/null 2>&1; then
    google-chrome "${APP_URL}" >/dev/null 2>&1 &
  elif command -v google-chrome-stable >/dev/null 2>&1; then
    google-chrome-stable "${APP_URL}" >/dev/null 2>&1 &
  elif command -v chromium >/dev/null 2>&1; then
    chromium "${APP_URL}" >/dev/null 2>&1 &
  elif command -v chromium-browser >/dev/null 2>&1; then
    chromium-browser "${APP_URL}" >/dev/null 2>&1 &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "${APP_URL}" >/dev/null 2>&1 &
  else
    echo "No browser opener found. Open manually: ${APP_URL}"
  fi
}

print_header

if [ "${KILL_STALE_PORTS}" = "1" ]; then
  echo "[1/5] Cleaning stale background services..."
  stop_pid_file "${APP_PID_FILE}" "Vite"
  stop_pid_file "${OMNI_PID_FILE}" "OmniVoice"
  stop_port "${APP_PORT}" "app"
  stop_port "${OMNIVOICE_PORT}" "OmniVoice"
else
  echo "[1/5] Skipping port cleanup because KILL_STALE_PORTS=${KILL_STALE_PORTS}."
fi

if [ ! -d node_modules ]; then
  echo "[2/5] node_modules not found. Installing dependencies..."
  npm install
else
  echo "[2/5] Dependencies already installed."
fi

echo "[3/5] Starting real OmniVoice backend..."
if command -v setsid >/dev/null 2>&1; then
  setsid env \
    OMNIVOICE_HOST="${OMNIVOICE_HOST}" \
    OMNIVOICE_PORT="${OMNIVOICE_PORT}" \
    OMNIVOICE_DEVICE="${OMNIVOICE_DEVICE:-cpu}" \
    HF_HOME="${HF_HOME}" \
    HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE}" \
    "${OMNIVOICE_PYTHON}" scripts/omnivoice-api-server.py > "${OMNI_LOG}" 2>&1 < /dev/null &
else
  nohup env \
    OMNIVOICE_HOST="${OMNIVOICE_HOST}" \
    OMNIVOICE_PORT="${OMNIVOICE_PORT}" \
    OMNIVOICE_DEVICE="${OMNIVOICE_DEVICE:-cpu}" \
    HF_HOME="${HF_HOME}" \
    HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE}" \
    "${OMNIVOICE_PYTHON}" scripts/omnivoice-api-server.py > "${OMNI_LOG}" 2>&1 < /dev/null &
fi
OMNI_PID=$!
echo "${OMNI_PID}" > "${OMNI_PID_FILE}"
disown "${OMNI_PID}" 2>/dev/null || true
wait_for_url "${OMNIVOICE_URL}/health" "OmniVoice" 20 || {
  echo "--- ${OMNI_LOG} ---"
  tail -80 "${OMNI_LOG}" 2>/dev/null || true
}

echo "[4/5] Starting Vite dev server..."
if command -v setsid >/dev/null 2>&1; then
  setsid npm run dev -- --host "${APP_HOST}" --port "${APP_PORT}" > "${APP_LOG}" 2>&1 < /dev/null &
else
  nohup npm run dev -- --host "${APP_HOST}" --port "${APP_PORT}" > "${APP_LOG}" 2>&1 < /dev/null &
fi
APP_PID=$!
echo "${APP_PID}" > "${APP_PID_FILE}"
disown "${APP_PID}" 2>/dev/null || true
wait_for_url "${APP_URL}" "ComicVideoAI" 30 || {
  echo "--- ${APP_LOG} ---"
  tail -80 "${APP_LOG}" 2>/dev/null || true
}

echo "[5/5] Opening Chrome/UI..."
open_browser

echo
echo "Done. URL: ${APP_URL}"
echo "Logs:"
echo "  App:       $(pwd)/${APP_LOG}"
echo "  OmniVoice: $(pwd)/${OMNI_LOG}"
echo "Stop:"
echo "  kill \$(cat ${APP_PID_FILE}) \$(cat ${OMNI_PID_FILE})"
