- [x] Tao thu muc prd, agent
- [x] Viet PRD tai prd/product-requirement.md
- [x] Tao tasklist tai agent/tasklist.md

Phase 1 — Config & Platform
- [x] Chuan hoa .env.local schema da provider (OpenAI/Groq/OpenRouter/SDXL/TTS)
- [x] Thiet lap provider priority, policy cost/quality/speed, USE_FREE_ONLY toggle
- [x] Guardrails noi dung (NSFW/gore) + whitelist API agent
- [ ] Health check/fallback cho tung provider
- [ ] Log telemetry latency/cost/fallback

Phase 2 — TikTok Mode & Logic
- [ ] Content analyzer (entity/chude/tone/xung dot/sentiment) nhe
- [ ] Hook generator bam noi dung (0–12 tu, action verb som), Hook relevance >=95%
- [ ] Pacing/reveal heuristic: hook 0–3s; reveal windows theo 15/20/30/60s
- [ ] Payoff suggester (>=2 payoff lien quan)
- [ ] Variations (mainstream/edgy/meme) + ly do chon + uoc luong score
- [ ] Scoring: Hook/Pacing/Emotional/Relatability/Meme/Shareability/Audio + TrendFit + Loopability
- [ ] Heatmap 0–10/10–30/30–50/50–60 (scale theo do dai)

Phase 3 — UI/UX & Preview
- [ ] Menu: Home, TikTok Mode, Presets, Score/Heatmap, Storyboard, Settings/API
- [ ] Grid art style auto-fit, khong scroll ngang; sidebar collapsible; font rem; badges ro; title ellipsis+tooltip
- [ ] Producer Review -> accordion
- [ ] Storyboard preview (thumb+caption+beat time) swap/delete/regen <300ms
- [ ] Viral Score + canh bao <2s; heatmap timeline
- [ ] Quick preview 9:16 voi marker hook/reveal/payoff

Phase 4 — Audio/Visual & Presets
- [ ] Map preset phong cach -> model image (SDXL/OpenRouter) + grading + TTS voice pack
- [ ] TTS: ElevenLabs + free TTS fallback; policy chon voice theo preset
- [ ] Trend assist: goi y sound/hashtag/caption (optional toggle)

Phase 5 — QA/Release
- [ ] Golden set 20 prompt regression (action/horror/comedy/UGC/romance) hang tuan
- [ ] SLO: preview <4s p95; scoring/heatmap <2s p95; fallback auto
- [ ] Payoff >=90%; Hook relevance >=95%; UI responsive kiem thu mobile
- [ ] A/B hook tempo va payoff timing; do retention 3s/10s/completion
- [ ] Noi dung an toan: filter/opt-out; audit log agent actions
- [ ] Chay toan bo test suite
