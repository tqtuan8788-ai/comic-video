Tasklist — TikTok Mode & Viral Upgrade

Phase 1 (Tuan 1-2) — Core TikTok Mode + UI + SLO
- [ ] Product: Dinh nghia input (prompt/text/anh/script) va output length 15/20/30/60s; map reveal windows (6-9s/8-12s/12-18s/20-25s).
- [ ] Product: Menu/navigation (Home, TikTok Mode, Presets, Score/Heatmap, Storyboard, Settings/API); chot SLO so bo (preview <4s p95; scoring/heatmap <2s p95).
- [ ] Product: Guardrails noi dung (chan nhay cam/gore); policy danh sach API allowed.
- [ ] AI: Content analyzer (entity/chude/tone/xung dot) nhe; contract API.
- [ ] AI: Hook generator bam noi dung (khong mau cung), chen entity/action verb som; unit tests.
- [ ] AI: Pacing/reveal heuristic (hook 0-3s); override config.
- [ ] AI: Ending/payoff suggester (2-3 payoff bam noi dung).
- [ ] FE: Grid art style auto-fit, khong scroll ngang; sidebar collapsible mobile; font rem; badges ro; title ellipsis+tooltip; Producer Review -> accordion.
- [ ] Analytics: Log hook/pacing selections, latency baseline.

Phase 2 (Tuan 3) — Scoring, heatmap, variations
- [ ] AI: Rule-based viral scoring (Hook/Pacing/Emotional/Relatability/Meme/Shareability/Audio).
- [ ] AI: Pacing heatmap labels “cham/on”; expose JSON.
- [ ] FE: UI Viral Score + canh bao <5/10; heatmap timeline.
- [ ] AI: Content variations (3 ban: action/horror/literary) bam prompt user + uoc luong score.
- [ ] Product/AI: Hook relevance metric (>=95% hook chua entity/chude); log vi pham.
- [ ] Product: Slider tempo nhanh/cham; preset do dai 15/20s cho trend short.

Phase 3 (Tuan 4-5) — Storyboard preview + optimize + quality
- [ ] FE: Storyboard preview (thumb + caption + swap/delete/regen) + beat timing per scene.
- [ ] AI/BE: Endpoint regen scene don le; giu pacing.
- [ ] Perf: Cache analyzer, model nhe; do latency preview <4s.
- [ ] QA: A/B test hook/pacing vs baseline; do retention 3s/10s.
- [ ] Product/Design: Mo rong preset phong cach (Action trailer/Horror glitch/Comedy meme/Anime/Found footage/Vlog/Dreamy).
- [ ] AI: Map preset -> image model (SDXL/OpenRouter), grading profile, TTS voice pack.
- [ ] QA: Golden set 20 prompt (action/horror/comedy/UGC/romance) regression hang tuan; check hook relevance, payoff, pacing, UI responsive.
- [ ] Product/AI: Scoring bo sung trend fit + loopability; khuyen nghi neu thieu payoff.

Phase 4 (Tuan 6) — Platform, observability, safety
- [ ] AI: Fine-tune scoring dua tren log; cap nhat rules.
- [ ] Content: Gop y trending sound/hashtag neu co du lieu; toggle optional.
- [ ] QA: Regression UI responsive + scoring; guardrails content.
- [ ] Platform: Cau hinh da provider (OpenAI/Groq/OpenRouter/Anthropic optional, SDXL, TTS ElevenLabs + free TTS); fallback order; env vars.
- [ ] Agent: Quyen fallback/chon provider theo policy (cost/latency/quality); auto-regen hook neu Hook Score <6; log hanh dong; sandbox rules.
- [ ] Observability: Dashboard SLO (latency/cost/fallback rate), health check per provider; alert khi latency/5xx tang.
- [ ] Safety: Enforcement guardrails (chan nhay cam/gore), audit log quyet dinh agent.

Definition of Done
- Hook luon chua/ami chi entity/chude tu input; khong mau cung; Hook relevance >=95%.
- Reveal nam trong cua so 6-9s (15s), 8-12s (20s), 12-18s (30s), 20-25s (60s) tru khi override.
- Grid hien du nut tren mobile, khong scroll ngang; title khong bi cat.
- Viral Score + canh bao hien <2s them; storyboard preview thao tac <300ms; preview <4s p95; scoring/heatmap <2s p95.
- Payoff co mat >=90% video; guardrails noi dung bat buoc; Settings/API co fallback; TTS co ElevenLabs + 1 free option; agent auto fallback trong danh muc cho phep.
