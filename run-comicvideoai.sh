#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

APP_HOST="127.0.0.1"
APP_PORT="${APP_PORT:-3000}"
APP_URL="http://localhost:${APP_PORT}"
OMNIVOICE_HOST="127.0.0.1"
OMNIVOICE_PORT="${OMNIVOICE_PORT:-7861}"
OMNIVOICE_URL="http://localhost:${OMNIVOICE_PORT}"
EDGE_TTS_HOST="127.0.0.1"
EDGE_TTS_PORT="${EDGE_TTS_PORT:-5050}"
EDGE_TTS_URL="http://localhost:${EDGE_TTS_PORT}"
CODEX_OAUTH_HOST="127.0.0.1"
CODEX_OAUTH_PORT="${CODEX_OAUTH_PORT:-10531}"
CODEX_OAUTH_URL="http://${CODEX_OAUTH_HOST}:${CODEX_OAUTH_PORT}"
PROJECT_CACHE_DIR="${PROJECT_CACHE_DIR:-$(pwd)/.cache}"
mkdir -p "${PROJECT_CACHE_DIR}/huggingface" "${PROJECT_CACHE_DIR}/npm" "${PROJECT_CACHE_DIR}/pip"
export HF_HOME="${HF_HOME:-${PROJECT_CACHE_DIR}/huggingface}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HOME}/hub}"
export NPM_CONFIG_CACHE="${NPM_CONFIG_CACHE:-${PROJECT_CACHE_DIR}/npm}"
export PIP_CACHE_DIR="${PIP_CACHE_DIR:-${PROJECT_CACHE_DIR}/pip}"
OMNIVOICE_PYTHON="${OMNIVOICE_PYTHON:-$(pwd)/.venv-omnivoice/bin/python}"
[ -x "${OMNIVOICE_PYTHON}" ] || OMNIVOICE_PYTHON="python3"
EDGE_TTS_VENV="${EDGE_TTS_VENV:-$(pwd)/.venv-edge-tts}"
EDGE_TTS_PYTHON="${EDGE_TTS_PYTHON:-${EDGE_TTS_VENV}/bin/python}"
EDGE_TTS_DEFAULT_VOICE="${EDGE_TTS_DEFAULT_VOICE:-vi-VN-HoaiMyNeural}"
EDGE_TTS_DEFAULT_SPEED="${EDGE_TTS_DEFAULT_SPEED:-1.0}"
CODEX_IMAGE_VENV="${CODEX_IMAGE_VENV:-$(pwd)/.venv-codex-image}"
CODEX_IMAGE_PYTHON="${CODEX_IMAGE_PYTHON:-${CODEX_IMAGE_VENV}/bin/python}"
CODEX_IMAGE_RESPONSES_MODEL="${CODEX_IMAGE_RESPONSES_MODEL:-gpt-5.5}"
CODEX_IMAGE_MODEL="${CODEX_IMAGE_MODEL:-gpt-image-2}"
CODEX_OPENAI_BASE_URL="${CODEX_OPENAI_BASE_URL:-${CODEX_OAUTH_URL}/v1}"
START_CODEX_OAUTH_PROXY="${START_CODEX_OAUTH_PROXY:-1}"
START_OMNIVOICE="${START_OMNIVOICE:-0}"
KILL_STALE_PORTS="${KILL_STALE_PORTS:-1}"

APP_PID_FILE="comicvideoai-dev.pid"
OMNI_PID_FILE="omnivoice.pid"
EDGE_TTS_PID_FILE="edge-tts.pid"
CODEX_OAUTH_PID_FILE="openai-oauth.pid"
APP_LOG="comicvideoai-dev.log"
OMNI_LOG="omnivoice.log"
EDGE_TTS_LOG="edge-tts.log"
CODEX_OAUTH_LOG="openai-oauth.log"

print_header() {
  echo "========================================"
  echo " ComicVideoAI - Linux one click launcher"
  echo "========================================"
  echo "App:       ${APP_URL}"
  echo "Edge TTS:  ${EDGE_TTS_URL}"
  echo "OmniVoice: ${OMNIVOICE_URL}"
  echo "Codex OAuth proxy: ${CODEX_OAUTH_URL}"
  echo "Codex image Python: ${CODEX_IMAGE_PYTHON}"
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

ensure_codex_image_env() {
  if [ -x "${CODEX_IMAGE_PYTHON}" ]; then
    if "${CODEX_IMAGE_PYTHON}" - <<'PY' >/dev/null 2>&1
import codex_image_gen
PY
    then
      echo "codex-image-gen is ready in ${CODEX_IMAGE_VENV}."
      return 0
    fi
  fi

  local py311
  py311="$(command -v python3.11 || true)"
  if [ -z "${py311}" ]; then
    echo "[WARN] python3.11 not found. codex-image-gen requires Python >=3.11; image generation will fallback to Pollinations."
    return 1
  fi

  echo "Preparing codex-image-gen venv..."
  "${py311}" -m venv "${CODEX_IMAGE_VENV}"
  "${CODEX_IMAGE_PYTHON}" -m pip install --upgrade pip
  "${CODEX_IMAGE_PYTHON}" -m pip install "codex-image-gen==0.2.1"
  "${CODEX_IMAGE_PYTHON}" - <<'PY'
from codex_image_gen import generate_image
print("codex-image-gen import OK")
PY
}

ensure_edge_tts_env() {
  if [ -x "${EDGE_TTS_PYTHON}" ]; then
    if "${EDGE_TTS_PYTHON}" - <<'PY' >/dev/null 2>&1
import edge_tts
PY
    then
      echo "edge-tts is ready in ${EDGE_TTS_VENV}."
      return 0
    fi
  fi

  echo "Preparing edge-tts venv..."
  python3 -m venv "${EDGE_TTS_VENV}"
  "${EDGE_TTS_PYTHON}" -m pip install --upgrade pip
  "${EDGE_TTS_PYTHON}" -m pip install "edge-tts>=6,<8"
  "${EDGE_TTS_PYTHON}" - <<'PY'
import edge_tts
print("edge-tts import OK")
PY
}

print_header

if [ "${KILL_STALE_PORTS}" = "1" ]; then
  echo "[1/6] Cleaning stale background services..."
  stop_pid_file "${APP_PID_FILE}" "Vite"
  stop_pid_file "${EDGE_TTS_PID_FILE}" "Edge TTS"
  stop_pid_file "${OMNI_PID_FILE}" "OmniVoice"
  stop_pid_file "${CODEX_OAUTH_PID_FILE}" "openai-oauth"
  stop_port "${APP_PORT}" "app"
  stop_port "${EDGE_TTS_PORT}" "Edge TTS"
  stop_port "${OMNIVOICE_PORT}" "OmniVoice"
  stop_port "${CODEX_OAUTH_PORT}" "Codex OAuth"
else
  echo "[1/6] Skipping port cleanup because KILL_STALE_PORTS=${KILL_STALE_PORTS}."
fi

if [ ! -d node_modules ]; then
  echo "[2/6] node_modules not found. Installing dependencies..."
  npm install
else
  echo "[2/6] Dependencies already installed."
fi

echo "[3/7] Checking Edge TTS backend..."
ensure_edge_tts_env

echo "[4/7] Checking Codex image generator..."
ensure_codex_image_env || true

echo "[5/7] Starting Codex OAuth proxy if available..."
if [ "${START_CODEX_OAUTH_PROXY}" = "1" ]; then
  if command -v curl >/dev/null 2>&1 && curl -fsS "${CODEX_OPENAI_BASE_URL}/models" >/dev/null 2>&1; then
    echo "Codex OAuth proxy already ready: ${CODEX_OPENAI_BASE_URL}"
  elif command -v npx >/dev/null 2>&1; then
    if command -v setsid >/dev/null 2>&1; then
      setsid npx --yes openai-oauth > "${CODEX_OAUTH_LOG}" 2>&1 < /dev/null &
    else
      nohup npx --yes openai-oauth > "${CODEX_OAUTH_LOG}" 2>&1 < /dev/null &
    fi
    CODEX_OAUTH_PID=$!
    echo "${CODEX_OAUTH_PID}" > "${CODEX_OAUTH_PID_FILE}"
    disown "${CODEX_OAUTH_PID}" 2>/dev/null || true
    wait_for_url "${CODEX_OPENAI_BASE_URL}/models" "Codex OAuth proxy" 20 || {
      echo "[WARN] Codex OAuth proxy not ready. Text generation will fallback to DeepSeek unless you start: npx openai-oauth"
      echo "--- ${CODEX_OAUTH_LOG} ---"
      tail -80 "${CODEX_OAUTH_LOG}" 2>/dev/null || true
    }
  else
    echo "[WARN] npx not found. Start Codex OAuth manually if you want OpenAI text: npx openai-oauth"
  fi
else
  echo "Skipping openai-oauth because START_CODEX_OAUTH_PROXY=${START_CODEX_OAUTH_PROXY}."
fi

echo "[6/7] Starting Edge TTS backend..."
if command -v setsid >/dev/null 2>&1; then
  setsid env \
    EDGE_TTS_HOST="${EDGE_TTS_HOST}" \
    EDGE_TTS_PORT="${EDGE_TTS_PORT}" \
    EDGE_TTS_DEFAULT_VOICE="${EDGE_TTS_DEFAULT_VOICE}" \
    EDGE_TTS_DEFAULT_SPEED="${EDGE_TTS_DEFAULT_SPEED}" \
    "${EDGE_TTS_PYTHON}" scripts/openai_edge_tts_server.py > "${EDGE_TTS_LOG}" 2>&1 < /dev/null &
else
  nohup env \
    EDGE_TTS_HOST="${EDGE_TTS_HOST}" \
    EDGE_TTS_PORT="${EDGE_TTS_PORT}" \
    EDGE_TTS_DEFAULT_VOICE="${EDGE_TTS_DEFAULT_VOICE}" \
    EDGE_TTS_DEFAULT_SPEED="${EDGE_TTS_DEFAULT_SPEED}" \
    "${EDGE_TTS_PYTHON}" scripts/openai_edge_tts_server.py > "${EDGE_TTS_LOG}" 2>&1 < /dev/null &
fi
EDGE_TTS_PID=$!
echo "${EDGE_TTS_PID}" > "${EDGE_TTS_PID_FILE}"
disown "${EDGE_TTS_PID}" 2>/dev/null || true
wait_for_url "${EDGE_TTS_URL}/health" "Edge TTS" 20 || {
  echo "--- ${EDGE_TTS_LOG} ---"
  tail -80 "${EDGE_TTS_LOG}" 2>/dev/null || true
}

if [ "${START_OMNIVOICE}" = "1" ]; then
  echo "[6b/7] Starting optional OmniVoice backend..."
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
else
  echo "Skipping OmniVoice by default. Set START_OMNIVOICE=1 to enable it."
fi

echo "[7/7] Starting Vite dev server..."
export CODEX_IMAGE_PYTHON
export CODEX_IMAGE_RESPONSES_MODEL
export CODEX_IMAGE_MODEL
export CODEX_OPENAI_BASE_URL
export EDGE_TTS_PROXY_TARGET="${EDGE_TTS_URL}"
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

echo "Opening Chrome/UI..."
open_browser

echo
echo "Done. URL: ${APP_URL}"
echo "Logs:"
echo "  App:       $(pwd)/${APP_LOG}"
echo "  Edge TTS:  $(pwd)/${EDGE_TTS_LOG}"
echo "  OmniVoice: $(pwd)/${OMNI_LOG}"
echo "  Codex OAuth: $(pwd)/${CODEX_OAUTH_LOG}"
echo "Stop:"
echo "  kill \$(cat ${APP_PID_FILE}) \$(cat ${EDGE_TTS_PID_FILE} 2>/dev/null || true) \$(cat ${OMNI_PID_FILE} 2>/dev/null || true) \$(cat ${CODEX_OAUTH_PID_FILE} 2>/dev/null || true)"
