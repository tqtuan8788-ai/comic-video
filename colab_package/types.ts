export interface Character {
  name: string;
  role: string;
  description: string;
  reference_image?: string; // Base64 string of the uploaded face
}

export interface InputMetadata {
  length: string;
  type: string;
}

export interface NormalizedInput {
  clean_text: string;
  metadata: InputMetadata;
}

export interface StoryAnalysis {
  theme: string;
  characters: Character[];
  plot_points: string[];
  hooks: string[]; // Potential hooks found in analysis
}

export interface Scene {
  id: number;
  summary: string;
  type: 'HOOK' | 'BUILD' | 'REVEAL' | 'ENDING'; // TikTok Structure
  estimated_duration: number; // in seconds
}

export interface StoryboardCharacter {
  name: string;
  position: string;
  pose: string;
  emotion: string;
}

export interface StoryboardElement {
  shot: string; // Wide, Medium, Close-up, etc.
  angle: string;
  movement: string;
  characters: StoryboardCharacter[];
  background: string;
  lighting: string;
  action: string;
  visual_prompt?: string;
  on_screen_text: string; // The "Big Text" / Headline (Max 8 words)
  sound_effect?: string; // Whoosh, Boom, etc.
}

export interface SceneFull extends Scene {
  storyboard: StoryboardElement;
  voiceover_text: string;
  generated_image_url?: string;
  generated_audio_url?: string;
  generated_audio_voiceName?: string;
  generated_audio_languageCode?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

export enum AppStep {
  INPUT = 0,
  ANALYSIS = 1,
  CHARACTERS = 2,
  SCENES = 3,
  STORYBOARD = 4,
  GENERATION = 5,
  PREVIEW = 6,
}

export interface PipelineState {
  currentStep: AppStep;
  rawInput: string;
  normalized: NormalizedInput | null;
  analysis: StoryAnalysis | null;
  scenes: SceneFull[];
  isProcessing: boolean;
  error: string | null;
  desiredSceneCount: number;
  autoSceneCount: boolean;
  allowRewriteForViral: boolean;
  selectedPresetId?: string; // NEW: Selected preset
  viralScore?: ViralScore; // NEW: Computed viral score
}

// NEW: Viral Score interfaces (re-exported from viralScoring service)
export interface ViralScoreDimensions {
  hookQuality: number;
  pacing: number;
  emotionalImpact: number;
  relatability: number;
  memePotential: number;
  shareability: number;
  audioQuality: number;
  trendFit: number;
  loopability: number;
}

export interface ViralScore {
  overall: number;
  dimensions: ViralScoreDimensions;
  suggestions: string[];
  warnings: string[];
}

export interface PacingSegment {
  startTime: number;
  endTime: number;
  label: string;
  speedRating: 'fast' | 'good' | 'slow';
  scenes: number[];
}

// Re-export enum (needs regular export to be used as value)
export { ArtStyle } from './types/storyTypes';

// Re-export types only
export type { StoryPrompt, GeneratedStory, StoryCritique } from './types/storyTypes';
