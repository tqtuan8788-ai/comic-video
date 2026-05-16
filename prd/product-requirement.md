# PRD — TikTok Mode & Viral Upgrade (ComicVideoAI)

## 1. Goals & KPIs
- Viral Score TikTok: ~3.8 → ≥7.0.
- Retention: 0–3s +20%, 0–10s +15% vs baseline; completion for 30/60s +10%.
- Shares + Saves: +15%.
- Quality: image/audio ≥8/10 (human eval); hook relevance ≥95%; payoff delivered ≥90%.
- SLO: preview <4s p95; scoring/heatmap <2s p95; fallback auto on timeout/5xx.

## 2. Users & Use Cases
- TikTok/shorts creators, agency editors: nhập prompt/ảnh/script → nhận video 15/20/30/60s 9:16 có hook mạnh bám nội dung, payoff rõ.
- Secondary: YouTube/poetic giữ nguyên preset cũ.

## 3. Scope
- In: TikTok Mode (analyzer + hook/pacing/payoff), presets TikTok, viral scoring + heatmap, variations, storyboard preview nhẹ, UI responsive, multi-provider config (LLM/img/TTS), agent fallback, guardrails.
- Out: billing, render pipeline/encoder changes.

## 4. Functional Requirements
- TikTok Mode:
  - Analyzer trích entity/chủ đề/tone/xung đột/sentiment từ text/ảnh/script.
  - Hook generator bám nội dung (không template cứng), chèn entity/action verb sớm, 0–12 từ; tones: action/shock/horror/comedy.
  - Pacing: hook 0–3s; reveal windows: 15s→6–9s, 20s→8–12s, 30s→12–18s, 60s→20–25s; override allowed.
  - Payoff suggester: 2–3 payoff liên quan (kho báu, cánh cửa, jumpscare, object reveal).
- Presets:
  - TikTok: explorer/urban/horror/comedy; auto set pacing/hook tone nhưng vẫn bám nội dung user.
  - Style presets: Action trailer, Horror glitch, Comedy meme, Anime/Manhua, Found footage, Vlog IRL, Dreamy/Poetic.
- Variations:
  - 3 phiên bản (action/horror/literary hoặc mainstream/edgy/meme) đều dựa prompt user; hiển thị ước lượng Viral Score + lý do.
- Scoring & Heatmap:
  - Score Hook/Pacing/Emotional/Relatability/Meme/Shareability/Audio + Trend Fit + Loopability; cảnh báo nếu <5/10 hoặc thiếu payoff.
  - Heatmap 0–10/10–30/30–50/50–60 (hoặc scale theo 15/20/30); nhãn “chậm/ổn”.
- Storyboard Preview:
  - Scene cards (thumb+caption+beat time), swap/delete/regen scene đơn lẻ; thao tác <300ms.
- UI/UX:
  - Menu: Home, TikTok Mode, Presets, Score/Heatmap, Storyboard, Settings/API.
  - Grid art style auto-fit, không scroll ngang; sidebar collapsible mobile; font rem; badges rõ; title ellipsis + tooltip; Producer Review -> accordion.
- Agent behavior:
  - Chọn provider theo policy (quality/cost/speed); auto-fallback; auto-regen hook nếu Hook Score <6 hoặc hook relevance thấp; log quyết định.
- Trend assist:
  - Gợi ý sound/hashtag/caption format nếu data có; optional toggle.

## 5. Non-Functional
- Mobile-first 9:16; TTFB UI <1s; preview <4s p95; scoring/heatmap <2s p95.
- Safety: guardrails NSFW/gore/shock quá mức; provider whitelist; audit log agent actions.
- Reliability: per-provider health check; graceful degradation (disable image/TTS but vẫn sinh script).

## 6. API & Model Config (.env.local schema)
- PROVIDER_PRIORITY="openai,groq,openrouter,sdxl_local,tts_elevenlabs,tts_free"  # fallback order
- USE_FREE_ONLY=false                         # true => bỏ provider tính phí
- COST_POLICY="quality_first"                 # quality_first | cost_saver | speed_first
- OPENAI_API_KEY=...
- OPENAI_BASE_URL=https://api.openai.com/v1
- OPENAI_MODEL_TEXT=gpt-4o
- OPENAI_MODEL_IMAGE=dall-e-3
- GROQ_API_KEY=...
- GROQ_MODEL_TEXT=llama3-70b-8192
- OPENROUTER_API_KEY=...
- OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
- OPENROUTER_MODEL_TEXT=meta-llama/llama-3-70b-instruct
- OPENROUTER_MODEL_IMAGE=stability-ai/sdxl
- ANTHROPIC_API_KEY=...                       # optional
- SDXL_LOCAL_URL=http://localhost:5000/generate
- TTS_ELEVENLABS_KEY=...
- TTS_ELEVENLABS_VOICE=default_voice_id
- TTS_FREE_PROVIDER=gptspeech                  # hoặc fakeyou/khác
- TTS_FREE_URL=https://api.free-tts.example.com
- TIMEOUT_MS=120000
- HOOK_RELEVANCE_MIN=0.95
- PAYOFF_REQUIRED=true
- LENGTH_DEFAULT=60
- LENGTH_ALLOWED="15,20,30,60"
- REVEAL_WINDOWS="15:6-9,20:8-12,30:12-18,60:20-25"
- TELEMETRY_ENDPOINT=https://telemetry.example.com/ingest

## 7. Data Contracts (gợi ý)
- /generate/story: input {prompt, assets?, length, preset, policy}; output {script, scenes[], hook, payoff, score, heatmap}.
- /generate/image: input {scene, style preset, model_hint}; output {url, provider, latency}.
- /generate/tts: input {text, voice, provider_hint}; output {url, provider, latency}.
- Scoring response: {total, hook, pacing, emotional, relatability, meme, shareability, audio, trend_fit, loopability, warnings[]}.

## 8. QA & Acceptance
- Hook relevance ≥95% (contains entity/topic); payoff present ≥90%.
- Reveal within window per length unless override.
- UI: không scroll ngang grid; title không bị cắt; storyboard actions <300ms.
- SLO met (preview/scoring p95); fallback engages on timeout/5xx.
- Golden set 20 prompt regression weekly; content safety pass.

## 9. Risks & Mitigation
- Hook lệch nội dung: enforce entity insertion + hook relevance metric; allow regen.
- Latency cao: cache analyzer; lighter models for draft; provider fallback.
- Over-shock/meme: safety filters + tone check; opt-out toggle.
