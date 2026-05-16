#!/usr/bin/env bash
set -euo pipefail
APP_PORT="${APP_PORT:-3000}"
OMNIVOICE_PORT="${OMNIVOICE_PORT:-7861}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

export OMNIVOICE_HOST="${OMNIVOICE_HOST:-127.0.0.1}"
export OMNIVOICE_PORT
export OMNIVOICE_DEVICE="${OMNIVOICE_DEVICE:-cuda}"
export HF_HOME="${HF_HOME:-/content/hf-cache}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HOME}/hub}"

mkdir -p "$HF_HOME" "$HUGGINGFACE_HUB_CACHE"

if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
fi

if [ "${START_OMNIVOICE:-0}" = "1" ]; then
  nohup python3 scripts/omnivoice-api-server.py > omnivoice.log 2>&1 &
  echo $! > omnivoice.pid
fi

nohup npm run dev -- --host 0.0.0.0 --port "$APP_PORT" > comicvideoai-dev.log 2>&1 &
echo $! > comicvideoai-dev.pid

echo "ComicVideoAI local URL: http://127.0.0.1:${APP_PORT}"
echo "Logs: $PROJECT_DIR/comicvideoai-dev.log"
