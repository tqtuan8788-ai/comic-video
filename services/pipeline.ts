/**
 * Headless Pipeline Orchestrator
 *
 * Extracts the full ComicVideoAI pipeline from React UI into pure async functions.
 * Both the web UI and the API server can call these functions.
 *
 * Pipeline: normalize → analyze → breakdown → storyboard → images → audio → result
 */

import type { NormalizedInput, StoryAnalysis, Scene, SceneFull, StoryboardElement } from '../types';
import type { Character } from '../types';
import {
  normalizeInput,
  analyzeStory,
  breakdownScenes,
  generateStoryboardAndScript,
  generateComicImage,
  generatePlayableAudio,
  polishSceneScript,
} from './geminiService';

// ── Types ──────────────────────────────────────────────────────────

export interface PipelineConfig {
  artStyle: string;
  voiceName?: string;
  languageCode?: string;
  sceneCount?: number;
  allowRewriteForViral?: boolean;
  worldContext?: string;
  characters?: Character[];
  onProgress?: (step: string, detail: string) => void;
}

export interface SceneAsset {
  index: number;
  scene: SceneFull;
  imageBase64: string;
  audioBase64: string;
  voiceoverText: string;
  visualPrompt: string;
  storyboard: StoryboardElement;
  error?: string;
}

export interface PipelineResult {
  normalized: NormalizedInput;
  analysis: StoryAnalysis;
  scenes: Scene[];
  assets: SceneAsset[];
  totalDuration: number;
  errors: string[];
}

// ── Pipeline Steps ─────────────────────────────────────────────────

export async function stepNormalize(rawText: string): Promise<NormalizedInput> {
  return normalizeInput(rawText);
}

export async function stepAnalyze(text: string): Promise<StoryAnalysis> {
  return analyzeStory(text);
}

export async function stepBreakdown(
  text: string,
  analysis: StoryAnalysis,
  config: PipelineConfig
): Promise<Scene[]> {
  return breakdownScenes(
    text,
    analysis,
    config.sceneCount,
    config.allowRewriteForViral ?? false
  );
}

export async function stepStoryboard(
  scene: Scene | SceneFull,
  analysis: StoryAnalysis,
  config: PipelineConfig,
  sequence?: { index: number; total: number }
): Promise<{ storyboard: StoryboardElement; voiceover_text: string; visual_prompt: string }> {
  return generateStoryboardAndScript(scene, analysis, config.worldContext, sequence);
}

export async function stepPolishScript(
  scene: SceneFull,
  analysis: StoryAnalysis
): Promise<SceneFull> {
  return polishSceneScript(scene, analysis);
}

export async function stepGenerateImage(
  visualPrompt: string,
  config: PipelineConfig
): Promise<string> {
  return generateComicImage(
    visualPrompt,
    config.characters || [],
    config.artStyle,
    config.worldContext || ''
  );
}

export async function stepGenerateAudio(
  voiceoverText: string,
  config: PipelineConfig
): Promise<string> {
  return generatePlayableAudio(voiceoverText, {
    voiceName: config.voiceName,
    languageCode: config.languageCode || 'vi-VN',
  });
}

// ── Full Pipeline ──────────────────────────────────────────────────

export async function runFullPipeline(
  rawText: string,
  config: PipelineConfig
): Promise<PipelineResult> {
  const errors: string[] = [];
  const notify = (step: string, detail: string) => {
    config.onProgress?.(step, detail);
  };

  // Step 1: Normalize
  notify('normalize', 'Cleaning input text...');
  let normalized: NormalizedInput;
  try {
    normalized = await normalizeInput(rawText);
  } catch (e: any) {
    errors.push(`normalize: ${e.message}`);
    normalized = {
      clean_text: rawText,
      metadata: { length: 'unknown', type: 'unknown' },
    };
  }

  // Step 2: Analyze story
  notify('analyze', 'Analyzing story structure...');
  let analysis: StoryAnalysis;
  try {
    analysis = await analyzeStory(normalized.clean_text);
  } catch (e: any) {
    errors.push(`analyze: ${e.message}`);
    analysis = { theme: 'Unknown', characters: [], plot_points: [], hooks: [] };
  }

  // Step 3: Breakdown scenes
  notify('breakdown', `Breaking into ${config.sceneCount || 'optimal'} scenes...`);
  let scenes: Scene[];
  try {
    scenes = await breakdownScenes(
      normalized.clean_text,
      analysis,
      config.sceneCount,
      config.allowRewriteForViral
    );
  } catch (e: any) {
    errors.push(`breakdown: ${e.message}`);
    throw new Error(`Scene breakdown failed: ${e.message}`);
  }

  // Step 4: Storyboard + voiceover for each scene
  notify('storyboard', `Creating storyboard for ${scenes.length} scenes...`);
  const scenesFull: SceneFull[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    try {
      const result = await generateStoryboardAndScript(
        scene,
        analysis,
        config.worldContext,
        { index: i, total: scenes.length }
      );
      const sceneFull: SceneFull = {
        ...scene,
        storyboard: result.storyboard,
        voiceover_text: result.voiceover_text,
        generated_image_url: undefined,
        generated_audio_url: undefined,
        status: 'pending',
      };
      scenesFull.push(sceneFull);
      notify('storyboard', `Scene ${i + 1}/${scenes.length} storyboard done`);
    } catch (e: any) {
      errors.push(`storyboard[${i}]: ${e.message}`);
      const sceneFull: SceneFull = {
        ...scene,
        storyboard: { shot: '', angle: '', movement: '', characters: [], background: '', lighting: '', action: '', on_screen_text: '' },
        voiceover_text: scene.summary,
        status: 'pending',
      };
      scenesFull.push(sceneFull);
    }
  }

  // Step 5: Polish scripts (optional but improves quality)
  notify('polish', 'Polishing scripts...');
  for (let i = 0; i < scenesFull.length; i++) {
    try {
      scenesFull[i] = await polishSceneScript(scenesFull[i], analysis);
    } catch {
      // Polish is best-effort
    }
  }

  // Step 6: Generate images + audio for each scene
  const assets: SceneAsset[] = [];
  for (let i = 0; i < scenesFull.length; i++) {
    const scene = scenesFull[i];
    const visualPrompt =
      (scene as any).visual_prompt ||
      (typeof scene.storyboard === 'object' && (scene.storyboard as any)?.visual_prompt) ||
      scene.summary;

    let imageBase64 = '';
    let audioBase64 = '';

    // Generate image
    notify('image', `Scene ${i + 1}/${scenesFull.length} — generating image...`);
    try {
      imageBase64 = await generateComicImage(
        visualPrompt,
        config.characters || [],
        config.artStyle,
        config.worldContext || ''
      );
    } catch (e: any) {
      errors.push(`image[${i}]: ${e.message}`);
    }

    // Generate audio
    notify('audio', `Scene ${i + 1}/${scenesFull.length} — generating voice...`);
    try {
      audioBase64 = await generatePlayableAudio(scene.voiceover_text || scene.summary, {
        voiceName: config.voiceName,
        languageCode: config.languageCode || 'vi-VN',
      });
    } catch (e: any) {
      errors.push(`audio[${i}]: ${e.message}`);
    }

    assets.push({
      index: i,
      scene,
      imageBase64,
      audioBase64,
      voiceoverText: scene.voiceover_text || scene.summary,
      visualPrompt,
      storyboard: scene.storyboard as any,
      error: errors.filter((e) => e.includes(`[${i}]`)).join('; ') || undefined,
    });

    notify('progress', `${i + 1}/${scenesFull.length} scenes complete`);
  }

  // Calculate total duration
  const totalDuration = scenesFull.reduce(
    (sum, s) => sum + (s.estimated_duration || 2.5),
    0
  );

  notify('done', `Pipeline complete — ${scenesFull.length} scenes, ${totalDuration.toFixed(0)}s`);

  return {
    normalized,
    analysis,
    scenes: scenesFull,
    assets,
    totalDuration,
    errors,
  };
}

// ── Quick Pipeline (no storyboard, fast mode) ──────────────────────

export async function runQuickPipeline(
  scriptText: string,
  config: PipelineConfig
): Promise<{
  scenes: Array<{
    text: string;
    voiceover: string;
    imageBase64: string;
    audioBase64: string;
  }>;
  errors: string[];
}> {
  const result = await runFullPipeline(scriptText, config);

  const scenes = result.assets.map((asset) => ({
    text: asset.scene.summary,
    voiceover: asset.voiceoverText,
    imageBase64: asset.imageBase64,
    audioBase64: asset.audioBase64,
  }));

  return { scenes, errors: result.errors };
}
