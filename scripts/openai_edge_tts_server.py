#!/usr/bin/env python3
"""Lightweight OpenAI-compatible Edge TTS server for ComicVideoAI.

Endpoints:
- GET  /health
- GET  /voices
- POST /tts
- POST /v1/audio/speech

This follows the shape of travisvn/openai-edge-tts for core TTS requests while
remaining lightweight enough for low-RAM machines and VPS deployments.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import urlparse

HOST = os.environ.get("EDGE_TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("EDGE_TTS_PORT", "5050"))
API_KEY = os.environ.get("EDGE_TTS_API_KEY", "")
REQUIRE_API_KEY = os.environ.get("EDGE_TTS_REQUIRE_API_KEY", "false").lower() in {"1", "true", "yes", "on"}
DEFAULT_VOICE = os.environ.get("EDGE_TTS_DEFAULT_VOICE", "vi-VN-HoaiMyNeural")
DEFAULT_SPEED = float(os.environ.get("EDGE_TTS_DEFAULT_SPEED", "1.0"))
DEFAULT_FORMAT = os.environ.get("EDGE_TTS_DEFAULT_FORMAT", "mp3").lower()
MAX_RETRIES = int(os.environ.get("EDGE_TTS_MAX_RETRIES", "5"))
SERIALIZE_REQUESTS = os.environ.get("EDGE_TTS_SERIALIZE_REQUESTS", "true").lower() in {"1", "true", "yes", "on"}
REQUEST_LOCK = threading.Lock()

VOICE_MAP = {
    "alloy": os.environ.get("EDGE_TTS_VOICE_ALLOY", DEFAULT_VOICE),
    "echo": os.environ.get("EDGE_TTS_VOICE_ECHO", "vi-VN-NamMinhNeural"),
    "fable": os.environ.get("EDGE_TTS_VOICE_FABLE", "en-US-EmmaNeural"),
    "onyx": os.environ.get("EDGE_TTS_VOICE_ONYX", "en-US-AndrewNeural"),
    "nova": os.environ.get("EDGE_TTS_VOICE_NOVA", DEFAULT_VOICE),
    "shimmer": os.environ.get("EDGE_TTS_VOICE_SHIMMER", "en-US-AvaNeural"),
    "default": DEFAULT_VOICE,
}


def _json_bytes(data: dict[str, Any]) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def _content_type(fmt: str) -> str:
    return {
        "mp3": "audio/mpeg",
        "mpeg": "audio/mpeg",
    }.get(fmt.lower(), "audio/mpeg")


def _edge_rate(speed: float) -> str:
    speed = max(0.25, min(4.0, speed))
    pct = round((speed - 1.0) * 100)
    return f"{pct:+d}%"


def _resolve_voice(raw_voice: str) -> str:
    voice = (raw_voice or "").strip()
    if not voice:
        return DEFAULT_VOICE
    return VOICE_MAP.get(voice.lower(), voice)


async def _list_voices() -> list[dict[str, Any]]:
    import edge_tts

    voices = await edge_tts.list_voices()
    results: list[dict[str, Any]] = []
    for voice in voices:
        results.append({
            "id": voice.get("ShortName") or voice.get("Name"),
            "name": voice.get("FriendlyName") or voice.get("ShortName") or voice.get("Name"),
            "locale": voice.get("Locale"),
            "gender": voice.get("Gender"),
        })
    return results


async def _synthesize(text: str, voice: str, speed: float) -> bytes:
    import edge_tts

    last_error: Exception | None = None
    resolved_voice = _resolve_voice(voice)
    voice_candidates = [resolved_voice]
    if resolved_voice != DEFAULT_VOICE:
        voice_candidates.append(DEFAULT_VOICE)

    for voice_index, voice_name in enumerate(voice_candidates):
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                communicate = edge_tts.Communicate(
                    text=text,
                    voice=voice_name,
                    rate=_edge_rate(speed),
                    connect_timeout=15,
                    receive_timeout=120,
                )
                chunks: list[bytes] = []
                async for item in communicate.stream():
                    if item.get("type") == "audio":
                        chunks.append(item["data"])
                if chunks:
                    return b"".join(chunks)
                raise RuntimeError("No audio was received. Please verify that your parameters are correct.")
            except Exception as exc:
                last_error = exc
                if attempt < MAX_RETRIES:
                    time.sleep(min(1.5 * attempt, 3.0))
                    continue
                if voice_index + 1 < len(voice_candidates):
                    break

    raise RuntimeError(str(last_error) if last_error else "edge-tts returned no audio")


class Handler(BaseHTTPRequestHandler):
    server_version = "ComicVideoAI-EdgeTTS/1.0"

    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = _json_bytes(data)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("content-length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def _require_api_key(self) -> bool:
        if not REQUIRE_API_KEY:
            return True
        auth = self.headers.get("authorization", "")
        token = auth.replace("Bearer", "").strip()
        return token == API_KEY

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            try:
                import edge_tts  # noqa: F401
                self._send_json(200, {"ok": True, "message": "Edge TTS backend ready.", "voice": DEFAULT_VOICE})
            except Exception as exc:
                self._send_json(503, {"ok": False, "message": str(exc)})
            return
        if path == "/voices":
            try:
                voices = asyncio.run(_list_voices())
                self._send_json(200, {"ok": True, "voices": voices})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        self._send_json(404, {"ok": False, "error": f"Unknown endpoint GET {path}"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._require_api_key():
            self._send_json(401, {"ok": False, "error": "Unauthorized"})
            return

        path = urlparse(self.path).path
        try:
            payload = self._read_json()
            if path not in {"/tts", "/v1/audio/speech"}:
                self._send_json(404, {"ok": False, "error": f"Unknown endpoint POST {path}"})
                return

            text = str(payload.get("input") or payload.get("text") or "").strip()
            if not text:
                self._send_json(400, {"ok": False, "error": "Missing input text"})
                return

            voice = str(payload.get("voice") or DEFAULT_VOICE)
            speed = float(payload.get("speed") or DEFAULT_SPEED)
            response_format = str(payload.get("response_format") or payload.get("format") or DEFAULT_FORMAT).lower()
            if response_format not in {"mp3", "mpeg"}:
                self._send_json(400, {"ok": False, "error": f"Unsupported response_format '{response_format}'. Use mp3."})
                return

            if SERIALIZE_REQUESTS:
                with REQUEST_LOCK:
                    audio = asyncio.run(_synthesize(text, voice, speed))
            else:
                audio = asyncio.run(_synthesize(text, voice, speed))
            self.send_response(200)
            self.send_header("Content-Type", _content_type(response_format))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as exc:
            self._send_json(503, {"ok": False, "error": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[edge-tts-api] {self.address_string()} - {fmt % args}", flush=True)


def main() -> None:
    print(f"[edge-tts-api] listening on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
