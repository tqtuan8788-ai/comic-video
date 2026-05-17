import { Type, Schema, Modality } from "@google/genai";
import { NormalizedInput, StoryAnalysis, Scene, StoryboardElement, Character, SceneFull } from "../types";
import { callLLM, getGeminiClient } from "./aiClient";
import { ProviderConfig, selectImageProvider, selectTTSProvider } from "./providerConfig";
import { getGeminiTtsVoice } from "./ttsSettings";
import { generateOmniVoiceAudio, getOmniVoiceSettings } from "./omniVoice";
import { isTextGroundedInScene } from "./assetBinding";
import {
  DIRECTOR_SYSTEM_PROMPT,
  TIKTOK_OPTIMIZATION_PROMPT,
  SCENE_STRUCTURE_PROMPT,
  QUALITY_CHECK_PROMPT,
  VISUAL_PROMPT_ENHANCER
} from "../prompts/systemPrompts";

// Helper to clean JSON strings
const cleanJson = (text: string) => {
  let clean = text.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  return clean.trim();
};

const extractJsonLike = (text: string): string => {
  const raw = cleanJson(text || '');
  const firstObj = raw.indexOf('{');
  const lastObj = raw.lastIndexOf('}');
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    return raw.slice(firstObj, lastObj + 1);
  }
  const firstArr = raw.indexOf('[');
  const lastArr = raw.lastIndexOf(']');
  if (firstArr !== -1 && lastArr !== -1 && lastArr > firstArr) {
    return raw.slice(firstArr, lastArr + 1);
  }
  return raw;
};

const repairJsonString = (text: string): string => {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      result += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString && (ch === '\n' || ch === '\r')) {
      result += '\\n';
      continue;
    }

    if (inString && ch === '\t') {
      result += '\\t';
      continue;
    }

    result += ch;
  }

  return result.replace(/,\s*([}\]])/g, '$1');
};

const parseJsonResponse = <T,>(text: string): T => {
  const extracted = extractJsonLike(text);
  const attempts = [
    cleanJson(text),
    extracted,
    repairJsonString(extracted)
  ];
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt) as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Invalid JSON response');
};

// Helper: Retry Operation
const retryOperation = async <T>(operation: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> => {
  let delay = initialDelay;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Retry on Rate Limit (429) OR Server Errors (500, 503)
      const isRateLimit = error.status === 429 || error.code === 429 || error.message?.includes('429');
      const isServerBusy = error.status === 503 || error.code === 503 || error.status === 500 || error.code === 500;
      const isMarkedRetryable = error.retryable === true;

      if ((isRateLimit || isServerBusy || isMarkedRetryable) && i < maxRetries - 1) {
        console.warn(`API/parse error (${error.status || error.code || error.message}). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};

// Module 1: Input Normalization
export const normalizeInput = async (text: string): Promise<NormalizedInput> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      clean_text: { type: Type.STRING, description: "The cleaned input text in Vietnamese." },
      metadata: {
        type: Type.OBJECT,
        properties: { length: { type: Type.STRING }, type: { type: Type.STRING } }
      }
    }
  };

  return await retryOperation(async () => {
    const responseText = await callLLM({
      prompt: `Normalize this text. Remove noise. Output VIETNAMESE. Input: ${text}`,
      schema,
      schemaName: "NormalizedInput",
      temperature: 0.2
    });
    if (!responseText) throw new Error("Failed to normalize");
    try { return JSON.parse(cleanJson(responseText)); }
    catch (e) { return { clean_text: text, metadata: { length: "unknown", type: "unknown" } }; }
  });
};

// Module 2: Story Understanding (Viral Strategist)
export const analyzeStory = async (text: string): Promise<StoryAnalysis> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      theme: { type: Type.STRING },
      characters: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            role: { type: Type.STRING },
            description: { type: Type.STRING }
          }
        }
      },
      plot_points: { type: Type.ARRAY, items: { type: Type.STRING } },
      hooks: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 potential hooks for the video" }
    }
  };

  return await retryOperation(async () => {
    const responseText = await callLLM({
      prompt: `Act as a Viral Content Strategist for TikTok. Analyze this story.
        Find the "Aha Moment", the core conflict, and the most shocking twist.
        Output VIETNAMESE JSON. Story: ${text}`,
      schema,
      schemaName: "StoryAnalysis",
      temperature: 0.4
    });
    if (!responseText) throw new Error("Failed to analyze");
    try {
      const data = JSON.parse(cleanJson(responseText));
      return {
        theme: data.theme || "Viral Story",
        characters: Array.isArray(data.characters) ? data.characters : [],
        plot_points: Array.isArray(data.plot_points) ? data.plot_points : [],
        hooks: Array.isArray(data.hooks) ? data.hooks : []
      };
    } catch (e) { return { theme: "Error", characters: [], plot_points: [], hooks: [] }; }
  });
};

// Helper: Calculate optimal scene count for 3-minute limit
const calculateOptimalSceneCount = (text: string, desiredCount?: number): number => {
  const MAX_DURATION = 180; // 3 minutes in seconds
  const wordCount = text.split(/\s+/).length;
  const vietnameseReadingSpeed = 3; // words per second
  const estimatedReadingTime = wordCount / vietnameseReadingSpeed;

  // Calculate max scenes that fit in 3 minutes
  // Assuming min 2 seconds per scene for smooth pacing
  const maxPossibleScenes = Math.floor(MAX_DURATION / 2);

  // Calculate optimal based on content
  const optimalScenes = desiredCount
    ? Math.min(Math.ceil(estimatedReadingTime / 2.5), maxPossibleScenes, desiredCount)
    : Math.min(Math.ceil(estimatedReadingTime / 2.5), maxPossibleScenes);

  // Ensure we stay under 3 minutes even with longer scenes
  const safeSceneCount = Math.min(optimalScenes, 60); // Hard cap at 60

  console.log(`[DURATION] Content: ${wordCount} words, Est: ${estimatedReadingTime}s, Optimal scenes: ${safeSceneCount}`);
  return Math.max(safeSceneCount, 8); // Minimum 8 scenes for story flow
};

// Helper: Calculate total duration
const calculateTotalDuration = (scenes: Scene[]): number => {
  return scenes.reduce((total, scene) => total + scene.estimated_duration, 0);
};

const normalizeSceneType = (value: unknown, index: number, total: number): Scene['type'] => {
  const raw = String(value || '').toUpperCase();
  if (raw === 'HOOK' || raw === 'BUILD' || raw === 'REVEAL' || raw === 'ENDING') return raw;
  if (index === 0) return 'HOOK';
  if (index === total - 1) return 'ENDING';
  if (index >= Math.max(1, total - 3)) return 'REVEAL';
  return 'BUILD';
};

const normalizeSceneDuration = (value: unknown): number => {
  const duration = Number(value);
  if (!Number.isFinite(duration)) return 3;
  return Math.max(1.5, Math.min(6, Math.round(duration)));
};

const normalizeScene = (raw: any, index: number, total: number): Scene | null => {
  if (!raw || typeof raw !== 'object') return null;
  const summary = String(raw.original_content || raw.summary || raw.text || raw.content || '').trim();
  if (!summary) return null;
  return {
    id: Number.isFinite(Number(raw.id)) ? Number(raw.id) : index + 1,
    summary,
    type: normalizeSceneType(raw.type, index, total),
    estimated_duration: normalizeSceneDuration(raw.estimated_duration || raw.duration)
  };
};

const extractSceneObjectsFromPartialJson = (text: string): any[] => {
  const raw = repairJsonString(cleanJson(text || ''));
  const scenesKey = raw.search(/"scenes"\s*:/);
  const source = scenesKey >= 0 ? raw.slice(scenesKey) : raw;
  const arrayStart = source.indexOf('[');
  if (arrayStart === -1) return [];

  const objects: string[] = [];
  let inString = false;
  let escaped = false;
  let depth = 0;
  let current = '';

  for (let i = arrayStart + 1; i < source.length; i++) {
    const ch = source[i];

    if (escaped) {
      if (depth > 0) current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      if (depth > 0) current += ch;
      escaped = true;
      continue;
    }

    if (ch === '"') {
      if (depth > 0) current += ch;
      inString = !inString;
      continue;
    }

    if (inString) {
      if (depth > 0) current += ch;
      continue;
    }

    if (ch === '{') {
      if (depth === 0) current = '';
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === '}') {
      if (depth > 0) current += ch;
      depth -= 1;
      if (depth === 0 && current) {
        objects.push(current);
        current = '';
      }
      continue;
    }

    if (ch === ']' && depth === 0) break;
    if (depth > 0) current += ch;
  }

  return objects.flatMap((obj) => {
    try {
      return [JSON.parse(obj)];
    } catch {
      return [];
    }
  });
};

const parseSceneBreakdown = (responseText: string): Scene[] => {
  try {
    const data = parseJsonResponse<{ scenes?: any[] }>(responseText);
    const rawScenes = Array.isArray(data?.scenes)
      ? data.scenes
      : data?.scenes && typeof data.scenes === 'object'
        ? Object.values(data.scenes)
        : [];
    const scenes = rawScenes
      .map((scene, index) => normalizeScene(scene, index, rawScenes.length))
      .filter((scene): scene is Scene => Boolean(scene));
    if (scenes.length > 0) return scenes;
  } catch (error) {
    console.warn('Scene breakdown full JSON parse failed, trying partial recovery:', error);
  }

  const recovered = extractSceneObjectsFromPartialJson(responseText);
  const scenes = recovered
    .map((scene, index) => normalizeScene(scene, index, recovered.length))
    .filter((scene): scene is Scene => Boolean(scene));
  if (scenes.length > 0) {
    console.warn(`[Scene breakdown] Recovered ${scenes.length} scene(s) from partial JSON.`);
    return scenes;
  }

  throw new Error('Scene breakdown JSON parse failed and no scenes could be recovered.');
};

const fallbackBreakdownScenes = (text: string, desiredCount: number): Scene[] => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const sentences = normalized
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const units = sentences.length ? sentences : normalized.split(/\s*[,;]\s*/).filter(Boolean);
  const sceneCount = Math.max(1, Math.min(desiredCount, units.length || 1));
  const bucketSize = Math.ceil(units.length / sceneCount);
  const scenes: Scene[] = [];

  for (let i = 0; i < units.length; i += bucketSize) {
    const summary = units.slice(i, i + bucketSize).join(' ').trim();
    if (!summary) continue;
    scenes.push({
      id: scenes.length + 1,
      summary,
      type: normalizeSceneType(undefined, scenes.length, sceneCount),
      estimated_duration: 3
    });
  }

  if (!scenes.length) {
    scenes.push({ id: 1, summary: normalized, type: 'HOOK', estimated_duration: 3 });
  }

  scenes[0].type = 'HOOK';
  scenes[scenes.length - 1].type = scenes.length === 1 ? 'HOOK' : 'ENDING';
  return scenes;
};

type ShotVarietyPlan = {
  focus: string;
  shot: string;
  angle: string;
  movement: string;
  avoid: string;
};

const buildShotVarietyPlan = (sceneIndex: number, totalScenes: number, sceneType: Scene['type']): ShotVarietyPlan => {
  const index = Math.max(1, Number.isFinite(sceneIndex) ? sceneIndex : 1);
  const total = Math.max(index, Number.isFinite(totalScenes) ? totalScenes : index);
  const basePlan: ShotVarietyPlan[] = [
    { focus: 'establishing/location', shot: 'Wide establishing', angle: 'High-angle or eye-level', movement: 'slow reveal or crane', avoid: 'face-only close-ups' },
    { focus: 'character action (full body/back/silhouette)', shot: 'Medium / full-body', angle: 'Eye-level', movement: 'tracking or dolly', avoid: 'tight face crop' },
    { focus: 'insert/prop detail', shot: 'Insert close-up', angle: 'Macro or eye-level', movement: 'slow push-in', avoid: 'frontal portrait' },
    { focus: 'environment/props', shot: 'Wide/medium', angle: 'Low-angle or eye-level', movement: 'slow pan', avoid: 'repeating the same shot as prior scene' },
    { focus: 'POV / over-the-shoulder', shot: 'OTS / POV', angle: 'Eye-level', movement: 'subtle handheld or locked-off', avoid: 'symmetrical portrait' },
    { focus: 'crowd/group/room scale', shot: 'Wide', angle: 'High-angle', movement: 'crane or dolly-out', avoid: 'single-face close-up' },
    { focus: 'reaction (not face-only)', shot: 'Medium close', angle: 'Eye-level', movement: 'locked-off', avoid: 'extreme close-up' },
    { focus: 'symbolic cutaway', shot: 'Detail / abstract', angle: 'creative', movement: 'slow', avoid: 'direct character naming' }
  ];

  const hookPlan: ShotVarietyPlan[] = [
    { focus: 'insert/prop detail', shot: 'Insert close-up', angle: 'Macro or eye-level', movement: 'slow push-in', avoid: 'face-only close-ups' },
    { focus: 'establishing/location', shot: 'Wide establishing', angle: 'High-angle', movement: 'slow reveal', avoid: 'static portrait' },
    { focus: 'symbolic cutaway', shot: 'Detail / abstract', angle: 'creative', movement: 'slow', avoid: 'literal explanation' }
  ];

  const revealPlan: ShotVarietyPlan[] = [
    { focus: 'wide reveal', shot: 'Wide reveal', angle: 'High-angle or eye-level', movement: 'dolly-out or crane', avoid: 'tight face crop' },
    { focus: 'reaction (not face-only)', shot: 'Medium close', angle: 'Eye-level', movement: 'locked-off', avoid: 'extreme close-up' },
    { focus: 'POV / over-the-shoulder', shot: 'OTS / POV', angle: 'Eye-level', movement: 'subtle', avoid: 'repeating prior shot' }
  ];

  const endingPlan: ShotVarietyPlan[] = [
    { focus: 'environment/closure', shot: 'Wide out', angle: 'Eye-level', movement: 'slow dolly-out', avoid: 'face-only close-ups' },
    { focus: 'symbolic closure', shot: 'Detail / abstract', angle: 'creative', movement: 'slow', avoid: 'literal recap text' }
  ];

  let plan = basePlan[(index - 1) % basePlan.length];
  if (sceneType === 'HOOK') plan = hookPlan[(index - 1) % hookPlan.length];
  if (sceneType === 'REVEAL') plan = revealPlan[(index - 1) % revealPlan.length];
  if (sceneType === 'ENDING' || index === total) plan = endingPlan[(index - 1) % endingPlan.length];

  plan = {
    ...plan,
    avoid: `${plan.avoid}; keep shot variety high, favor environment/props when possible`
  };

  return plan;
};

const formatShotVarietyPlan = (plan: ShotVarietyPlan, sceneIndex: number, totalScenes: number) => {
  const index = Math.max(1, sceneIndex || 1);
  const total = Math.max(index, totalScenes || index);
  return [
    `Shot Variety Planner (scene ${index}/${total}):`,
    `- Focus: ${plan.focus}.`,
    `- Shot: ${plan.shot}.`,
    `- Angle/movement: ${plan.angle}; ${plan.movement}.`,
    `- Avoid: ${plan.avoid}.`
  ].join('\n');
};

// Module 3: Scene Breakdown - preserves original content and keeps duration sane
export const breakdownScenes = async (
  text: string,
  analysis: StoryAnalysis,
  desiredSceneCount?: number,
  allowRewriteForViral: boolean = false
): Promise<Scene[]> => {
  const optimizedSceneCount = calculateOptimalSceneCount(text, desiredSceneCount);
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      scenes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            original_content: { type: Type.STRING, description: "Exact text from the user. Do not rewrite." },
            summary: { type: Type.STRING, description: "Brief summary for internal reference" },
            type: { type: Type.STRING, enum: ['HOOK', 'BUILD', 'REVEAL', 'ENDING'] },
            estimated_duration: { type: Type.INTEGER }
          },
          required: ['id', 'original_content', 'summary', 'type', 'estimated_duration']
        }
      }
    }
  };

  try {
    const scenes = await retryOperation(async () => {
      const responseText = await callLLM({
      prompt: `${DIRECTOR_SYSTEM_PROMPT}

Cut the following Vietnamese text into ${optimizedSceneCount} scenes for a 9:16 short video.
- Keep the user's ORIGINAL wording exactly in "original_content". Do not rewrite or paraphrase it.
- If allow_rewrite=${allowRewriteForViral ? 'true' : 'false'}, you may condense/reshape wording ONLY to improve TikTok retention (hook strength, pacing 1.5-3s, curiosity chain) but DO NOT change meaning.
- Target 2-4 seconds per scene; total under 180 seconds.
- Mark each scene type as HOOK, BUILD, REVEAL, or ENDING to reflect story flow.
- Include a short internal summary only if needed.
- Keep JSON compact: no markdown, no comments, no line breaks inside string values.

ORIGINAL TEXT (Vietnamese):
${text}

Story theme: ${analysis.theme}

Return JSON following the schema.`,
      schema,
      schemaName: "SceneBreakdown",
      temperature: 0.25,
      maxOutputTokens: Math.min(16000, Math.max(4096, optimizedSceneCount * 240))
    });
      if (!responseText) throw new Error("Failed to breakdown scenes");
      try {
        return parseSceneBreakdown(responseText);
      } catch (error: any) {
        console.error("Scene breakdown parse error:", error);
        error.retryable = true;
        throw error;
      }
    });

    const totalDuration = calculateTotalDuration(scenes);
    console.log(`[DURATION] Total video: ${totalDuration}s (${Math.ceil(totalDuration / 60)}min)`);

    if (totalDuration > 180) {
      console.warn(`[DURATION] Video exceeds 3min! Adjusting scene durations...`);
      const scaleFactor = 180 / totalDuration;
      scenes.forEach(scene => {
        scene.estimated_duration = Math.max(1.5, Math.floor(scene.estimated_duration * scaleFactor));
      });
      const newTotal = calculateTotalDuration(scenes);
      console.log(`[DURATION] Adjusted to: ${newTotal}s`);
    }

    return scenes;
  } catch (error) {
    console.warn("[Scene breakdown] Falling back to deterministic sentence split after AI parse failure:", error);
    const fallbackScenes = fallbackBreakdownScenes(text, optimizedSceneCount);
    if (!fallbackScenes.length) {
      throw error instanceof Error ? error : new Error("Failed to breakdown scenes");
    }
    return fallbackScenes;
  }
};
// Module 4: Storyboard & Script (Cinematic Director - Uses Original Content)
export const generateStoryboardAndScript = async (
  scene: Scene | SceneFull,
  analysis: StoryAnalysis,
  worldContext?: string,
  sequence?: { index: number; total: number }
): Promise<{ storyboard: StoryboardElement, voiceover_text: string, visual_prompt: string }> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      storyboard: {
        type: Type.OBJECT,
        properties: {
          shot: { type: Type.STRING },
          angle: { type: Type.STRING },
          movement: { type: Type.STRING },
          action: { type: Type.STRING },
          lighting: { type: Type.STRING },
          background: { type: Type.STRING },
          on_screen_text: { type: Type.STRING },
          sound_effect: { type: Type.STRING },
          characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, position: { type: Type.STRING }, pose: { type: Type.STRING }, emotion: { type: Type.STRING } } } }
        }
      },
      voiceover: { type: Type.STRING, description: "Use ORIGINAL scene content, can condense slightly but DO NOT rewrite meaning" },
      visual_prompt: { type: Type.STRING }
    }
  };

  return await retryOperation(async () => {
    const shotPlan = buildShotVarietyPlan(sequence?.index || scene.id, sequence?.total || scene.id, scene.type);
    const shotPlanText = formatShotVarietyPlan(shotPlan, sequence?.index || scene.id, sequence?.total || scene.id);
    const responseText = await callLLM({
      prompt: `${DIRECTOR_SYSTEM_PROMPT}

Create a storyboard and Vietnamese voiceover for scene ${scene.id}.
Original scene text: "${scene.summary}"
Story world (stay consistent): ${worldContext || analysis.theme || 'N/A'}
Key characters: ${(analysis.characters || []).map((c) => `${c.name}${c.role ? ` (${c.role})` : ''}`).join(', ') || 'N/A'}

Scene info:
- Type: ${scene.type} (Hook/Build/Reveal/Ending)
- Duration: ${scene.estimated_duration}s

${shotPlanText}

TikTok Viral Rules (from research file):
- Hook must use curiosity gap/pattern interrupt; < 3s; on_screen_text <= 8 words.
- Chain curiosity: every beat ends with a new question/tension; never fully close loop until ENDING.
- Pacing: aim 1.5-3s per scene; avoid long static shots.
- High-arousal tone (awe/excitement), insider vibe, no generic wording.
- ENDING must include dual CTA: ask for comment choice + follow/save/share for part 2.

Requirements:
1) Voiceover: keep original meaning, stay close to the source text, max ~20 Vietnamese words. Keep curiosity; do not reveal payoff too early.
2) On-screen text: ONE hook-style line (<= 8 Vietnamese words), drama/question/tension, do NOT spoil resolution, no UI/badges.
3) For ENDING scenes, inject CTA naturally in voiceover or on_screen_text: "comment l?a ch?n X/Y", "follow/nh?n theo d?i", "save/l?u l?i xem l?i", "chia s? n?u th?y h?u ?ch".
4) Visual prompt: describe shot, angle, movement, lighting, background, atmosphere. No UI/text bubbles.
5) Maintain continuity and consistency with previous scenes.
6) Keep era/setting/props aligned to the story world above. No random offices, beaches, or unrelated homes. If mafia/crime tone is implied, keep gritty/urban mood.

Return JSON matching the schema.`,
      schema,
      schemaName: "StoryboardScene",
      temperature: 0.5
    });

    if (!responseText) throw new Error("Failed to gen storyboard");
    const data = JSON.parse(cleanJson(responseText));

    let voiceover = (data as any).voiceover as string;
    if (!voiceover || voiceover.length < 5) {
      voiceover = scene.summary;
    }
    if (!isTextGroundedInScene(voiceover, scene.summary)) {
      console.warn(`[storyboard] Voiceover for scene ${scene.id} was not grounded; using scene summary.`);
      voiceover = scene.summary;
    }

    return {
      storyboard: (data as any).storyboard,
      voiceover_text: voiceover,
      visual_prompt: (data as any).visual_prompt
    };
  });
};

// Module 4.5: Script Polisher - keeps meaning but ensures hooks/CTA
export const polishSceneScript = async (
  scene: SceneFull,
  analysis: StoryAnalysis
): Promise<SceneFull> => {
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      voiceover: { type: Type.STRING },
      on_screen_text: { type: Type.STRING },
      needs_cta: { type: Type.BOOLEAN }
    }
  };

  return await retryOperation(async () => {
    const responseText = await callLLM({
      prompt: `${DIRECTOR_SYSTEM_PROMPT}

Polish the following scene for a TikTok video. Preserve facts but make the text natural, engaging and complete.

Scene:
- Type: ${scene.type}
- Summary: ${scene.summary}
- Voiceover: ${scene.voiceover_text}
- On-screen text: ${scene.storyboard?.on_screen_text || ''}

Rules:
1. Voiceover must be <= 24 Vietnamese words but form a complete sentence (no dangling phrases).
2. On-screen text <= 8 words, curiosity-driven.
3. If scene type is ENDING, append a CTA (comment/follow/save/share) naturally.
4. Maintain tone from story theme: ${analysis.theme}.

Return JSON with fields: voiceover, on_screen_text, needs_cta (true if CTA was injected).`,
      schema,
      schemaName: "ScenePolish",
      temperature: 0.4
    });

    if (!responseText) return scene;
    try {
      const data = JSON.parse(cleanJson(responseText));
      const candidateVoiceover = data.voiceover?.trim() || scene.voiceover_text;
      const polishedVoiceover = isTextGroundedInScene(candidateVoiceover, scene.summary)
        ? candidateVoiceover
        : scene.voiceover_text || scene.summary;
      const polishedHook = data.on_screen_text?.trim() || scene.storyboard?.on_screen_text || scene.summary;
      return {
        ...scene,
        voiceover_text: polishedVoiceover,
        storyboard: {
          ...scene.storyboard,
          on_screen_text: polishedHook
        }
      };
    } catch (err) {
      console.warn("[polishSceneScript] Failed to parse response:", err);
      return scene;
    }
  });
};
// Module 5: Image Generation (Cinematic Face ID Consistency + Art Styles) - FIXED
const ensurePortraitOrientation = async (base64: string) => {
  if (typeof Image === "undefined") return;
  const isPortrait = await new Promise<boolean>((resolve) => {
    const imgEl = new Image();
    imgEl.onload = () => resolve(imgEl.naturalHeight >= imgEl.naturalWidth);
    imgEl.onerror = () => resolve(true);
    imgEl.src = `data:image/png;base64,${base64}`;
  });
  if (!isPortrait) {
    throw new Error("Model returned landscape image; retrying for portrait.");
  }
};

export const generateComicImage = async (
  prompt: string,
  characters: Character[],
  artStyle: string = 'comic_manhua',
  worldContext: string = ''
): Promise<string> => {
  const provider = selectImageProvider();
  return await retryOperation(async () => {
    const parts: any[] = [];
    const { buildStyledPrompt, getStyleConfig } = await import('../prompts/artStyles');

    // 1. Cinematic Director Prompt for Visual Consistency with Art Style
    const worldAnchor = worldContext?.trim()
      ? `GLOBAL WORLD/SETTING (stay consistent every scene): ${worldContext.trim()}
- Keep same city/era/weather/props across all frames.
- Reuse motifs and wardrobe unless the scene explicitly changes them.
- Vietnamese cast unless otherwise specified.`
      : `GLOBAL WORLD/SETTING: keep the same location, era, weather, and wardrobe across scenes.`;

    const continuityGuard = `
STYLE LOCK: One art style only (${artStyle}). No mixing realistic/anime/comic; match the selected style for every scene.
CONTINUITY LOCK: Keep characters/faces/outfits consistent unless this scene asks for a change.
NO GENRE DRIFT: Do not switch to fantasy/ancient/other worlds unless the prompt says so.`;

    if (provider?.name === 'pollinations') {
      const pollinationsPrompt = buildPollinationsPrompt(
        prompt,
        characters,
        artStyle,
        worldContext,
        getStyleConfig(artStyle as any)
      );
      return await generatePollinationsImage(pollinationsPrompt, provider);
    }

    const styledPrompt = buildStyledPrompt(
      `${DIRECTOR_SYSTEM_PROMPT}

Create a 9:16 cinematic comic panel for the scene below.

${VISUAL_PROMPT_ENHANCER}

${worldAnchor}

SCENE DESCRIPTION:
${prompt}

${continuityGuard}

CASTING RULES:
- Face reference images are provided below.
- Keep characters consistent with those references; do not invent new faces.

STYLE RULES:
- 100% consistent with the selected art style.
- No mixed styles, no speech bubbles, no UI or text overlays.
- Cinematic lighting, high detail.
- ABSOLUTELY PORTRAIT 9:16 (vertical). Do not generate landscape. Do not rotate.
- Portrait framing only: avoid landscape spacing, no horizontal staging.
- Subjects must fit naturally in portrait frame; fill the frame vertically.
- Use power areas of a portrait frame (upper third/central), avoid empty side space.
- Add depth: foreground/background separation, directional light, shadows.
- Imply camera movement (push-in/tilt/pan feel) through composition cues.

QUALITY CHECK:
${QUALITY_CHECK_PROMPT}

Before generating, verify style consistency, face consistency, and overall coherence.`,
      artStyle as any
    );

    if (provider?.name === 'sdxl_local') {
      const payload = {
        prompt: styledPrompt,
        artStyle,
        worldContext,
        references: characters
          .filter((char) => !!char.reference_image)
          .map((char) => ({
            name: char.name,
            image: char.reference_image
          }))
      };

      const response = await fetch((provider.baseUrl || 'http://localhost:5000/generate').replace(/\/$/, ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SDXL local error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const base64 = data.image || data.base64 || data.output?.[0];
      if (!base64) {
        throw new Error("SDXL local provider returned no image data");
      }
      const normalized = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
      await ensurePortraitOrientation(normalized.split(',')[1] || base64);
      return normalized;
    }

    const ai = getGeminiClient();
    parts.push({ text: styledPrompt });

    // 2. Add Character Reference Images for Consistency
    characters.forEach((char) => {
      if (char.reference_image) {
        const base64Data = char.reference_image.includes('base64,')
          ? char.reference_image.split(',')[1]
          : char.reference_image;

        if (base64Data) {
          parts.push({ text: `\n**Exact face reference for character "${char.name}":**` });
          parts.push({
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          });
        }
      }
    });

    // 3. Call Imagen Model with proper structure
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },  // Correct structure
      config: {
        imageConfig: {
          aspectRatio: "9:16",
          imageSize: "1K"
        }
      }
    });

    // 4. Extract Generated Image with better error handling
    console.log("[DEBUG] Image generation response received, checking for image data...");

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.error("[ERROR] No candidates in image response");
      throw new Error("No image candidates generated - check API quota");
    }

    const candidate = response.candidates[0];
    if (!candidate || !candidate.content || !candidate.content.parts) {
      console.error("[ERROR] Invalid candidate structure:", candidate);
      throw new Error("Invalid image response structure");
    }

    for (const part of candidate.content.parts) {
      if (part.inlineData && part.inlineData.data) {
        console.log("[DEBUG] Image successfully extracted, size:", part.inlineData.data.length);
        const base64 = part.inlineData.data;
        await ensurePortraitOrientation(base64);
        return `data:image/png;base64,${base64}`;
      }
    }

    console.error("[ERROR] No inlineData found in parts");
    throw new Error("No image data in response - model may not support image generation");
  });
};

// Helper: Create WAV header for PCM audio data
const createWavFile = (base64Pcm: string, sampleRate: number = 24000): string => {
  // Decode base64 PCM data
  const pcmData = atob(base64Pcm);
  const pcmBytes = new Uint8Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    pcmBytes[i] = pcmData.charCodeAt(i);
  }

  // WAV file parameters
  const numChannels = 1; // Mono
  const bitsPerSample = 16; // 16-bit Linear PCM
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBytes.length;
  const fileSize = 36 + dataSize;

  // Create WAV buffer
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Copy PCM data
  const wavData = new Uint8Array(wavBuffer);
  wavData.set(pcmBytes, 44);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < wavData.length; i++) {
    binary += String.fromCharCode(wavData[i]);
  }
  return btoa(binary);
};

const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
};

const compactPromptText = (value: string, maxChars: number): string => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).replace(/\s+\S*$/, '').trim();
};

export const buildPollinationsPrompt = (
  scenePrompt: string,
  characters: Character[],
  artStyle: string,
  worldContext: string,
  styleConfig: { name: string; positive: string; negative: string }
): string => {
  const characterText = characters
    .map((char) => [char.name, char.role, char.description].filter(Boolean).join(': '))
    .filter(Boolean)
    .slice(0, 4)
    .join('; ');

  const prompt = [
    `Vertical 9:16 cinematic comic panel. EXACT SCENE TO DEPICT: ${compactPromptText(scenePrompt, 850)}`,
    worldContext ? `Story context for continuity: ${compactPromptText(worldContext, 360)}` : '',
    characterText
      ? `Use only these story characters when relevant: ${compactPromptText(characterText, 260)}`
      : 'Do not add unrelated people; only include people explicitly required by the scene.',
    `Art style: ${styleConfig.name}. ${compactPromptText(styleConfig.positive, 360)}`,
    'Composition: scene-specific subject in the center/upper third, clear location, cinematic lighting, depth, dramatic mood, portrait framing.',
    `Strict negative: ${styleConfig.negative}, unrelated young women, random fashion portrait, generic two-girl pose, unrelated modern room, unrelated beach/city, text, subtitles, UI, logo, watermark, speech bubbles.`
  ].filter(Boolean).join('\n');

  return compactPromptText(prompt, 1800);
};

const generatePollinationsImage = async (prompt: string, provider: ProviderConfig): Promise<string> => {
  const baseUrl = (provider.baseUrl || 'https://image.pollinations.ai/prompt').replace(/\/$/, '');
  const model = provider.modelImage || 'flux';
  const seed = hashString(`${model}:${prompt}`) % 1000000000;
  const url = `${baseUrl}/${encodeURIComponent(prompt)}?width=720&height=1280&model=${encodeURIComponent(model)}&seed=${seed}&nologo=true&enhance=false`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*'
    }
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Pollinations image error ${response.status}: ${errorText || response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Pollinations returned non-image response: ${errorText.slice(0, 200)}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  if (contentType.includes('png') || contentType.includes('jpeg') || contentType.includes('jpg')) {
    await ensurePortraitOrientation(base64);
  }
  return `data:${contentType};base64,${base64}`;
};

const generateElevenLabsAudio = async (text: string, provider: ProviderConfig): Promise<string> => {
  if (!provider.apiKey) {
    throw new Error("Missing ElevenLabs API key (TTS_ELEVENLABS_KEY).");
  }

  const baseUrl = (provider.baseUrl || 'https://api.elevenlabs.io').replace(/\/$/, '');
  const voiceId = provider.ttsVoice || 'default_voice_id';
  const url = `${baseUrl}/v1/text-to-speech/${voiceId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': provider.apiKey,
      Accept: 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.4, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:audio/mpeg;base64,${base64}`;
};

const generateExternalTTS = async (text: string, provider: ProviderConfig): Promise<string> => {
  if (!provider.baseUrl) {
    throw new Error("External TTS provider missing baseUrl");
  }

  const omniSettings = getOmniVoiceSettings();
  const providerLooksLikeOmniVoice =
    provider.id === 'tts_free' ||
    provider.name === 'tts_free' ||
    provider.name.toLowerCase().includes('omnivoice') ||
    (provider.baseUrl || '').toLowerCase().includes('omnivoice') ||
    (provider.baseUrl || '') === omniSettings.endpointUrl;

  if (providerLooksLikeOmniVoice) {
    return generateOmniVoiceAudio(text, provider);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (provider.apiKey) {
    headers['Authorization'] = `Bearer ${provider.apiKey}`;
  }

  const response = await fetch(provider.baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      text,
      voice: provider.ttsVoice || 'default',
      format: 'mp3'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`External TTS error ${response.status}: ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await response.json();
    let audioBase64 = data.audio || data.base64 || data.data;
    if (!audioBase64 && data.url) {
      const audioResponse = await fetch(data.url);
      if (!audioResponse.ok) {
        throw new Error(`External TTS fetch error ${audioResponse.status}`);
      }
      const buffer = await audioResponse.arrayBuffer();
      audioBase64 = arrayBufferToBase64(buffer);
      return `data:audio/mpeg;base64,${audioBase64}`;
    }
    if (!audioBase64) {
      throw new Error("External TTS provider returned no audio payload");
    }
    return audioBase64.startsWith('data:')
      ? audioBase64
      : `data:audio/mpeg;base64,${audioBase64}`;
  }

  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  return `data:audio/mpeg;base64,${base64}`;
};

// Module 6: Audio Generation (TTS) - FIXED v3 with PCM + WAV Header
export const generatePlayableAudio = async (
  text: string,
  options?: { voiceName?: string; languageCode?: string }
): Promise<string> => {
  const provider = selectTTSProvider();
  if (provider?.name === 'tts_elevenlabs') {
    return await retryOperation(() => generateElevenLabsAudio(text, provider));
  }
  if (provider?.name === 'tts_free') {
    return await retryOperation(() => generateExternalTTS(text, provider));
  }
  try {
    return await retryOperation(async () => {
      const ai = getGeminiClient();
      console.log("[DEBUG] Generating audio for text:", text.substring(0, 50));

      const voiceName = (options?.voiceName || getGeminiTtsVoice() || provider?.ttsVoice || '').trim();
      const languageCode = (options?.languageCode || 'vi-VN').trim();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{
          role: "user",
          parts: [{ text }]
        }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            languageCode,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName }
            }
          }
        }
      });

      console.log("[DEBUG] Audio response received");
      const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64PcmAudio = inlineData?.data;

      if (!base64PcmAudio) {
        console.error("[ERROR] No audio data in response");
        throw new Error("No audio generated");
      }

      console.log("[AUDIO] Raw PCM data received, size:", base64PcmAudio.length);
      console.log("[AUDIO] Creating WAV file with header...");

      const base64WavAudio = createWavFile(base64PcmAudio, 24000);

      console.log("[AUDIO] WAV file created successfully, size:", base64WavAudio.length);
      return `data:audio/wav;base64,${base64WavAudio}`;
    });
  } catch (error: any) {
    const msg = error?.message || '';
    if (msg.toLowerCase().includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || error?.status === 429) {
      throw new Error("Quota exceeded for TTS model. Please check billing/limits and try again later.");
    }
    throw error;
  }
};
