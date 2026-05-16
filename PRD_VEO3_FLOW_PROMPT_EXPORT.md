# PRD: Veo 3 Flow Prompt Export (Animate ảnh tĩnh thành video kể chuyện)

## 0) Tóm tắt
ComicVideoAI hiện tạo **storyboard + ảnh tĩnh + voiceover** theo cấu trúc kể chuyện nhanh (TikTok). Mục tiêu tính năng mới: bổ sung **một đầu ra “Prompt chuẩn Veo 3/Flow”** để người dùng đưa **ảnh tĩnh** (đã gen từ ComicVideoAI hoặc ảnh do user cung cấp) vào **Veo 3/Flow** và tạo ra **clip chuyển động** có chất lượng điện ảnh, mạch kể chuyện rõ ràng, và giảm lỗi “ngớ ngẩn” (sai vật lý, drift nhân vật, nhảy continuity…).

Trọng tâm: đứng trên vai trò **đạo diễn/kịch bản Hollywood khó tính**, ưu tiên **tính nhất quán** (nhân vật – bối cảnh – đạo cụ – ánh sáng – logic vật lý), **ngôn ngữ quay phim**, và **nhịp kể chuyện**.

---

## 1) Mục tiêu (Goals)
1. Tạo **tab mới** xuất “Veo Prompt Pack” từ storyboard hiện có.
2. Đảm bảo prompt hướng đến **storytelling** (shot-by-shot), không chỉ “gen video cho xong”.
3. Tối ưu **tính nhất quán nhân vật** (outfit/đặc điểm/giọng/tone), giảm drift giữa clip.
4. Tối ưu **logic vật lý & không gian** (trục nhìn 180°, hướng trái/phải, đạo cụ tồn tại liên tục, ánh sáng hợp lý).
5. Hỗ trợ workflow theo đặc trưng Flow: **clip ngắn** (thường 8s) để lắp thành cảnh dài trong NLE.
6. Có **bộ kiểm tra (lint)** để bắt lỗi prompt trước khi xuất.

## 2) Không nằm trong phạm vi (Non-goals)
1. Không triển khai gọi API Veo/Flow trực tiếp (giai đoạn 1). Chỉ xuất prompt + cấu trúc.
2. Không thay thế pipeline sinh ảnh hiện tại; đây là **đầu ra bổ sung**.
3. Không đảm bảo đúng cú pháp 100% cho mọi phiên bản/biến thể UI của Flow; thiết kế theo hướng **adaptable**, có preset output “Flow-ready”.

---

## 3) Bối cảnh & vấn đề cần giải
### 3.1 Vấn đề khi biến ảnh tĩnh → video bằng model video
Các lỗi phổ biến cần phòng:
- **Character drift**: tóc/áo/mặt/tuổi thay đổi giữa clip.
- **Không nhất quán vật lý**: vật thể xuyên nhau, vị trí đạo cụ “teleport”, tay/đồ vật thay đổi bất hợp lý.
- **Sai không gian**: đảo trái-phải, vi phạm trục nhìn, nhân vật đổi vị trí không có lý do.
- **Sai camera grammar**: jump cut khó chịu, thay shot không có “motivation”, chuyển cảnh lộn xộn.
- **Text/subtitles bị burn-in** (tuỳ model/workflow), watermark/overlay không mong muốn.

### 3.2 Vì sao cần Prompt Pack thay vì prompt rời rạc
Để dựng chuyện tốt, prompt phải:
- Có **Bible** (World/Style/Character) áp dụng cho toàn bộ clip.
- Có **Shot plan**: shot type, lens/DOF, camera move, blocking, action, cảm xúc, âm thanh/nhịp.
- Có **Continuity locks** + Negative prompt rõ ràng.

---

## 4) Người dùng mục tiêu
1. Creator TikTok/Reels/Shorts: muốn story nhanh, nhiều beat, nhưng clip phải “đã mắt”.
2. Agency/Editor: muốn xuất prompt có cấu trúc để đưa vào Flow, sau đó dựng trong CapCut/Premiere/Resolve.
3. Filmmaker/Storyteller: muốn shot list theo ngôn ngữ đạo diễn, kiểm soát continuity rất chặt.

---

## 5) User stories (cần có)
1. Là user, khi đã có storyboard trong ComicVideoAI, tôi mở tab “Veo 3 / Flow Prompts” và nhận:
   - Global Bible (world + style + nhân vật)
   - Danh sách clip prompt theo scene/shot
   - Negative prompts + checklist
2. Là user, tôi chọn chế độ:
   - **Image-to-video**: dùng chính ảnh tĩnh của từng scene làm ảnh nguồn.
   - **Ingredients-to-video**: thêm ảnh tham chiếu (nhân vật/bối cảnh/style) để giảm drift.
   - **First/Last frame transition**: dùng ảnh scene i làm first frame và ảnh scene i+1 làm last frame cho clip chuyển cảnh.
3. Là user, tôi chọn “độ dài clip” (4/6/8s) và “độ mạnh chuyển động” (subtle/medium/strong) mà vẫn giữ logic.
4. Là user, khi sửa voiceover/on-screen/action/visual prompt trong storyboard, prompt Veo cập nhật và highlight phần thay đổi.
5. Là user, tôi xuất prompt ra dạng:
   - Text (copy/paste)
   - JSON (shot list + metadata)
   - CSV (để quản lý trong spreadsheet)

---

## 6) Phạm vi tính năng (Scope)
### 6.1 Tab mới: “Veo 3 / Flow Prompts”
Hiển thị 3 lớp output:
1. **Global Director Bible**
2. **Shot/Clip Prompts** (mỗi scene 1 clip hoặc packing nhiều scene/clip)
3. **QC & Lint report**

### 6.2 Chế độ xuất (Export modes)
1. **Per-scene clip** (mặc định): 1 scene → 1 prompt (phù hợp với ảnh tĩnh đã có).
2. **Clip packing** (tuỳ chọn): gộp 2–4 scene thành 1 clip (để tiết kiệm credit và ít drift hơn).
3. **Transition clips** (tuỳ chọn): tạo prompt chuyển cảnh bằng first/last frame.

### 6.3 “Director Strictness”
Chế độ strict tạo prompt “khó tính”:
- Bắt buộc shot type + camera move + ánh sáng + blocking.
- Cấm mơ hồ (“somewhere”, “a person”, “then”) nếu clip độc lập.
- Bắt buộc continuity tokens (outfit, props, time-of-day).

---

## 7) Đặc tả Prompt Pack (Prompt spec)
### 7.1 Global Director Bible (áp dụng cho toàn bộ)
**World Bible**
- Thời gian/địa điểm/khí hậu/đạo cụ chính/luật vật lý (vd: mưa → bề mặt ướt, phản chiếu).
- Ràng buộc continuity: cùng kiến trúc, cùng palette, cùng thời điểm trong ngày (trừ khi scene chuyển).

**Character Bible**
- Cho mỗi nhân vật: 12–20 thuộc tính ổn định (tuổi, vóc dáng, màu da, tóc, outfit, phụ kiện, đặc điểm nhận dạng).
- “Do not change” list: tóc, outfit chủ đạo, phụ kiện signature.

**Cinematography Bible**
- Tỉ lệ khung hình (9:16 / 16:9), độ hạt film, contrast, color grading.
- Quy tắc dựng: ưu tiên match cut, motivated cut; hạn chế jump cut vô lý.
- Quy tắc trục nhìn (180°), hướng trái/phải.

**Negative Bible**
- Không chữ/subtitle overlay, không watermark UI, không logo, không morph face, không extra fingers, không “brand names”.

### 7.2 Prompt cho từng clip (khuyến nghị cấu trúc)
Tối thiểu gồm 5 phần (formula):
1) **Cinematography** (shot size, camera move, lens/DOF)
2) **Subject** (nhân vật chính + traits ngắn gọn, bám Character Bible)
3) **Action** (hành động tuyến tính, micro-actions)
4) **Context** (bối cảnh/đạo cụ/ánh sáng)
5) **Style & Ambiance** (mood, grade, film stock)

Mở rộng (ưu tiên cho Flow/Veo):
- **Motion channels tách biệt**:
  - Subject motion (cử động nhân vật/đạo cụ)
  - Camera motion (dolly/pan/handheld/crane)
- **Composition**: rule of thirds, leading lines, foreground/background separation.
- **Audio notes** (tuỳ chọn): ambience/SFX; có thể để trống nếu user chỉ muốn silent và dùng TTS nội bộ.

### 7.3 Timestamp prompting (tuỳ chọn, rất quan trọng cho kể chuyện)
Cho clip 8s, prompt có thể chia:
- `[00:00-00:02]` Beat 1 (hook visual)
- `[00:02-00:04]` Beat 2 (escalation)
- `[00:04-00:06]` Beat 3 (reveal/turn)
- `[00:06-00:08]` Beat 4 (hold/transition pose)

Điều này giúp:
- Điều khiển nhịp dựng trong 1 lần gen
- Giữ continuity tốt hơn so với “then/after that” mơ hồ

### 7.4 Image-to-video & “ingredients”
**Image-to-video (per scene)**
- Input: ảnh scene (từ ComicVideoAI) + prompt clip.
- Ràng buộc: giữ identity, outfit, lighting direction “compatible” với ảnh nguồn; chỉ thêm motion hợp lý.

**Ingredients-to-video**
- Input: ảnh scene + (optional) ảnh tham chiếu: nhân vật, địa điểm, style.
- Mục tiêu: giảm drift giữa các clip có cùng nhân vật/bối cảnh.

**First/Last frame transition**
- Input: ảnh scene i (first frame) + ảnh scene i+1 (last frame) + prompt chuyển cảnh.
- Mục tiêu: chuyển cảnh mượt, không “teleport”.

---

## 8) Mapping từ ComicVideoAI → Veo Prompt
Nguồn dữ liệu sẵn có:
- `SceneFull.storyboard.action`: hành động/visual beat → **Action**
- `SceneFull.storyboard.visual_prompt`: mô tả cảnh → **Context/Style**
- `SceneFull.storyboard.on_screen_text`: headline → dùng làm “intent”/beat (không nhất thiết render text)
- `SceneFull.voiceover_text`: nhịp kể chuyện → dùng làm “narrative intent” và timeline beats
- `analysis.characters[]` + `reference_image`: **Character Bible + Ingredients**
- `artStyle`: **Style & Ambiance**

Quy tắc: prompt Veo **không được** mâu thuẫn với storyboard; nếu thiếu thông tin, phải yêu cầu user bổ sung (vd: outfit signature).

---

## 9) UI/UX yêu cầu
Tab “Veo 3 / Flow Prompts” có:
- Bộ chọn:
  - Mode: Per-scene / Packed / Transitions
  - Duration: 4s / 6s / 8s
  - Motion intensity: Subtle / Medium / Strong
  - Aspect ratio target: 9:16 / 16:9
  - Use ingredients: On/Off
  - Timestamp beats: On/Off
  - No subtitles/No text overlay: On (mặc định)
- Hiển thị:
  - Global Bible (copy)
  - Mỗi clip: prompt + negative + settings + liên kết tới scene id
  - Lint report: lỗi/warn/suggest
- Export buttons:
  - Copy all (text)
  - Download JSON
  - Download CSV

---

## 10) Lint/QC (bắt lỗi “ngớ ngẩn” trước khi xuất)
Các rule tối thiểu:
1. **Character lock**: mỗi clip phải nhắc lại 2–4 traits ổn định (tóc/outfit/đặc điểm).
2. **No contradiction**: không vừa “night” vừa “bright noon”; không “rain” nhưng “dry dust”.
3. **Camera clarity**: có shot size (close/medium/wide) + camera move rõ (hoặc explicitly “locked-off”).
4. **Motion separation**: nếu có handheld thì phải chủ ý; không vô tình “shaky”.
5. **No forbidden overlays**: nhắc “no subtitles, no text overlay, no watermark UI”.
6. **Continuity tokens**: đạo cụ/địa điểm chính phải lặp đúng tên/đặc điểm.
7. **Left-right continuity** (cơ bản): nếu clip kế tiếp là reverse shot, phải ghi “reverse angle” thay vì tự đảo.

---

## 11) KPI / Success metrics
1. Người dùng có thể xuất prompt và dùng trong Flow để tạo clip **ít drift hơn** so với prompt tự viết.
2. Giảm tỉ lệ lỗi:
   - Drift nhân vật (tóc/outfit/face) giảm rõ rệt qua phản hồi user.
   - “Weird physics / teleport props” giảm qua checklist + prompt constraints.
3. Thời gian tạo “prompt pack” < 1s với chế độ template; < 10s nếu có “Director AI pass” (tuỳ chọn).

---

## 12) Rủi ro & giảm thiểu
1. **Syntax khác nhau giữa Veo/Flow phiên bản** → xuất nhiều preset format (Flow-ready / Generic).
2. **Prompt dài gây tốn credit/khó tuân thủ** → có “prompt budget” + auto-summarize theo cấu trúc.
3. **User muốn dùng thoại** nhưng Veo/Flow có thể sinh subtitle burn-in → default “no subtitles” + hướng dẫn workaround.
4. **Ảnh nguồn (tĩnh) chất lượng thấp** → đề xuất upscale trước (không bắt buộc).

---

## 13) Quyết định mặc định (không cần bạn xác nhận)
Vì bạn không muốn phải xác nhận theo “nghiệp vụ đạo diễn” và muốn kiểm chứng bằng output, hệ thống sẽ tự chốt mặc định như sau:

1. **Flow 8s + per-scene clips (mặc định)**: mỗi scene = 1 clip 8s để kiểm soát continuity; “Packed clips” là tuỳ chọn (giai đoạn sau).
2. **Aspect ratio mặc định: 9:16** (bám TikTok workflow), vẫn cho phép đổi 16:9 trong tab.
3. **Kế thừa khung cảnh giữa clip**:
   - Luôn thêm “end-pose/hold 0.5–1s” ở cuối clip để làm điểm nối.
   - Tuỳ chọn tạo **transition prompt** kiểu “first frame = scene i, last frame = scene i+1” để chuyển cảnh mượt, giảm “teleport”.
   - Luôn giữ **World/Character/Cinematography Bible** nhất quán xuyên suốt.
4. **Kịch bản theo dạng kể chuyện (storytelling beats)**: mặc định chia nhịp theo micro-arc kiểu **Hook → Build → Turn/Revelation → Payoff/Cliffhanger**, và bật **timestamp beats** để điều khiển nhịp trong 8s.
5. **Tích hợp góc quay/cảnh quay (shot planner)**: tự suy shot/angle/movement theo loại scene + action; ưu tiên grammar (180-degree rule, screen direction) và bật **Director strict mode** để khóa continuity.
6. **Không nhét “Nguồn/raw snippet” vào prompt**: chỉ giữ theme/nhân vật/plot points để continuity; **ảnh tham chiếu vẫn dùng ở Flow dưới dạng input image/ingredients** (không nhúng vào text prompt) để giảm drift.
7. **Không dùng “Director AI pass” ở v1** để tiết kiệm token/cost: v1 dùng template deterministic từ storyboard; v2 mới cân nhắc thêm bước LLM “polish” nếu cần.
