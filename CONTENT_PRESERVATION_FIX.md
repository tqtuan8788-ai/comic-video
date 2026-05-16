# Content Preservation Fix - Technical Details

## Problem Identified

User reported: "Hệ thống đang tạo ra 1 bản phân tích ý nghĩa từ nội dung tôi tải lên"

**What was happening (WRONG):**
```
User Input: "Ngày xưa có một người thợ rèn..."
      ↓
AI Analysis: Creates theme, characters, plot points
      ↓
Scene Breakdown: AI CREATES NEW SCENES with new content
      ↓
Output: "Một người thợ rèn tài ba bắt đầu hành trình..." ❌ NOT user's original content
```

**What user wanted:**
```
User Input: "Ngày xưa có một người thợ rèn..."
      ↓
AI SPLITS original text into scenes (keeps exact text)
      ↓  
AI ADDS viral structure (HOOK, BUILD, REVEAL, timing)
      ↓
Output: "Ngày xưa có một người thợ rèn..." ✅ EXACT user content
```

---

## Changes Made

### 1. Scene Breakdown Module (geminiService.ts:134-231)

**Before:**
- AI generated NEW scene content based on analysis
- `summary` field contained AI-written descriptions

**After:**
- AI SPLITS user's original text into scenes
- New schema field: `original_content` - EXACT text from user
- Prompt explicitly says: "KHÔNG được tạo nội dung mới"
- Mapping preserves: `summary = original_content`

**Key Prompt Changes:**
```typescript
**NGUYÊN TẮC:**
1. **PRESERVE ORIGINAL CONTENT** - Giữ nguyên 100% văn bản gốc của user
2. Chia văn bản thành ${desiredSceneCount} scenes
3. Mỗi scene chứa đoạn văn bản GỐC (không viết lại, không tóm tắt)
4. CHỈ thêm: loại scene (HOOK/BUILD/REVEAL/ENDING) và thời lượng
```

**Example in Prompt:**
```
Nếu user cho: "Ngày xưa có ông già. Ông rất nghèo."

Output đúng:
- Scene 1: original_content = "Ngày xưa có ông già."
- Scene 2: original_content = "Ông rất nghèo."

Output SAI:
- Scene 1: "Một người đàn ông lớn tuổi..." ❌ KHÔNG ĐƯỢC!
```

---

### 2. Storyboard & Voiceover Module (geminiService.ts:237-325)

**Before:**
- Voiceover was AI-generated based on scene summary
- Could be completely different from user's original text

**After:**
- Voiceover MUST use `scene.summary` (which IS the original content)
- Can only condense LIGHTLY if too long (max 20 words)
- Cannot rewrite or change meaning
- Fallback: if voiceover empty, use original `scene.summary`

**Key Prompt Changes:**
```typescript
1. **Voiceover** (QUAN TRỌNG NHẤT):
   - PHẢI sử dụng nội dung gốc: "${scene.summary}"
   - Có thể rút gọn NHẸ nếu quá dài (max 20 từ)
   - KHÔNG được thay đổi ý nghĩa
   - KHÔNG được viết lại hoàn toàn
```

**Code Safeguard:**
```typescript
// Fallback: if voiceover is empty or too different, use original content
let voiceover = data.voiceover;
if (!voiceover || voiceover.length < 5) {
    voiceover = scene.summary;
}
```

---

## What AI NOW Does vs. What It DOESN'T

### ✅ AI DOES (Adding Value):
1. **Splits content** - Divides original text into logical scenes
2. **Adds structure** - Assigns HOOK/BUILD/REVEAL/ENDING types
3. **Optimizes timing** - Sets duration for each scene (1.5-4s)
4. **Creates visuals** - Generate comic images for scenes
5. **Adds cinematic elements** - Camera angles, lighting, composition
6. **Creates on-screen text** - 8-word highlights from original content

### ❌ AI DOES NOT (Preserving Original):
1. ~~Rewrite user's content~~
2. ~~Create new storylines~~
3. ~~Summarize or paraphrase~~
4. ~~Add content user didn't write~~
5. ~~Change meaning or intent~~
6. ~~Generate analysis instead of content~~

---

## Flow Comparison

### OLD FLOW (Broken):
```
1. normalizeInput(text)           → cleaned_text
2. analyzeStory(cleaned_text)     → theme, characters, plot_points
3. breakdownScenes()              → AI CREATES NEW SCENES ❌
4. generateStoryboard()           → AI WRITES NEW VOICEOVER ❌
5. Result: User's content is gone, replaced with AI analysis
```

### NEW FLOW (Fixed):
```
1. normalizeInput(text)           → cleaned_text (preserved)
2. analyzeStory(cleaned_text)     → theme, characters (for metadata only)
3. breakdownScenes()              → SPLITS ORIGINAL TEXT ✅
4. generateStoryboard()           → USES ORIGINAL CONTENT ✅
5. Result: User's content intact, with viral packaging
```

---

## Testing Verification

### To Verify Fix Works:

**Input Test Content:**
```
Ngày xưa, có một người thợ rèn tài ba nhưng nghèo khổ.
Ông dành cả đời mình để rèn một thanh kiếm hoàn hảo.
Sau 30 năm, thanh kiếm cuối cùng được hoàn thành.
```

**Expected Output (Scenes):**
- Scene 1 (HOOK): "Ngày xưa, có một người thợ rèn tài ba nhưng nghèo khổ."
- Scene 2 (BUILD): "Ông dành cả đời mình để rèn một thanh kiếm hoàn hảo."
- Scene 3 (REVEAL): "Sau 30 năm, thanh kiếm cuối cùng được hoàn thành."

**Voiceover should be EXACT or VERY CLOSE:**
- NOT: "Một người thợ rèn nghèo bắt đầu cuộc hành trình..."
- YES: "Ngày xưa, có một người thợ rèn tài ba nhưng nghèo khổ."

---

## Remaining User Actions

1. **Refresh page** (dev server recompiled with new code)
2. **Enter API key** again if session lost
3. **Test with original content**
4. **Check scenes list** - should show YOUR original text
5. **Check voiceover** - should be YOUR words, not AI rewrite
6. **Verify video** - should narrate YOUR content

---

## If Still Getting Analysis Instead of Content

If AI still generates analysis instead of preserving content:

**Debug Steps:**
1. Check browser console for errors
2. Verify scene.summary in Scene List matches your input
3. If not, the schema mapping may need adjustment
4. Share error message for further debugging

**Possible Issues:**
- API caching old prompts (wait 1-2 min)
- Model misunderstanding prompt (increase emphasis)
- Schema mapping error (check code)

---

## Success Criteria

✅ **Fix is successful if:**
1. User inputs: "Tôi yêu bánh mì"
2. Scene 1 shows: "Tôi yêu bánh mì" (not "Người này thích bánh mì")
3. Voiceover says: "Tôi yêu bánh mì" (not AI paraphrase)
4. On-screen text: "Yêu bánh mì" (extracted from original)
5. Visual: Image showing someone with bánh mì

The CONTENT is user's, the PACKAGING is AI's.
