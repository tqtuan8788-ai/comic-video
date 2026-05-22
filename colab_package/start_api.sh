#!/bin/bash
# ─────────────────────────────────────────────────────────
# ComicVideoAI — API Mode Launcher for Colab / VPS
# ─────────────────────────────────────────────────────────
# Starts all services in background and exposes the API
# server via tunnel. For headless/bot-driven operation.
#
# Usage:
#   source colab_package/start_api.sh
#   curl http://127.0.0.1:8000/health
# ─────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Config ────────────────────────────────────────────
export APP_PORT="${APP_PORT:-3000}"
export EDGE_TTS_PORT="${EDGE_TTS_PORT:-5050}"
export OMNIVOICE_PORT="${OMNIVOICE_PORT:-7861}"
export API_PORT="${API_PORT:-8000}"

# HuggingFace cache (survives Colab runtime restarts if on Drive)
export HF_HOME="${HF_HOME:-/content/hf-cache}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-$HF_HOME}"
mkdir -p "$HF_HOME"

# ── Install dependencies ───────────────────────────────
echo "[api-launcher] Installing Node.js dependencies..."
npm ci --no-audit --no-fund 2>&1 | tail -1

# ── Start Edge TTS server (always needed) ──────────────
echo "[api-launcher] Starting Edge TTS server on port $EDGE_TTS_PORT..."
if [ -f edge-tts.pid ]; then
    kill "$(cat edge-tts.pid)" 2>/dev/null || true
fi
python3 scripts/openai_edge_tts_server.py &
EDGE_PID=$!
echo $EDGE_PID > edge-tts.pid
sleep 2

if curl -sS "http://127.0.0.1:${EDGE_TTS_PORT}/health" > /dev/null 2>&1; then
    echo "[api-launcher] Edge TTS: OK (PID $EDGE_PID)"
else
    echo "[api-launcher] WARNING: Edge TTS may not be ready yet"
fi

# ── Start OmniVoice server (optional, for voice cloning) ──
if [ "${START_OMNIVOICE:-0}" = "1" ]; then
    echo "[api-launcher] Starting OmniVoice on port $OMNIVOICE_PORT..."
    if [ -f omnivoice.pid ]; then
        kill "$(cat omnivoice.pid)" 2>/dev/null || true
    fi
    python3 scripts/omnivoice-api-server.py &
    OMNIVOICE_PID=$!
    echo $OMNIVOICE_PID > omnivoice.pid
    echo "[api-launcher] OmniVoice: PID $OMNIVOICE_PID (model loading in background...)"
else
    echo "[api-launcher] OmniVoice: SKIPPED (set START_OMNIVOICE=1 to enable)"
fi

# ── Start API server ────────────────────────────────────
echo "[api-launcher] Starting API server on port $API_PORT..."
export EDGE_TTS_PROXY_TARGET="http://127.0.0.1:${EDGE_TTS_PORT}"
export OMNIVOICE_PROXY_TARGET="http://127.0.0.1:${OMNIVOICE_PORT}"

npx tsx scripts/api-server.ts &
API_PID=$!
echo $API_PID > api-server.pid
sleep 3

if curl -sS "http://127.0.0.1:${API_PORT}/health" > /dev/null 2>&1; then
    echo "[api-launcher] API server: OK (PID $API_PID)"
else
    echo "[api-launcher] WARNING: API server may not be ready yet"
fi

echo ""
echo "  Services running:"
echo "  ─────────────────"
echo "  Edge TTS:    http://127.0.0.1:${EDGE_TTS_PORT}"
echo "  OmniVoice:   http://127.0.0.1:${OMNIVOICE_PORT}"
echo "  API Server:  http://127.0.0.1:${API_PORT}"
echo ""
echo "  Test: curl http://127.0.0.1:${API_PORT}/health"
echo ""
