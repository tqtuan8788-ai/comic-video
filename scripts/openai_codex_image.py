#!/usr/bin/env python3
"""Generate one image through Codex OAuth using the optional codex-image-gen package.

The app invokes this script from the Vite dev middleware. OAuth is intentionally
not implemented here: `codex-image-gen` is expected to use the user's existing
`~/.codex/auth.json`. This script never reads, writes, or logs that file.

Input JSON on stdin:
  {"prompt": "...", "size": "1024x1792", "model": "gpt-5.5", "output_format": "png"}

Output JSON on stdout:
  {"ok": true, "base64": "...", "mimeType": "image/png"}
"""

from __future__ import annotations

import base64
import importlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def _json(data: dict[str, Any]) -> None:
    print(json.dumps(data, ensure_ascii=False), flush=True)


def _read_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    return json.loads(raw or "{}")


def _read_output(path: Path, output_format: str) -> dict[str, Any]:
    data = path.read_bytes()
    return {
        "ok": True,
        "base64": base64.b64encode(data).decode("ascii"),
        "mimeType": f"image/{'png' if output_format == 'png' else output_format}",
    }


def _try_python_api(prompt: str, size: str, model: str, output_format: str, out_path: Path) -> bool:
    """Best-effort adapter for codex-image-gen without depending on one exact API."""
    candidates = [
        ("codex_image_gen", "generate_image"),
        ("codex_image_gen", "generate"),
        ("codex_image_gen.client", "generate_image"),
        ("codex_image_gen.image_generation", "generate_image"),
    ]
    last_error: Exception | None = None

    for module_name, func_name in candidates:
        try:
            module = importlib.import_module(module_name)
            func = getattr(module, func_name)
            result = func(
                prompt=prompt,
                size=size,
                model=model,
                output_format=output_format,
                timeout=float(os.environ.get("CODEX_IMAGE_TIMEOUT", "300")),
            )

            if out_path.exists() and out_path.stat().st_size > 0:
                return True

            images = getattr(result, "images", None)
            if images:
                image = images[0]
                data = getattr(image, "data", None)
                if data:
                    out_path.write_bytes(data)
                    return True

            if isinstance(result, (bytes, bytearray)):
                out_path.write_bytes(bytes(result))
                return True
            if isinstance(result, str):
                if result.startswith("data:") and "," in result:
                    out_path.write_bytes(base64.b64decode(result.split(",", 1)[1]))
                    return True
                result_path = Path(result)
                if result_path.exists():
                    shutil.copyfile(result_path, out_path)
                    return True
                try:
                    out_path.write_bytes(base64.b64decode(result))
                    return True
                except Exception:
                    pass
            if isinstance(result, dict):
                encoded = result.get("base64") or result.get("image") or result.get("data") or result.get("b64_json")
                if encoded:
                    if str(encoded).startswith("data:") and "," in str(encoded):
                        encoded = str(encoded).split(",", 1)[1]
                    out_path.write_bytes(base64.b64decode(str(encoded)))
                    return True
                result_path = result.get("path") or result.get("output_path") or result.get("file")
                if result_path and Path(str(result_path)).exists():
                    shutil.copyfile(str(result_path), out_path)
                    return True
        except Exception as exc:  # try next API shape
            last_error = exc

    if last_error:
        raise last_error
    raise ModuleNotFoundError("codex-image-gen Python package not found")


def _try_cli(prompt: str, size: str, model: str, output_format: str, out_path: Path) -> bool:
    binary = shutil.which("codex-image-gen")
    if not binary:
        return False
    cmd = [
        binary,
        "--prompt",
        prompt,
        "--size",
        size,
        "--model",
        model,
        "--output-format",
        output_format,
        "--output",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
    return out_path.exists() and out_path.stat().st_size > 0


def generate_image_codex(prompt: str, size: str, out_path: str, model: str = "gpt-image-2", output_format: str = "png") -> str:
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if _try_python_api(prompt, size, model, output_format, path):
        return str(path)
    if _try_cli(prompt, size, model, output_format, path):
        return str(path)
    raise RuntimeError("codex-image-gen did not produce an image")


def main() -> int:
    try:
        payload = _read_input()
        prompt = str(payload.get("prompt") or "").strip()
        if not prompt:
            raise ValueError("Missing prompt")
        size = str(payload.get("size") or os.environ.get("CODEX_IMAGE_SIZE") or "1024x1792")
        # codex-image-gen's `model` is the main Responses model. The image
        # generation tool itself uses gpt-image-2 internally per the library.
        model = str(payload.get("model") or os.environ.get("CODEX_IMAGE_RESPONSES_MODEL") or "gpt-5.5")
        output_format = str(payload.get("output_format") or "png").lstrip(".").lower()

        with tempfile.TemporaryDirectory(prefix="comicvideoai-codex-image-") as tmp:
            out_path = Path(tmp) / f"image.{output_format}"
            generate_image_codex(prompt, size, str(out_path), model=model, output_format=output_format)
            _json(_read_output(out_path, output_format))
        return 0
    except Exception as exc:
        _json({"ok": False, "error": str(exc)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
