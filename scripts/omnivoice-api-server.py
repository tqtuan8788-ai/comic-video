#!/usr/bin/env python3
"""Tiny OmniVoice HTTP adapter for ComicVideoAI.

This intentionally wraps the real k2-fsa `omnivoice` package. It does not fall
back to Edge TTS or any unrelated voice provider: if OmniVoice is not installed,
/health and /tts report that clearly so the launcher/UI cannot silently produce
non-OmniVoice audio.
"""

from __future__ import annotations

import base64
import json
import os
import tempfile
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

HOST = os.environ.get("OMNIVOICE_HOST", "127.0.0.1")
PORT = int(os.environ.get("OMNIVOICE_PORT", "7861"))
MODEL_ID = os.environ.get("OMNIVOICE_MODEL", "k2-fsa/OmniVoice")
DEVICE = os.environ.get("OMNIVOICE_DEVICE", "cpu")
DTYPE = os.environ.get("OMNIVOICE_DTYPE", "float32")
MAX_BODY_BYTES = int(os.environ.get("OMNIVOICE_MAX_BODY_BYTES", str(32 * 1024 * 1024)))
REFERENCE_DIR = Path(os.environ.get("OMNIVOICE_REFERENCE_DIR", ".omx/runtime/omnivoice"))
REFERENCE_DIR.mkdir(parents=True, exist_ok=True)

_model = None
_import_error = None
_last_reference_audio: Path | None = None


def _json_bytes(data: dict[str, Any]) -> bytes:
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def _device_dtype():
    import torch

    dtype_map = {
        "float16": torch.float16,
        "bfloat16": torch.bfloat16,
        "float32": torch.float32,
    }
    return dtype_map.get(DTYPE.lower(), torch.float32)


def load_model():
    global _model, _import_error
    if _model is not None:
        return _model
    if _import_error is not None:
        raise _import_error
    try:
        from omnivoice import OmniVoice

        kwargs: dict[str, Any] = {"device_map": DEVICE}
        # CPU should stay float32 for compatibility; CUDA/MPS can opt into fp16.
        kwargs["dtype"] = _device_dtype()
        _model = OmniVoice.from_pretrained(MODEL_ID, **kwargs)
        return _model
    except Exception as exc:  # keep exact exception for health + tts response
        _import_error = exc
        raise


def is_ready() -> tuple[bool, str]:
    try:
        load_model()
        return True, "Real OmniVoice model loaded."
    except Exception as exc:
        return False, str(exc)


def write_ref_audio_from_payload(payload: dict[str, Any]) -> Path | None:
    raw = payload.get("referenceAudioBase64") or payload.get("reference_audio") or payload.get("ref_audio_base64")
    if not raw:
        return _last_reference_audio if _last_reference_audio and _last_reference_audio.exists() else None
    raw = str(raw)
    if raw.startswith("data:") and "," in raw:
        raw = raw.split(",", 1)[1]
    suffix = ".wav"
    mime = str(payload.get("referenceAudioMimeType") or "")
    if "mpeg" in mime or "mp3" in mime:
        suffix = ".mp3"
    elif "ogg" in mime:
        suffix = ".ogg"
    ref_path = REFERENCE_DIR / f"reference{suffix}"
    ref_path.write_bytes(base64.b64decode(raw))
    return ref_path


def write_wav_response(res: BaseHTTPRequestHandler, audio: Any) -> None:
    # OmniVoice docs: model.generate() returns list[np.ndarray], 24kHz.
    import soundfile as sf

    waveform = audio[0] if isinstance(audio, (list, tuple)) else audio
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        sf.write(str(tmp_path), waveform, 24000)
        data = tmp_path.read_bytes()
        res.send_response(200)
        res.send_header("Content-Type", "audio/wav")
        res.send_header("Access-Control-Allow-Origin", "*")
        res.send_header("Cache-Control", "no-store")
        res.send_header("Content-Length", str(len(data)))
        res.end_headers()
        res.wfile.write(data)
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    server_version = "ComicVideoAI-OmniVoice/1.0"

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

    def _read_body(self) -> bytes:
        length = int(self.headers.get("content-length", "0") or 0)
        if length > MAX_BODY_BYTES:
            raise ValueError(f"Request body too large: {length} bytes")
        return self.rfile.read(length) if length else b""

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type,authorization")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            ok, message = is_ready()
            self._send_json(200 if ok else 503, {
                "ok": ok,
                "backend": "k2-fsa/OmniVoice",
                "model": MODEL_ID,
                "device": DEVICE,
                "dtype": DTYPE,
                "message": message,
                "installHint": "pip install omnivoice soundfile" if not ok else None,
            })
            return
        if path == "/voices":
            self._send_json(200, {
                "ok": True,
                "voices": [
                    {"id": "auto", "name": "OmniVoice Auto Voice", "language": "auto", "cloned": False},
                    {"id": "reference_clone", "name": "Reference Audio Clone", "language": "auto", "cloned": True},
                ],
            })
            return
        self._send_json(404, {"ok": False, "error": f"Unknown endpoint GET {path}"})

    def do_POST(self) -> None:  # noqa: N802
        global _last_reference_audio
        path = urlparse(self.path).path
        try:
            body = self._read_body()
            if path == "/clone":
                # The browser uploads multipart/form-data here for UX/profile setup,
                # while real synthesis sends base64 reference audio inside /tts JSON.
                # Do not store the raw multipart envelope as an audio file; that can
                # corrupt later reference-clone requests and make TTS behave erratically.
                content_type = self.headers.get("content-type", "").lower()
                if body and "multipart/form-data" not in content_type:
                    ref_path = REFERENCE_DIR / "uploaded-reference.bin"
                    ref_path.write_bytes(body)
                    _last_reference_audio = ref_path
                self._send_json(200, {
                    "ok": True,
                    "id": "reference_clone",
                    "voiceProfileId": "reference_clone",
                    "message": "Đã nhận audio mẫu. OmniVoice sẽ dùng reference audio khi gọi /tts.",
                })
                return

            if path == "/tts":
                payload = json.loads(body.decode("utf-8") or "{}")
                text = str(payload.get("text") or "").strip()
                if not text:
                    self._send_json(400, {"ok": False, "error": "Missing text"})
                    return
                model = load_model()
                ref_audio = write_ref_audio_from_payload(payload)
                kwargs: dict[str, Any] = {"text": text}
                if ref_audio and ref_audio.exists():
                    kwargs["ref_audio"] = str(ref_audio)
                    ref_text = payload.get("ref_text") or payload.get("referenceText")
                    if ref_text:
                        kwargs["ref_text"] = str(ref_text)
                speed = payload.get("speed")
                if speed is not None:
                    try:
                        kwargs["speed"] = float(speed)
                    except Exception:
                        pass
                audio = model.generate(**kwargs)
                write_wav_response(self, audio)
                return

            self._send_json(404, {"ok": False, "error": f"Unknown endpoint POST {path}"})
        except Exception as exc:
            self._send_json(503, {
                "ok": False,
                "error": str(exc),
                "backend": "k2-fsa/OmniVoice",
                "installHint": "pip install omnivoice soundfile",
                "trace": traceback.format_exc(limit=6),
            })

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[omnivoice-api] {self.address_string()} - {fmt % args}", flush=True)


def main() -> None:
    print(f"[omnivoice-api] listening on http://{HOST}:{PORT}", flush=True)
    print(f"[omnivoice-api] model={MODEL_ID} device={DEVICE} dtype={DTYPE}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
