import { Schema, Type } from "@google/genai";
import { callLLM } from "./aiClient";
import { SceneFull, StoryAnalysis } from "../types";
import type { ViralScore } from "./viralScoring";

const cleanJson = (text: string) => {
  let clean = (text || "").trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  return clean.trim();
};

const extractJsonLike = (text: string): string => {
  const raw = cleanJson(text);
  const firstArr = raw.indexOf("[");
  const lastArr = raw.lastIndexOf("]");
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    return raw.slice(firstArr, lastArr + 1);
  }
  const firstObj = raw.indexOf("{");
  const lastObj = raw.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    return raw.slice(firstObj, lastObj + 1);
  }
  return raw;
};

const repairJsonString = (text: string): string => {
  // Fix common LLM issues: unescaped newlines/tabs inside strings and trailing commas.
  let inString = false;
  let escaped = false;
  let result = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === "\n" || ch === "\r")) {
      result += "\\n";
      continue;
    }

    if (inString && ch === "\t") {
      result += "\\t";
      continue;
    }

    result += ch;
  }

  return result.replace(/,\s*([}\]])/g, "$1");
};

// Extract top-level objects inside an array even if the array is truncated
const extractObjectsFromArray = (text: string): string[] => {
  const cleaned = repairJsonString(text);
  const objects: string[] = [];
  let inArray = false;
  let inString = false;
  let escaped = false;
  let depth = 0;
  let current = "";

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (!inArray) {
      if (ch === "[") inArray = true;
      continue;
    }

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      continue;
    }

    if (ch === "{") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === "}") {
      depth--;
      current += ch;
      if (depth === 0) {
        objects.push(current.trim());
        current = "";
      }
      continue;
    }
    if (depth > 0) {
      current += ch;
    }
  }

  return objects;
};

export type AutoImprovePatch = {
  id: number;
  voiceover_text: string;
  on_screen_text: string;
  action: string;
  visual_prompt: string;
  estimated_duration: number;
};

export async function autoImproveScenesWithAI(params: {
  scenes: SceneFull[];
  analysis: StoryAnalysis;
  score?: ViralScore;
}): Promise<AutoImprovePatch[]> {
  const { scenes, analysis, score } = params;
  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      patches: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            voiceover_text: { type: Type.STRING },
            on_screen_text: { type: Type.STRING },
            action: { type: Type.STRING },
            visual_prompt: { type: Type.STRING },
            estimated_duration: { type: Type.NUMBER },
          },
          required: ["id", "voiceover_text", "on_screen_text", "action", "visual_prompt", "estimated_duration"],
        },
      },
      notes: { type: Type.STRING },
    },
    required: ["patches"],
  };

  const packed = scenes.map((s) => ({
    id: s.id,
    type: s.type,
    estimated_duration: s.estimated_duration,
    summary: s.summary,
    voiceover_text: s.voiceover_text || "",
    on_screen_text: s.storyboard?.on_screen_text || "",
    action: s.storyboard?.action || "",
    visual_prompt: s.storyboard?.visual_prompt || "",
  }));

  const scoreHints = score
    ? [
        `overall=${score.overall.toFixed(1)}/10`,
        ...(score.warnings || []).slice(0, 6).map((w) => `warn: ${w}`),
        ...(score.suggestions || []).slice(0, 8).map((s) => `suggest: ${s}`),
      ].join("\n")
    : "N/A";

  const promptBase = `
You are a TikTok viral editor. Improve the script/storyboard while preserving factual meaning.

Context:
- Theme: ${analysis.theme}
- Characters: ${(analysis.characters || []).map((c) => c.name).filter(Boolean).join(", ") || "N/A"}

Current score:
${scoreHints}

Input scenes JSON:
${JSON.stringify(packed)}

Goals:
1) Pacing: make each scene feel fast; set estimated_duration to 2-3 seconds (<= 3). Keep total duration reasonable (do not inflate).
2) Hook: On-screen text must be <= 8 Vietnamese words, curiosity-driven, strong pattern interrupt.
3) Voiceover: <= 24 Vietnamese words; complete sentence; natural and engaging.
4) Emotional: add a clear visual payoff near the end (ENDING) (strong image/action, not vague thinking).
5) Shareability: add 1-2 "OMG" moments (BUILD/REVEAL) to make viewers want to share (strong twist, concrete).
6) Keep story facts; do NOT invent new crimes/locations/claims beyond the provided summary. You can intensify framing but not fabricate.
7) Output Vietnamese only. Do NOT include markdown. Return ONLY valid JSON object matching schema.
8) Keep all text fields on a single line (no line breaks inside values).
9) Do NOT just copy the input. Change at least one of voiceover/on_screen_text/action/visual_prompt or adjust duration to 2-3s. If nothing to improve, return an empty array.

Notes:
- Prefer minimal edits when possible, but ensure the goals are met.
- Update action + visual_prompt to better match the improved beat and payoff.
`;

  const tryOnce = async (temperature: number) => {
    const responseText = await callLLM({
      prompt: promptBase,
      schema,
      schemaName: "AutoImprovePatches",
      temperature,
      maxOutputTokens: 4096,
    });
    if (!responseText) return [];
    const extracted = extractJsonLike(responseText);
    const attempts = [extracted, repairJsonString(extracted)];
    let lastErr: unknown = null;

    for (const attempt of attempts) {
      try {
        const parsed = JSON.parse(attempt);
        const rawPatches = Array.isArray(parsed) ? parsed : parsed?.patches;
        const patches =
          Array.isArray(rawPatches) ? rawPatches : rawPatches && typeof rawPatches === "object" ? Object.values(rawPatches) : [];
        if (!Array.isArray(patches)) continue;
        const allowed = new Set(scenes.map((s) => s.id));
        const normalized = (patches as any[])
          .filter((p) => p && typeof p === "object" && allowed.has(Number(p.id)))
          .map((p) => ({
            id: Number(p.id),
            voiceover_text: String(p.voiceover_text ?? "").trim(),
            on_screen_text: String(p.on_screen_text ?? "").trim(),
            action: String(p.action ?? "").trim(),
            visual_prompt: String(p.visual_prompt ?? "").trim(),
            estimated_duration: Number(p.estimated_duration),
          }))
          .filter((p) => p.voiceover_text && p.on_screen_text);
        const meaningful = normalized.filter((p) => {
          const scene = sceneById.get(p.id);
          if (!scene) return false;
          const durDiff = Math.abs((p.estimated_duration || 0) - (scene.estimated_duration || 0));
          const diff =
            (p.voiceover_text || "").toLowerCase() !== (scene.voiceover_text || "").toLowerCase() ||
            (p.on_screen_text || "").toLowerCase() !== (scene.storyboard?.on_screen_text || "").toLowerCase() ||
            (p.action || "").toLowerCase() !== (scene.storyboard?.action || "").toLowerCase() ||
            (p.visual_prompt || "").toLowerCase() !== (scene.storyboard?.visual_prompt || "").toLowerCase() ||
            durDiff > 0.2;
          return diff;
        });
        if (meaningful.length > 0) {
          return meaningful as AutoImprovePatch[];
        }
      } catch (err) {
        lastErr = err;
      }
    }

    // Fallback: try to salvage individual objects from a possibly truncated array
    for (const attempt of attempts) {
      const objects = extractObjectsFromArray(attempt);
      if (!objects.length) continue;
      const allowed = new Set(scenes.map((s) => s.id));
      const normalized: AutoImprovePatch[] = [];
      for (const obj of objects) {
        try {
          const parsed = JSON.parse(obj);
          if (!parsed || typeof parsed !== "object" || !allowed.has(Number((parsed as any).id))) continue;
          const patch = {
            id: Number((parsed as any).id),
            voiceover_text: String((parsed as any).voiceover_text ?? "").trim(),
            on_screen_text: String((parsed as any).on_screen_text ?? "").trim(),
            action: String((parsed as any).action ?? "").trim(),
            visual_prompt: String((parsed as any).visual_prompt ?? "").trim(),
            estimated_duration: Number((parsed as any).estimated_duration),
          };
          if (patch.voiceover_text && patch.on_screen_text) {
            normalized.push(patch);
          }
        } catch (err) {
          lastErr = err;
        }
      }
      if (normalized.length > 0) {
        console.warn("[autoImproveScenesWithAI] Recovered patches from partial JSON:", normalized.length);
        return normalized;
      }
    }

    if (lastErr) {
      console.warn("[autoImproveScenesWithAI] JSON parse failed:", lastErr);
    }

    console.warn("[autoImproveScenesWithAI] No valid patches extracted. Response:", responseText);

    return [];
  };

  const first = await tryOnce(0.45);
  if (first.length > 0) return first;
  const second = await tryOnce(0.25);
  return second;
}
