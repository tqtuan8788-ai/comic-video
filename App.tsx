import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { SceneFull, AppStep, PipelineState, Character, ArtStyle, ViralScore, StoryAnalysis } from './types';
import {
  generateComicImage,
  generatePlayableAudio,
  breakdownScenes,
  analyzeStory,
  generateStoryboardAndScript,
  normalizeInput,
  polishSceneScript
} from './services/geminiService';
import { checkContentSafety } from './services/guardrails';
import { updateRuntimeConfig, ProviderConfig, selectLLMProvider, selectImageProvider, selectTTSProvider } from './services/providerConfig';
import { getGeminiTtsVoice } from './services/ttsSettings';
import { InputModule } from './components/InputModule';
import { AnalysisModule } from './components/AnalysisModule';
import { CharacterSetupModule } from './components/CharacterSetupModule';
import { StoryboardModule } from './components/StoryboardModule';
import { VideoPreviewModule } from './components/VideoPreviewModule';
import { StoryGeneratorModule } from './components/StoryGeneratorModule';
import { ExportAssets } from './components/ExportAssets';
import { ArtStyleSelector } from './components/ArtStyleSelector';
import { SceneEditor } from './components/SceneEditor';
import { PipelineSupervisor } from './components/PipelineSupervisor';
import { ProcessTimeline } from './components/ProcessTimeline';
import { ProducerPanel } from './components/ProducerPanel';
import { SupervisorLog } from './components/SupervisorLog';
import { ViralChecklist } from './components/ViralChecklist';
import { NavigationBar } from './components/NavigationBar';
import { GuideTab } from './components/GuideTab';
import { VeoPromptExportTab } from './components/VeoPromptExportTab';
// NEW: TikTok Mode imports
import { ViralScoreDisplay } from './components/ViralScoreDisplay';
import { PacingHeatmap } from './components/PacingHeatmap';
import { PresetSelector } from './components/PresetSelector';
import { StoryboardPreview } from './components/StoryboardPreview';
import { SettingsPanel } from './components/SettingsPanel'; // Removed duplicate ProviderConfig import
import { calculateViralScore, calculatePacingHeatmap } from './services/viralScoring';
import { autoImproveScenesWithAI, AutoImprovePatch } from './services/autoImprove';
import { PresetConfig, getPresetById, getDefaultTikTokPreset, applyPreset } from './services/presetConfig';
import { assetBindingKey, buildBoundSceneImagePrompt, getGroundedTtsText } from './services/assetBinding';
import { STYLE_PROMPTS } from './prompts/artStyles';
import { Loader2, Film, Sparkles, Edit3 } from 'lucide-react';

const readClientEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta !== undefined && meta !== 'undefined' && meta !== 'null') return meta;
  if (typeof process !== 'undefined' && process.env?.[key]) {
    const value = process.env[key] as string;
    return value === 'undefined' || value === 'null' ? '' : value;
  }
  return '';
};

const LOCAL_GEMINI_API_KEY = readClientEnv('VITE_GEMINI_API_KEY') || readClientEnv('GEMINI_API_KEY');
const LOCAL_DEEPSEEK_API_KEY = readClientEnv('VITE_DEEPSEEK_API_KEY') || readClientEnv('DEEPSEEK_API_KEY');
const LOCAL_GEMINI_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  (readClientEnv('VITE_GEMINI_ENABLED') || readClientEnv('GEMINI_ENABLED')).trim().toLowerCase()
);
const LOCAL_CODEX_OPENAI_BASE_URL =
  readClientEnv('VITE_CODEX_OPENAI_BASE_URL') ||
  readClientEnv('CODEX_OPENAI_BASE_URL') ||
  '/api/openai-codex/v1';
const LOCAL_CODEX_IMAGE_GENERATE_URL =
  readClientEnv('VITE_CODEX_IMAGE_GENERATE_URL') ||
  readClientEnv('CODEX_IMAGE_GENERATE_URL') ||
  '/api/codex-image/generate';

const INITIAL_STATE: PipelineState = {
  currentStep: AppStep.INPUT,
  rawInput: '',
  normalized: null,
  analysis: null,
  scenes: [],
  isProcessing: false,
  error: null,
  desiredSceneCount: 12,
  autoSceneCount: true,
  allowRewriteForViral: true,
};

const STATE_KEY = 'comicvideoai_state';


const App: React.FC = () => {
  const [state, setState] = useState<PipelineState>(INITIAL_STATE);

  const [providers, setProviders] = useState<ProviderConfig[]>([
    {
      id: 'openai_codex',
      name: 'OpenAI Codex OAuth',
      type: 'llm',
      enabled: true,
      apiKey: 'codex-oauth-placeholder',
      baseUrl: LOCAL_CODEX_OPENAI_BASE_URL,
      model: readClientEnv('VITE_CODEX_OPENAI_MODEL_TEXT') || readClientEnv('CODEX_OPENAI_MODEL_TEXT') || 'gpt-5.5',
      priority: 0,
      healthStatus: 'unknown'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      type: 'llm',
      enabled: true,
      apiKey: LOCAL_DEEPSEEK_API_KEY,
      baseUrl: readClientEnv('VITE_DEEPSEEK_BASE_URL') || readClientEnv('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
      model: readClientEnv('VITE_DEEPSEEK_MODEL_TEXT') || readClientEnv('DEEPSEEK_MODEL_TEXT') || 'deepseek-chat',
      priority: 1,
      healthStatus: 'unknown'
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      type: 'llm',
      enabled: LOCAL_GEMINI_ENABLED && !!LOCAL_GEMINI_API_KEY,
      apiKey: LOCAL_GEMINI_API_KEY,
      model: 'gemini-2.5-flash',
      priority: 4,
      healthStatus: 'unknown'
    },
    { id: 'openai', name: 'OpenAI GPT-4o', type: 'llm', enabled: false, apiKey: readClientEnv('VITE_OPENAI_API_KEY') || readClientEnv('OPENAI_API_KEY'), model: 'gpt-4o', priority: 4, healthStatus: 'unknown' },
    { id: 'groq', name: 'Groq Llama 3', type: 'llm', enabled: false, apiKey: readClientEnv('VITE_GROQ_API_KEY') || readClientEnv('GROQ_API_KEY'), model: 'llama3-70b-8192', priority: 5, healthStatus: 'unknown' },
    { id: 'openai_codex_image', name: 'OpenAI Codex Image', type: 'image', enabled: true, apiKey: '', baseUrl: LOCAL_CODEX_IMAGE_GENERATE_URL, model: readClientEnv('VITE_CODEX_IMAGE_MODEL') || readClientEnv('CODEX_IMAGE_MODEL') || 'gpt-image-2', priority: 2, healthStatus: 'unknown' },
    { id: 'pollinations', name: 'Pollinations Flux', type: 'image', enabled: true, apiKey: '', baseUrl: readClientEnv('VITE_POLLINATIONS_IMAGE_URL') || readClientEnv('POLLINATIONS_IMAGE_URL') || 'https://image.pollinations.ai/prompt', model: readClientEnv('VITE_POLLINATIONS_MODEL_IMAGE') || readClientEnv('POLLINATIONS_MODEL_IMAGE') || 'flux', priority: 3, healthStatus: 'unknown' },
    { id: 'sdxl_local', name: 'SDXL Local/ComfyUI', type: 'image', enabled: false, apiKey: '', baseUrl: readClientEnv('VITE_SDXL_LOCAL_URL') || readClientEnv('SDXL_LOCAL_URL') || 'http://localhost:5000/generate', model: 'sdxl', priority: 9, healthStatus: 'unknown' },
    { id: 'tts_elevenlabs', name: 'ElevenLabs TTS', type: 'tts', enabled: false, apiKey: readClientEnv('VITE_TTS_ELEVENLABS_KEY') || readClientEnv('TTS_ELEVENLABS_KEY'), priority: 6, healthStatus: 'unknown' },
    { id: 'tts_free', name: 'OpenAI Edge TTS', type: 'tts', enabled: true, apiKey: readClientEnv('VITE_TTS_FREE_KEY') || readClientEnv('TTS_FREE_KEY'), baseUrl: readClientEnv('VITE_TTS_FREE_URL') || readClientEnv('TTS_FREE_URL') || '/api/edge-tts/tts', model: 'tts-1', ttsVoice: readClientEnv('VITE_TTS_FREE_VOICE') || readClientEnv('TTS_FREE_VOICE') || 'vi-VN-HoaiMyNeural', priority: 3, healthStatus: 'unknown' },
    { id: 'tts_omnivoice', name: 'OmniVoice Optional', type: 'tts', enabled: false, apiKey: readClientEnv('VITE_TTS_OMNIVOICE_KEY') || readClientEnv('TTS_OMNIVOICE_KEY'), baseUrl: readClientEnv('VITE_TTS_OMNIVOICE_URL') || readClientEnv('TTS_OMNIVOICE_URL') || '/api/omnivoice/tts', model: 'external', ttsVoice: readClientEnv('VITE_TTS_OMNIVOICE_VOICE') || readClientEnv('TTS_OMNIVOICE_VOICE') || 'default', priority: 8, healthStatus: 'unknown' },
  ]);
  const [costPolicy, setCostPolicy] = useState<'quality_first' | 'cost_saver' | 'speed_first'>('quality_first');
  const [useFreeOnly, setUseFreeOnly] = useState(false);

  // Navigation & UI State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [previewTab, setPreviewTab] = useState<'preview' | 'export'>('preview');
  const [storyboardView, setStoryboardView] = useState<'edit' | 'preview'>('edit');
  const [storyGenKey, setStoryGenKey] = useState(0);
  const [mode, setMode] = useState<string>('manual_input');
  const [showMobileSupervisor, setShowMobileSupervisor] = useState(false);
  const [supervisorEnabled, setSupervisorEnabled] = useState(true);
  const [autoRun, setAutoRun] = useState(false);
  const [skipTTS, setSkipTTS] = useState(false);
  const [supervisorLog, setSupervisorLog] = useState<string[]>([]);
  const [artStyle, setArtStyle] = useState<ArtStyle>(ArtStyle.COMIC_MANHUA);
  const [showManualEdit, setShowManualEdit] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [autoImproveOpen, setAutoImproveOpen] = useState(false);
  const [autoImproveLoading, setAutoImproveLoading] = useState(false);
  const [autoImproveError, setAutoImproveError] = useState<string | null>(null);
  const [autoImproveDraft, setAutoImproveDraft] = useState<AutoImprovePatch[] | null>(null);

  const quotaPersistRef = useRef(true);
  const persistEnabledRef = useRef(true);

  // Computed
  const generationCharacters = useMemo(() => state.analysis?.characters || [], [state.analysis]);
  const activePreset = useMemo(
    () => (state.selectedPresetId ? getPresetById(state.selectedPresetId) : undefined),
    [state.selectedPresetId]
  );
  const veoArtStyle = activePreset?.artStyle || artStyle;

  useEffect(() => {
    if (!state.selectedPresetId) return;
    const preset = getPresetById(state.selectedPresetId);
    if (preset && preset.artStyle !== artStyle) {
      setArtStyle(preset.artStyle);
    }
  }, [state.selectedPresetId, artStyle]);

  // Sync providers to service
  useEffect(() => {
    console.log('[App] Syncing providers to runtime config', providers.map(p => ({ id: p.id, hasKey: !!p.apiKey })));
    updateRuntimeConfig(providers);
  }, [providers]);

  // Restore persisted progress (lightweight fields only, avoids huge blobs)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.currentStep !== undefined) {
          const restoredScenes = (parsed.scenes || []).map((s: any) => ({
            ...s,
            status: s.status || 'pending'
          }));
          const restoredScore =
            parsed.viralScore && typeof parsed.viralScore === 'object'
              ? parsed.viralScore
              : parsed.analysis && restoredScenes.length
                ? calculateViralScore(restoredScenes, parsed.analysis)
                : undefined;
          setState({
            ...INITIAL_STATE,
            ...parsed,
            scenes: restoredScenes,
            viralScore: restoredScore,
            isProcessing: false,
            error: null
          });
          setMode(parsed.mode || 'manual_input');
        }
      }
    } catch (e) {
      console.warn('[STATE] Failed to restore persisted state', e);
    }
  }, []);

  // Persist progress when state changes (without heavy blobs)
  useEffect(() => {
    const snapshot = {
      currentStep: state.currentStep,
      rawInput: state.rawInput,
      normalized: state.normalized,
      analysis: state.analysis,
      scenes: state.scenes.map(s => {
        const safeImage =
          s.generated_image_url && s.generated_image_url.length < 2000 && !s.generated_image_url.startsWith('data:')
            ? s.generated_image_url
            : undefined;
        const safeAudio =
          s.generated_audio_url && s.generated_audio_url.length < 2000 && !s.generated_audio_url.startsWith('data:')
            ? s.generated_audio_url
            : undefined;
        return {
          id: s.id,
          summary: s.summary,
          type: s.type,
          estimated_duration: s.estimated_duration,
          storyboard: s.storyboard,
          voiceover_text: s.voiceover_text,
          status: s.status,
          generated_image_url: safeImage,
          generated_audio_url: safeAudio,
          generated_image_promptKey: s.generated_image_promptKey,
          generated_audio_textKey: s.generated_audio_textKey,
        };
      }),
      desiredSceneCount: state.desiredSceneCount,
      mode,
      viralScore: state.viralScore,
    };
    if (!persistEnabledRef.current) return;
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[STATE] Persist skipped (quota):', (e as Error)?.message);
      persistEnabledRef.current = false;
      try { sessionStorage.removeItem(STATE_KEY); } catch { }
    }
  }, [state, mode]);

  const handleError = (msg: string) => {
    setState(prev => ({ ...prev, isProcessing: false, error: msg }));
  };

  const pushLog = useCallback((msg: string) => {
    setSupervisorLog(prev => [msg, ...prev].slice(0, 30));
  }, []);

  const trimWords = (text: string, max: number) => {
    const words = (text || '').split(/\s+/).filter(Boolean);
    if (words.length <= max) return words.join(' ');
    return words.slice(0, max).join(' ');
  };

  const buildWorldContext = (
    analysis?: StoryAnalysis | null,
    raw?: string,
    options?: { includeSource?: boolean; sourceWordLimit?: number }
  ) => {
    const parts: string[] = [];
    if (analysis?.theme) parts.push(`Chủ đề: ${analysis.theme}`);
    if (analysis?.characters?.length) {
      const names = analysis.characters.map((c) => c.name || c.role).filter(Boolean).slice(0, 4).join(', ');
      if (names) parts.push(`Nhân vật: ${names}`);
    }
    if (analysis?.plot_points?.length) {
      parts.push(`Cốt truyện: ${analysis.plot_points.slice(0, 3).join(' | ')}`);
    }
    const includeSource = options?.includeSource ?? true;
    const sourceWordLimit = options?.sourceWordLimit ?? 60;
    if (includeSource && raw) parts.push(`Nguồn: ${trimWords(raw, sourceWordLimit)}`);
    return parts.join('\n');
  };

  const getRevealWindow = (totalDuration: number) => {
    if (totalDuration <= 20) return { start: 6, end: 9 };
    if (totalDuration <= 35) return { start: 8, end: 12 };
    if (totalDuration <= 45) return { start: 12, end: 18 };
    return { start: 20, end: 25 };
  };

  const applyViralScoreOptimizations = (
    scenes: SceneFull[],
    score: ViralScore | undefined,
    analysis: StoryAnalysis | null,
    log?: (msg: string) => void
  ): { scenes: SceneFull[]; changed: boolean } => {
    if (!score) return { scenes, changed: false };
    let changed = false;
    const updatedScenes = scenes.map(scene => ({
      ...scene,
      storyboard: { ...scene.storyboard }
    }));

    const logChange = (message: string) => {
      log?.(`[optimizer] ${message}`);
    };

    const CTA_REGEX = /(comment|bình luận|follow|theo dõi|chia sẻ|share|lưu|save)/i;
    const hasCTA = (text: string) => CTA_REGEX.test(text || '');

    // Strengthen hook if needed
    if (score.dimensions.hookQuality < 6) {
      const hookScene = updatedScenes.find(s => s.type === 'HOOK');
      if (hookScene) {
        const hookTemplates = [
          'Họ đang che giấu bí mật gì?',
          'Bạn sẽ làm gì khi thấy cảnh này?',
          'Tại sao họ lại mạo hiểm như vậy?'
        ];
        const template = hookTemplates[hookScene.id % hookTemplates.length];
        hookScene.storyboard.on_screen_text = trimWords(template, 8);
        // Do not inject generic hook templates into the spoken TTS line.
        // Voiceover must stay grounded to the actual scene content; generic questions
        // belong on-screen only, otherwise OmniVoice may read unrelated text.
        hookScene.estimated_duration = Math.min(hookScene.estimated_duration, 2.5);
        changed = true;
        logChange('Tăng sức mạnh hook bằng câu hỏi kịch tính.');
      }
    }

    // Fix pacing/durations
    if (score.dimensions.pacing < 6) {
      updatedScenes.forEach(scene => {
        if (scene.estimated_duration > 3) {
          scene.estimated_duration = Math.max(2, Math.min(3, scene.estimated_duration));
          changed = true;
        }
      });

      const revealIdx = updatedScenes.findIndex(s => s.type === 'REVEAL');
      if (revealIdx > 0) {
        const totalDuration = updatedScenes.reduce((sum, s) => sum + s.estimated_duration, 0);
        const { end: optimalRevealEnd } = getRevealWindow(totalDuration);
        let timeBeforeReveal = 0;
        updatedScenes.forEach((scene, index) => {
          if (index < revealIdx) timeBeforeReveal += scene.estimated_duration;
        });
        if (timeBeforeReveal > optimalRevealEnd + 0.5) {
          let excess = timeBeforeReveal - optimalRevealEnd;
          const adjustable = updatedScenes.slice(0, revealIdx).map(scene => ({
            scene,
            maxReduction: Math.max(0, scene.estimated_duration - 1.6)
          }));
          const pool = adjustable.reduce((sum, item) => sum + item.maxReduction, 0);
          if (pool > 0) {
            adjustable.forEach(item => {
              if (excess <= 0) return;
              const ratio = item.maxReduction / pool;
              const reduction = Math.min(item.maxReduction, excess * ratio);
              item.scene.estimated_duration -= reduction;
              excess -= reduction;
            });
            changed = true;
            logChange('Rút ngắn thời lượng trước cảnh REVEAL để giữ pacing.');
          }
        }
      }
    }

    // Add meme/shock moment if lacking
    if (score.dimensions.memePotential < 4 || score.dimensions.shareability < 5) {
      const targetScene =
        updatedScenes.find(s => s.type === 'REVEAL') || updatedScenes[Math.floor(updatedScenes.length / 2)];
      if (targetScene) {
        const shockLine = 'Wait... chuyện gì đang xảy ra thế?!';
        targetScene.storyboard.on_screen_text = trimWords(shockLine, 8);
        if (!targetScene.voiceover_text.includes('Wait...')) {
          targetScene.voiceover_text = `${targetScene.voiceover_text} ${shockLine}`.trim();
        }
        changed = true;
        logChange('Bổ sung câu hook/shock để tăng meme/shareability.');
      }
    }

    // Ensure CTA strong ending
    if (score.dimensions.loopability < 6 || score.dimensions.shareability < 5) {
      const endingScene = updatedScenes.find(s => s.type === 'ENDING');
      if (endingScene) {
        const ctaLine = 'Comment lựa chọn của bạn và follow để xem phần 2!';
        const merged = `${endingScene.voiceover_text} ${endingScene.storyboard?.on_screen_text || ''}`;
        if (!hasCTA(merged)) {
          endingScene.voiceover_text = `${endingScene.voiceover_text} ${ctaLine}`.trim();
          changed = true;
          logChange('Tăng CTA ở cảnh ENDING để kéo share/loop.');
        }
        const onScreenWords = (endingScene.storyboard?.on_screen_text || '').split(/\s+/).filter(Boolean).length;
        if (!endingScene.storyboard.on_screen_text || onScreenWords > 8) {
          endingScene.storyboard.on_screen_text = trimWords('Comment để chọn cái kết?', 8);
          changed = true;
        }
      }
    }

    // Relatability boost by highlighting younger character if needed
    if (score.dimensions.relatability < 6 && analysis?.characters?.length) {
      const hero = updatedScenes.find(s => s.type === 'HOOK');
      if (hero) {
        const youngChar = analysis.characters.find(char =>
          /\b(thanh niên|young|explorer|teen|student)\b/i.test(`${char.name} ${char.description}`)
        );
        if (youngChar) {
          const prefix = `${youngChar.name} vừa phát hiện điều không ai tin nổi...`;
          if (!hero.voiceover_text.includes(prefix)) {
            hero.voiceover_text = `${prefix} ${hero.voiceover_text}`.trim();
            changed = true;
            logChange('Nhấn mạnh nhân vật trẻ để tăng relatability.');
          }
        }
      }
    }

    return { scenes: changed ? updatedScenes : scenes, changed };
  };

  const quotaSessionKeys = {
    image: 'comicvideoai_quota_image',
    tts: 'comicvideoai_quota_tts'
  };

  const getQuotaLimit = (value?: string) => {
    const parsed = parseInt((value || '').toString(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const storageAvailable = typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';

  const [quotaState, setQuotaState] = useState(() => {
    const env = (import.meta as any)?.env || {};
    const imageLimit = getQuotaLimit(env.VITE_IMAGE_DAILY_QUOTA || env.VITE_IMAGE_QUOTA);
    const ttsLimit = getQuotaLimit(env.VITE_TTS_DAILY_QUOTA || env.VITE_TTS_QUOTA);
    let imageUsed = 0;
    let ttsUsed = 0;
    if (storageAvailable && quotaPersistRef.current) {
      try {
        imageUsed = parseInt(sessionStorage.getItem(quotaSessionKeys.image) || '0', 10) || 0;
        ttsUsed = parseInt(sessionStorage.getItem(quotaSessionKeys.tts) || '0', 10) || 0;
      } catch {
        quotaPersistRef.current = false;
      }
    }
    return {
      imageLimit,
      ttsLimit,
      imageUsed,
      ttsUsed
    };
  });

  const recordQuotaUsage = useCallback(
    (type: 'image' | 'tts') => {
      setQuotaState(prev => {
        const key = type === 'image' ? 'imageUsed' : 'ttsUsed';
        const nextVal = prev[key] + 1;
        const updated = { ...prev, [key]: nextVal };
        const storageKey = type === 'image' ? quotaSessionKeys.image : quotaSessionKeys.tts;
        if (quotaPersistRef.current && storageAvailable) {
          try {
            sessionStorage.setItem(storageKey, nextVal.toString());
          } catch (err) {
            quotaPersistRef.current = false;
            console.warn('[quota] Persist disabled:', (err as Error)?.message);
          }
        }
        const limit = type === 'image' ? prev.imageLimit : prev.ttsLimit;
        if (limit) {
          pushLog(`[Quota] ${type === 'image' ? 'Image' : 'TTS'} remaining: ${Math.max(limit - nextVal, 0)}/${limit}`);
        } else {
          pushLog(`[Quota] ${type === 'image' ? 'Image' : 'TTS'} used: ${nextVal}`);
        }
        return updated;
      });
    },
    [pushLog, storageAvailable]
  );

  useEffect(() => {
    const llm = selectLLMProvider();
    const image = selectImageProvider();
    const tts = selectTTSProvider();
    pushLog(`[Provider] LLM: ${llm.name}${llm.modelText ? ` (${llm.modelText})` : ''}`);
    pushLog(
      image
        ? `[Provider] Image: ${image.name}${image.modelImage ? ` (${image.modelImage})` : ''}`
        : '[Provider] Image: no enabled image provider configured'
    );
    pushLog(`[Provider] TTS: ${tts.name}${tts.ttsVoice ? ` (voice ${tts.ttsVoice})` : ''}`);
  }, [pushLog]);

  const quotaLoggedRef = useRef(false);
  useEffect(() => {
    if (quotaLoggedRef.current) return;
    quotaLoggedRef.current = true;
    if (quotaState.imageLimit) {
      pushLog(`[Quota] Daily image limit: ${quotaState.imageLimit}, used: ${quotaState.imageUsed}.`);
    }
    if (quotaState.ttsLimit) {
      pushLog(`[Quota] Daily TTS limit: ${quotaState.ttsLimit}, used: ${quotaState.ttsUsed}.`);
    }
  }, [quotaState.imageLimit, quotaState.ttsLimit, quotaState.imageUsed, quotaState.ttsUsed, pushLog]);

  // Auto-enforce viral checklist before generation
  const enforceViralChecklist = (scenes: SceneFull[]) => {
    const CTA_REGEX = /(comment|bình luận|follow|theo dõi|chia sẻ|share|lưu|save)/i;

    let adjusted = 0;
    const patched = scenes.map((scene) => {
      let changed = false;

      // Cap duration to keep pacing fast
      let estimated_duration = scene.estimated_duration;
      if (estimated_duration > 3) {
        estimated_duration = 3;
        changed = true;
      }

      // Voiceover: fallback to summary, keep full text (no auto-trim to avoid cutting subs)
      let voiceover_text = scene.voiceover_text || scene.summary || '';

      // Hook/on-screen text: ensure exists and <=8 words (avoid overwriting if already compliant)
      const currentOnScreen = (scene.storyboard?.on_screen_text || '').trim();
      const currentWordCount = currentOnScreen.split(/\s+/).filter(Boolean).length;
      const sourceHook = currentOnScreen || voiceover_text || scene.summary || '';

      let on_screen_text = currentOnScreen;
      if (!on_screen_text) {
        on_screen_text = trimWords(sourceHook, 8) || 'Điều gì xảy ra tiếp?';
        changed = true;
      } else if (currentWordCount > 8) {
        on_screen_text = trimWords(on_screen_text, 8);
        changed = true;
      }

      // CTA injection for ending scenes
      const hasCTA = CTA_REGEX.test(`${voiceover_text} ${on_screen_text} `);
      if (scene.type === 'ENDING' && !hasCTA) {
        const cta = 'Bình luận ý kiến, follow và save để xem phần 2.';
        voiceover_text = `${voiceover_text} ${cta}`.trim();
        changed = true;
      }

      if (changed) adjusted += 1;

      return {
        ...scene,
        estimated_duration,
        voiceover_text,
        storyboard: {
          ...scene.storyboard,
          on_screen_text
        }
      };
    });

    if (adjusted > 0) {
      pushLog(`Checklist: tự động chỉnh ${adjusted} cảnh(pacing / hook / CTA).`);
    }

    return patched;
  };

  const supervisorCheck = (step: AppStep | 'generation', payload?: any): { ok: boolean; reason?: string } => {
    if (!supervisorEnabled) return { ok: true };
    switch (step) {
      case AppStep.ANALYSIS:
        // Accept raw input from payload or state
        const raw = payload?.rawInput ?? state.rawInput;
        if (!raw?.trim()) {
          pushLog('Supervisor: Blocked at Analysis (no input).');
          return { ok: false, reason: 'No input provided.' };
        }
        pushLog('Supervisor: Analysis check OK.');
        return { ok: true };
      case AppStep.CHARACTERS:
        if (!(payload?.normalized ?? state.normalized)) {
          pushLog('Supervisor: Blocked at Characters (missing normalized text).');
          return { ok: false, reason: 'Missing normalized text.' };
        }
        pushLog('Supervisor: Characters check OK.');
        return { ok: true };
      case AppStep.SCENES:
        if (!(payload?.analysis ?? state.analysis)) {
          pushLog('Supervisor: Blocked at Scenes (missing analysis).');
          return { ok: false, reason: 'Missing analysis data.' };
        }
        pushLog('Supervisor: Scenes check OK.');
        return { ok: true };
      case AppStep.STORYBOARD: {
        const scenes = payload?.scenes || state.scenes;
        if (!Array.isArray(scenes) || scenes.length === 0) {
          pushLog('Supervisor: Blocked at Storyboard (no scenes).');
          return { ok: false, reason: 'No scenes to storyboard.' };
        }
        pushLog(`Supervisor: Storyboard check OK(${scenes.length} scenes).`);
        return { ok: true };
      }
      case 'generation': {
        const scenes = payload?.scenes || state.scenes;
        if (!Array.isArray(scenes) || scenes.length === 0) {
          pushLog('Supervisor: Blocked at Generation (no scenes).');
          return { ok: false, reason: 'No scenes to generate.' };
        }
        if (skipTTS) {
          // If skipping TTS, ensure at least image generation target
          const hasImageTarget = scenes.some((s: SceneFull) => !s.generated_image_url || s.status === 'error');
          if (!hasImageTarget) {
            pushLog('Supervisor: Blocked at Generation (images already done, skipTTS).');
            return { ok: false, reason: 'Nothing to generate (images already done).' };
          }
        }
        pushLog(`Supervisor: Generation check OK(${scenes.length} scenes).`);
        return { ok: true };
      }
      default:
        return { ok: true };
    }
  };


  // 1. Input -> Analysis
  const handleInputSubmit = async (text: string) => {
    const safety = checkContentSafety(text);
    if (!safety.allowed) {
      const reason = safety.reason ? `${safety.reason}${safety.matched ? `: ${safety.matched}` : ''} ` : 'Nội dung không an toàn.';
      handleError(reason);
      return;
    }
    const check = supervisorCheck(AppStep.ANALYSIS, { rawInput: text });
    if (!check.ok) {
      handleError(check.reason || 'Supervisor blocked: missing input');
      return;
    }
    setState(prev => ({ ...prev, isProcessing: true, rawInput: text, error: null }));
    try {
      console.log("[DEBUG] Starting input processing with text:", text?.substring(0, 100));
      const normalized = await normalizeInput(text);
      console.log("[DEBUG] Normalization successful:", normalized);

      const analysis = await analyzeStory(normalized.clean_text);
      console.log("[DEBUG] Analysis successful:", analysis);

      setState(prev => ({
        ...prev,
        normalized,
        analysis,
        currentStep: autoRun ? AppStep.CHARACTERS : AppStep.ANALYSIS,
        isProcessing: false
      }));

      if (autoRun) {
        handleCharactersNext(analysis, normalized);
      }
    } catch (e: any) {
      console.error("[ERROR] Input processing failed:", e);
      console.error("[ERROR] Error message:", e?.message);
      console.error("[ERROR] Error stack:", e?.stack);
      handleError(`Failed to process input: ${e?.message || 'Unknown error'}. Please check console for details.`);
    }
  };

  // 2. Analysis -> Characters
  const handleAnalysisNext = () => {
    setState(prev => ({ ...prev, currentStep: AppStep.CHARACTERS, error: null }));
  };

  // 2b. Character Update Logic
  const handleUpdateCharacters = (chars: Character[]) => {
    setState(prev => ({
      ...prev,
      analysis: prev.analysis ? { ...prev.analysis, characters: chars } : null
    }));
  };

  // 3. Characters -> Breakdown Scenes
  const handleCharactersNext = async (analysisParam?: any, normalizedParam?: any) => {
    const analysisToUse = analysisParam || state.analysis;
    const normalizedToUse = normalizedParam || state.normalized;
    if (!analysisToUse || !normalizedToUse) return;
    const check = supervisorCheck(AppStep.SCENES, { analysis: analysisToUse, normalized: normalizedToUse });
    if (!check.ok) {
      handleError(check.reason || 'Supervisor blocked: scenes not ready');
      return;
    }
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    try {
      const basicScenes = await breakdownScenes(
        normalizedToUse.clean_text,
        analysisToUse,
        state.autoSceneCount ? undefined : state.desiredSceneCount,
        state.allowRewriteForViral
      );

      if (!basicScenes.length) {
        throw new Error('Scene breakdown returned no scenes. Please shorten the input or retry scene breakdown.');
      }

      const fullScenes: SceneFull[] = basicScenes.map(s => ({
        ...s,
        storyboard: {
          shot: 'Medium Shot',
          angle: 'Eye-level',
          movement: 'Static Shot',
          characters: [],
          background: '',
          lighting: '',
          action: '',
          on_screen_text: '',
          sound_effect: '',
          visual_prompt: ''
        },
        voiceover_text: '',
        status: 'pending'
      }));

      setState(prev => ({
        ...prev,
        scenes: fullScenes,
        currentStep: autoRun ? AppStep.STORYBOARD : AppStep.SCENES,
        isProcessing: false
      }));

      if (autoRun) {
        handleGenerateStoryboard(fullScenes, analysisToUse);
      }

    } catch (e: any) {
      console.error("Error generating scenes:", e);
      setState(prev => ({ ...prev, error: e.message || "Failed to breakdown scenes", isProcessing: false }));
    }
  };

  // 4. Scenes -> Storyboard
  const handleGenerateStoryboard = async (scenesParam?: SceneFull[] | SceneFull, analysisParam?: any) => {
    const scenesToUse = Array.isArray(scenesParam)
      ? scenesParam
      : scenesParam
        ? [scenesParam]
        : state.scenes;
    const check = supervisorCheck(AppStep.STORYBOARD, { scenes: scenesToUse, analysis: analysisParam || state.analysis });
    if (!check.ok) {
      handleError(check.reason || 'Supervisor blocked: storyboard not ready');
      return;
    }
    const analysisToUse = analysisParam || state.analysis;
    if (scenesToUse.length === 0 || !analysisToUse) return;
    setState(prev => ({ ...prev, isProcessing: true, error: null }));
    const worldContext = buildWorldContext(analysisToUse, state.rawInput, { includeSource: true, sourceWordLimit: 60 });

    try {
      const storyboardedScenes: SceneFull[] = [];

      for (let i = 0; i < scenesToUse.length; i++) {
        const scene = scenesToUse[i];
        const result = await generateStoryboardAndScript(scene, analysisToUse, worldContext, {
          index: i + 1,
          total: scenesToUse.length
        });
        storyboardedScenes.push({
          ...scene,
          storyboard: {
            ...scene.storyboard,
            ...result.storyboard,
            visual_prompt: result.visual_prompt || result.storyboard?.visual_prompt || scene.storyboard?.visual_prompt || ''
          },
          voiceover_text: result.voiceover_text || scene.voiceover_text || scene.summary,
          status: 'pending'
        });
      }

      let refinedScenes = storyboardedScenes;
      try {
        refinedScenes = await Promise.all(
          storyboardedScenes.map(scene => polishSceneScript(scene, analysisToUse))
        );
        pushLog('Supervisor: Script polish completed.');
      } catch (polishErr) {
        console.warn('[polish] Failed to refine scripts:', polishErr);
        pushLog('Supervisor: Script polish skipped (using raw storyboard).');
      }

      // Calculate score and auto-optimize if needed
      const initialScore = calculateViralScore(refinedScenes, analysisToUse);
      const optimization = applyViralScoreOptimizations(refinedScenes, initialScore, analysisToUse, pushLog);
      const tunedScenes = optimization.changed ? optimization.scenes : refinedScenes;
      const viralScore = optimization.changed ? calculateViralScore(tunedScenes, analysisToUse) : initialScore;
      pushLog(`Viral Score: ${viralScore.overall.toFixed(1)}/10 ${viralScore.overall >= 7 ? '🔥' : viralScore.overall >= 5 ? '⚡' : '⚠️'}`);

      setState(prev => ({
        ...prev,
        scenes: tunedScenes,
        viralScore,
        currentStep: AppStep.STORYBOARD,
        isProcessing: false
      }));
      setPreviewTab('preview');

      if (autoRun) {
        handleGeneration(tunedScenes);
      }

    } catch (e: any) {
      console.error("Error generating storyboard:", e);
      setState(prev => ({ ...prev, error: e.message || "Failed to generate storyboard", isProcessing: false }));
    }
  };

  const openStoryboardEditor = useCallback(() => {
    setStoryboardView('edit');
    setActiveTab('storyboard');
  }, []);

  const handleGenerateScriptDraft = useCallback(async () => {
    const analysisToUse = state.analysis;
    if (!analysisToUse || state.scenes.length === 0) {
      handleError('Chưa có analysis/scenes để tạo storyboard. Hãy chạy pipeline từ TikTok Mode trước.');
      return;
    }

    const hasExistingScript = state.scenes.some(
      (s) =>
        (s.voiceover_text || '').trim().length > 0 ||
        (s.storyboard?.on_screen_text || '').trim().length > 0 ||
        (s.storyboard?.action || '').trim().length > 0
    );

    if (hasExistingScript) {
      const ok = window.confirm(
        'Đã có On-screen text/Voiceover/Visual action. Tạo lại storyboard sẽ ghi đè nội dung bạn đã chỉnh.\n\nTiếp tục?'
      );
      if (!ok) return;
    }

    await handleGenerateStoryboard(state.scenes, analysisToUse);
    openStoryboardEditor();
  }, [openStoryboardEditor, state.analysis, state.scenes]);

  const handleGenerateAssetsFromTikTok = useCallback(() => {
    const missingOnScreen = state.scenes.filter((s) => !(s.storyboard?.on_screen_text || '').trim()).length;
    const missingVoiceover = state.scenes.filter((s) => !(s.voiceover_text || '').trim()).length;

    if (missingOnScreen > 0 || missingVoiceover > 0) {
      const parts: string[] = [];
      if (missingOnScreen > 0) parts.push(`${missingOnScreen} cảnh thiếu On-screen text`);
      if (missingVoiceover > 0) parts.push(`${missingVoiceover} cảnh thiếu Voiceover`);

      const ok = window.confirm(
        `${parts.join(', ')}.\n\nMở tab Storyboard để chỉnh trước khi Generate Video Assets?\n\nOK = mở Storyboard, Cancel = generate assets luôn.`
      );
      if (ok) {
        openStoryboardEditor();
        return;
      }
    }

    handleGeneration(state.scenes);
  }, [openStoryboardEditor, state.scenes]);

  const handleRequestAutoImprove = useCallback(async () => {
    if (!state.analysis || state.scenes.length === 0 || !state.viralScore) {
      handleError('Chưa có scenes/score để Auto Improve. Hãy tạo storyboard trước.');
      return;
    }
    setAutoImproveOpen(true);
    setAutoImproveError(null);
    setAutoImproveDraft(null);
    setAutoImproveLoading(true);
    try {
      const patches = await autoImproveScenesWithAI({
        scenes: state.scenes,
        analysis: state.analysis,
        score: state.viralScore,
      });
      if (!patches || patches.length === 0) {
        setAutoImproveError('AI không trả về kết quả hợp lệ. Thử lại hoặc giảm số cảnh.');
      } else {
        setAutoImproveDraft(patches);
      }
    } catch (e: any) {
      setAutoImproveError(e?.message || 'Auto Improve failed');
    } finally {
      setAutoImproveLoading(false);
    }
  }, [state.analysis, state.scenes, state.viralScore]);

  const applyAutoImproveDraft = useCallback(() => {
    if (!autoImproveDraft) return;
    const patchById = new Map(autoImproveDraft.map((p) => [p.id, p]));

    const updatedScenes = state.scenes.map((scene) => {
      const patch = patchById.get(scene.id);
      if (!patch) return scene;

      const nextVoice = patch.voiceover_text?.trim() ?? scene.voiceover_text;
      const nextOnScreen = patch.on_screen_text?.trim() ?? scene.storyboard?.on_screen_text;
      const nextAction = patch.action?.trim() ?? scene.storyboard?.action;
      const nextVisual = patch.visual_prompt?.trim() ?? scene.storyboard?.visual_prompt;
      const nextDurationRaw = Number(patch.estimated_duration);
      const nextDuration = Number.isFinite(nextDurationRaw)
        ? Math.min(3, Math.max(1.5, nextDurationRaw))
        : scene.estimated_duration;

      const voiceChanged = (scene.voiceover_text || '').trim() !== (nextVoice || '').trim();
      const visualChanged = (scene.storyboard?.visual_prompt || '').trim() !== (nextVisual || '').trim();
      const actionChanged = (scene.storyboard?.action || '').trim() !== (nextAction || '').trim();
      const onScreenChanged = (scene.storyboard?.on_screen_text || '').trim() !== (nextOnScreen || '').trim();
      const durationChanged = scene.estimated_duration !== nextDuration;
      const anyChanged = voiceChanged || visualChanged || actionChanged || onScreenChanged || durationChanged;

      if (!anyChanged) return scene;

      return {
        ...scene,
        estimated_duration: nextDuration,
        voiceover_text: nextVoice,
        generated_audio_url: voiceChanged ? undefined : scene.generated_audio_url,
        generated_audio_voiceName: voiceChanged ? undefined : scene.generated_audio_voiceName,
        generated_audio_languageCode: voiceChanged ? undefined : scene.generated_audio_languageCode,
        generated_image_url: visualChanged || actionChanged ? undefined : scene.generated_image_url,
        status: 'pending',
        storyboard: {
          ...scene.storyboard,
          on_screen_text: nextOnScreen,
          action: nextAction,
          visual_prompt: nextVisual,
        },
      };
    });

    const nextScore = state.analysis ? calculateViralScore(updatedScenes, state.analysis) : state.viralScore;

    setState((prev) => ({
      ...prev,
      scenes: updatedScenes,
      viralScore: nextScore,
      currentStep: AppStep.STORYBOARD,
    }));

    setAutoImproveOpen(false);
    setAutoImproveDraft(null);
    setAutoImproveError(null);
    openStoryboardEditor();
  }, [autoImproveDraft, openStoryboardEditor, state.analysis, state.scenes, state.viralScore]);

  const handleSceneTextUpdate = (index: number, changes: { voiceover_text?: string; on_screen_text?: string }) => {
    setState(prev => {
      if (!prev.scenes[index]) return prev;
      const updatedScenes = prev.scenes.map((scene, idx) => {
        if (idx !== index) return scene;
        return {
          ...scene,
          voiceover_text: changes.voiceover_text !== undefined ? changes.voiceover_text : scene.voiceover_text,
          // Clear stale audio when text changes to force re-generation
          generated_audio_url: changes.voiceover_text !== undefined ? undefined : scene.generated_audio_url,
          generated_audio_voiceName: changes.voiceover_text !== undefined ? undefined : scene.generated_audio_voiceName,
          generated_audio_languageCode: changes.voiceover_text !== undefined ? undefined : scene.generated_audio_languageCode,
          status: changes.voiceover_text !== undefined ? 'pending' : scene.status,
          storyboard: {
            ...scene.storyboard,
            on_screen_text:
              changes.on_screen_text !== undefined ? changes.on_screen_text : scene.storyboard?.on_screen_text,
          },
        };
      });
      return { ...prev, scenes: updatedScenes };
    });
  };

  const handleRegenerateWithPrompt = (index: number, prompt: string) => {
    const scene = state.scenes[index];
    if (!scene) return;
    const safePrompt = prompt && prompt.trim().length > 0 ? prompt.trim() : scene.summary;
    const updatedScene: SceneFull = {
      ...scene,
      storyboard: {
        ...scene.storyboard,
        visual_prompt: safePrompt || scene.storyboard?.visual_prompt || scene.summary,
      },
    };
    setState(prev => ({
      ...prev,
      scenes: prev.scenes.map((s, idx) => (idx === index ? updatedScene : s)),
    }));
    handleGeneration(updatedScene);
  };

  // Reset function
  const handleReset = () => {
    setState(INITIAL_STATE);
    setMode('choose');
    setShowManualEdit(false);
    setArtStyle(ArtStyle.COMIC_MANHUA);
    setSupervisorLog([]);
    try {
      sessionStorage.removeItem(STATE_KEY);
      sessionStorage.removeItem(quotaSessionKeys.image);
      sessionStorage.removeItem(quotaSessionKeys.tts);
    } catch (err) {
      console.warn('[STATE] Failed to clear persisted data', err);
    }
    setQuotaState(prev => ({ ...prev, imageUsed: 0, ttsUsed: 0 }));
  };

  const handleBackStep = () => {
    setState(prev => {
      if (prev.currentStep === AppStep.INPUT) return prev;
      const prevIndex = Math.max(AppStep.INPUT, prev.currentStep - 1);
      return { ...prev, currentStep: prevIndex as AppStep, isProcessing: false, error: null };
    });
    setShowManualEdit(false);
    pushLog('Supervisor: Quay lại bước trước để chỉnh sửa.');
  };

  // 5. Storyboard -> Assets Generation
  // 5. Storyboard -> Assets Generation
  const handleGeneration = async (scenesParam?: SceneFull[] | SceneFull | any) => {
    // DETERMINE TARGET SCENES
    // If scenesParam is an array, we process THOSE specific scenes (batch fix)
    // If it's a single scene, we process JUST that scene
    // If undefined, we process ALL scenes in state
    let targetScenes: SceneFull[] = [];

    if (Array.isArray(scenesParam)) {
      targetScenes = scenesParam;
    } else if (scenesParam && typeof scenesParam === 'object' && 'id' in scenesParam) {
      targetScenes = [scenesParam as SceneFull];
    } else {
      targetScenes = state.scenes;
    }

    // ENFORCE CHECKLIST (Only on targets)
    targetScenes = enforceViralChecklist(targetScenes);

    // UPDATE STATE: merge target scenes back into the main list immediately.
    // Important: when Storyboard auto-runs Generation, React state.scenes can still be stale/empty
    // even though scenesParam already contains the freshly storyboarded scenes. In that case, seed
    // generation from targetScenes instead of dropping every scene and silently skipping all images.
    const targetById = new Map(targetScenes.map(scene => [scene.id, scene]));
    const existingIds = new Set(state.scenes.map(scene => scene.id));
    const mergedScenesInit = [
      ...state.scenes.map(existing => {
        const match = targetById.get(existing.id);
        return match ? { ...existing, ...match, status: 'generating' as const } : existing;
      }),
      ...targetScenes
        .filter(scene => !existingIds.has(scene.id))
        .map(scene => ({ ...scene, status: 'generating' as const })),
    ];

    setState(prev => ({
      ...prev,
      scenes: mergedScenesInit,
      // If we are just fixing a few scenes, don't necessarily change strict step but allow flow
      isProcessing: true,
      error: null,
      currentStep: AppStep.GENERATION
    }));
    pushLog(`Supervisor: bắt đầu sinh tài sản cho ${targetScenes.length} cảnh.`);

    // SUPERVISOR CHECK
    const check = supervisorCheck('generation', { scenes: targetScenes });
    if (!check.ok) {
      handleError(check.reason || 'Supervisor blocked: generation not ready');
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    if (targetScenes.length === 0) {
      setState(prev => ({ ...prev, isProcessing: false }));
      return;
    }

    // PROCESS SCENES
    // Use a local copy of the WHOLE list to update progressively
    let currentScenesConfig = [...mergedScenesInit];
    let quotaHit = false;
    let criticalError = false; // Flag to stop batch if daily limit hit
    let lastApiSceneAt = 0;

    // We only iterate over the TARGETS for generation
    // But we update the FULL list in state
    setGenerationProgress(0);
    const globalVisualContext = buildWorldContext(state.analysis, state.rawInput, { includeSource: false });
    const forceRegenerate = !Array.isArray(scenesParam) && scenesParam && typeof scenesParam === 'object' && 'id' in scenesParam;
    const activeTtsProvider = selectTTSProvider();
    const activeTtsVoiceName = (activeTtsProvider.ttsVoice || getGeminiTtsVoice()).trim();
    const activeTtsLanguageCode = 'vi-VN';

    for (let i = 0; i < targetScenes.length; i++) {
      const scene = targetScenes[i];

      // ABORT if critical error hit previously
      if (criticalError) {
        const idx = currentScenesConfig.findIndex(s => s.id === scene.id);
        if (idx !== -1) {
          currentScenesConfig[idx] = { ...currentScenesConfig[idx], status: 'error' };
        }
        continue;
      }

      // Find current index in the main list
      const idx = currentScenesConfig.findIndex(s => s.id === scene.id);
      if (idx === -1) {
        pushLog(`Generation: bỏ qua cảnh ${scene.id} vì không tìm thấy trong danh sách hiện tại.`);
        continue;
      }

      try {
        const existing = currentScenesConfig[idx];
        let imageUrl: string | undefined = existing.generated_image_url;
        let audioUrl: string | undefined = existing.generated_audio_url;
        let nextAudioVoiceName: string | undefined = existing.generated_audio_voiceName;
        let nextAudioLanguageCode: string | undefined = existing.generated_audio_languageCode;
        const boundImagePrompt = buildBoundSceneImagePrompt(scene);
        const imagePromptKey = assetBindingKey(`${artStyle}|${globalVisualContext}|${boundImagePrompt}`);
        const ttsText = getGroundedTtsText(scene, pushLog);
        const audioTextKey = assetBindingKey(`${activeTtsVoiceName}|${activeTtsLanguageCode}|${ttsText}`);

        // Generate Image
        const shouldGenerateImage =
          forceRegenerate ||
          !existing.generated_image_url ||
          existing.generated_image_promptKey !== imagePromptKey;

        const wantsTts = !skipTTS && !criticalError;
        const audioVoiceMismatch =
          wantsTts &&
          !!existing.generated_audio_url &&
          ((existing.generated_audio_voiceName || '') !== activeTtsVoiceName ||
            (existing.generated_audio_languageCode || '') !== activeTtsLanguageCode);

        const audioTextMismatch = wantsTts && !!existing.generated_audio_url && existing.generated_audio_textKey !== audioTextKey;
        const shouldGenerateAudio = wantsTts && (forceRegenerate || !existing.generated_audio_url || audioVoiceMismatch || audioTextMismatch);

        const willCallApi = shouldGenerateImage || shouldGenerateAudio;
        if (willCallApi && lastApiSceneAt) {
          const elapsed = Date.now() - lastApiSceneAt;
          const waitMs = 3000 - elapsed;
          if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
        }

        if (shouldGenerateImage) {
          try {
            imageUrl = await generateComicImage(
              boundImagePrompt,
              generationCharacters,
              artStyle,
              globalVisualContext
            );
            recordQuotaUsage('image');
            currentScenesConfig[idx] = {
              ...currentScenesConfig[idx],
              generated_image_url: imageUrl,
              generated_image_promptKey: imagePromptKey,
              status: 'generating'
            };
            // Commit the image before TTS starts. OmniVoice on CPU can be slow, so the Storyboard
            // tab must show images progressively instead of appearing as 24/24 missing until audio finishes.
            setState(prev => ({ ...prev, scenes: [...currentScenesConfig] }));
          } catch (imgErr: any) {
            console.error(`Image generation failed for scene ${scene.id}:`, imgErr);
            // Check for critical quota error
            const msg = imgErr?.message || JSON.stringify(imgErr);
            pushLog(`Image failed scene ${scene.id}: ${String(msg).slice(0, 180)}`);
            if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('limit: 0') || msg.includes('Daily quota')) {
              criticalError = true;
              handleError(`Critical: Daily Image Quota Exceeded. Stopping batch.`);
            }
          }
        }

        // Generate Audio (if needed and no critical error yet)
        if (shouldGenerateAudio) {
          let audioGenerated = false;
          try {
            audioUrl = await generatePlayableAudio(ttsText, {
              voiceName: activeTtsVoiceName,
              languageCode: activeTtsLanguageCode,
            });
            recordQuotaUsage('tts');
            audioGenerated = true;
          } catch (audioErr: any) {
            console.error(`Audio generation failed for scene ${scene.id}:`, audioErr);
            const message = audioErr?.message || '';
            if (message.includes('Quota exceeded') || message.includes('RESOURCE_EXHAUSTED')) {
              quotaHit = true;
              // If it's just TTS quota, we might keep going with images? 
              // But usually keys share quotas. Let's be safe.
              // If specifically TTS quota, maybe just disable TTS for rest?
              // For now, let's allow images to continue unless image quota also hit.
            }
            audioUrl = existing.generated_audio_url;
          }

          if (audioGenerated) {
            nextAudioVoiceName = activeTtsVoiceName;
            nextAudioLanguageCode = activeTtsLanguageCode;
          }
        }

        if (willCallApi) lastApiSceneAt = Date.now();

        // Update the SPECIFIC scene in the main list
        const finalImageUrl = imageUrl || existing.generated_image_url;
        const finalAudioUrl = audioUrl || existing.generated_audio_url;
        currentScenesConfig[idx] = {
          ...currentScenesConfig[idx],
          generated_image_url: finalImageUrl,
          generated_audio_url: finalAudioUrl,
          generated_audio_voiceName: nextAudioVoiceName,
          generated_audio_languageCode: nextAudioLanguageCode,
          generated_image_promptKey: finalImageUrl ? imagePromptKey : currentScenesConfig[idx].generated_image_promptKey,
          generated_audio_textKey: finalAudioUrl ? audioTextKey : currentScenesConfig[idx].generated_audio_textKey,
          status: finalImageUrl ? 'done' : 'error'
        };

        // Update UI immediately per scene
        setState(prev => ({ ...prev, scenes: [...currentScenesConfig] }));
        setGenerationProgress(Math.round(((i + 1) / targetScenes.length) * 100));

      } catch (error: any) {
        console.error(`Failed to generate assets for scene ${scene.id}:`, error);
        currentScenesConfig[idx] = { ...currentScenesConfig[idx], status: 'error' };
        setState(prev => ({ ...prev, scenes: [...currentScenesConfig] }));
        setGenerationProgress(Math.round(((i + 1) / targetScenes.length) * 100));
      }
    }

    if (quotaHit) {
      setState(prev => ({ ...prev, error: "TTS quota exceeded. Some audio may be missing.", scenes: currentScenesConfig }));
    }
    if (criticalError) {
      setState(prev => ({
        ...prev,
        error: "Stopped due to API Quota limits. Please check billing or try again later.",
        scenes: currentScenesConfig,
        isProcessing: false,
        currentStep: AppStep.STORYBOARD
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      scenes: currentScenesConfig,
      isProcessing: false,
      currentStep: AppStep.PREVIEW
    }));
    setPreviewTab('preview');
    pushLog('Supervisor: Generation complete, chuyển sang Preview.');
  };


  // CHECK MODE FIRST! If user selected AI generator, show it before pipeline
  // Debug: track mode choice and input presence
  console.log('[DEBUG] AI check:', { mode, rawInput: Boolean(state.rawInput), step: state.currentStep });
  if (mode === 'ai_generator' && state.currentStep === AppStep.INPUT && !state.rawInput) {
    console.log('[RENDER] AI Generator Mode');
    return (
      <div key="ai-generator" className="min-h-screen bg-slate-900 flex flex-col">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Film className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold text-white">ComicVideoAI Studio</span>
          </div>
          <button
            onClick={() => {
              console.log('[MODE] Back to chooser');
              setMode('choose');
              setStoryGenKey((k) => k + 1); // reset generator view
            }}
            className="text-sm text-slate-400 hover:text-white"
          >
            Back
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <StoryGeneratorModule
            key={`ai-story-generator-${storyGenKey}`}
            onStoryGenerated={(story) => {
              console.log('[STORY] Done');
              setState(prev => ({ ...prev, rawInput: story }));
              setStoryGenKey((k) => k + 1); // reset generator form after use
            }}
          />
        </div>
      </div>
    );
  }

  // Mode Selection (only when no input and mode not chosen)
  console.log('[DEBUG] Mode selection check:', { currentStep: state.currentStep, hasInput: Boolean(state.rawInput), mode });
  if (state.currentStep === AppStep.INPUT && !state.rawInput && mode === 'choose') {
    console.log('[RENDER] Mode Selection');
    return (
      <div key="mode-chooser" className="min-h-screen bg-slate-900 flex flex-col">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Film className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold text-white">ComicVideoAI Studio</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <h2 className="text-3xl font-bold text-white mb-8 text-center">Choose Your Workflow</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {/* AI Story Generator */}
              <button
                onClick={() => {
                  console.log('[MODE] Button clicked: AI Generator');
                  setMode('ai_generator');
                }}
                className="bg-gradient-to-br from-purple-600 to-indigo-600 p-8 rounded-2xl border-2 border-purple-500 hover:scale-105 transition-transform text-left cursor-pointer"
              >
                <Sparkles className="w-12 h-12 text-white mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">AI Story Generator</h3>
                <p className="text-purple-100 mb-4">
                  Hollywood-quality stories with AI writer + self-critique
                </p>
                <ul className="text-sm text-purple-200 space-y-1">
                  <li>- 6-point quality check</li>
                  <li>- 3-tier intellectual depth</li>
                  <li>- Cinematic language</li>
                </ul>
              </button>

              {/* Manual Input */}
              <button
                onClick={() => {
                  console.log('[MODE] Button clicked: Manual Input');
                  setMode('manual_input');
                }}
                className="bg-slate-800 p-8 rounded-2xl border-2 border-slate-600 hover:border-slate-500 hover:scale-105 transition-all text-left cursor-pointer"
              >
                <Edit3 className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Manual Input</h3>
                <p className="text-slate-300 mb-4">
                  Paste your own story or content
                </p>
                <ul className="text-sm text-slate-400 space-y-1">
                  <li>- Full control over content</li>
                  <li>- Use existing stories</li>
                  <li>- Quick workflow</li>
                </ul>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main App (removed duplicate AI generator check)
  return (
    <div key="pipeline-app" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/50">V</div>
          <h1 className="text-xl font-bold tracking-tight text-white font-sans" title="ComicVideoAI | Viral Shorts">
            ComicVideoAI <span className="text-blue-500 font-normal opacity-70">| Viral Shorts</span>
          </h1>
        </div>
        <div className="text-sm text-slate-500 font-medium hidden sm:block">Gemini 3 Pro - Retention Engine</div>
      </header>
      {/* Navigation */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-4 py-3 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <NavigationBar active={activeTab} onSelect={(key) => setActiveTab(key as any)} />
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hidden md:inline">Mode: TikTok</span>
            <span className="px-2 py-1 rounded bg-blue-900/40 border border-blue-700 text-blue-200">Length 15/20/30/60s</span>
          </div>
        </div>
      </div>

      <main className="flex-1 flex overflow-hidden relative">
        {state.error && (
          <div className="absolute bottom-8 right-8 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-red-900/90 border border-red-500/50 text-white p-4 rounded-lg shadow-2xl backdrop-blur-sm flex items-start gap-3">
              <div className="flex-1 text-sm font-medium">{state.error}</div>
              <button
                onClick={() => setState(prev => ({ ...prev, error: null }))}
                className="text-red-200 hover:text-white transition-colors"
              >
                <span className="sr-only">Dismiss</span>
                ✕
              </button>
            </div>
          </div>
        )}
        {activeTab !== 'tiktok' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Score Tab */}
              {activeTab === 'score' && (
                <div className="space-y-6">
                  {state.viralScore ? (
                    <>
                      <div className="flex items-start gap-3 flex-wrap justify-between">
                        <div className="flex-1 min-w-[320px]">
                          <ViralScoreDisplay score={state.viralScore} />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleRequestAutoImprove}
                            disabled={state.isProcessing || !state.analysis || state.scenes.length === 0}
                            className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gọi AI để tối ưu script theo gợi ý (có preview trước khi áp dụng)"
                          >
                            Auto Improve (AI)
                          </button>
                        </div>
                      </div>
                      <PacingHeatmap
                        segments={calculatePacingHeatmap(state.scenes)}
                        scenes={state.scenes}
                      />
                    </>
                  ) : (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                      <p className="text-slate-400 mb-4">Chưa có viral score. Generate storyboard để tính toán.</p>
                      <button
                        onClick={() => setActiveTab('tiktok')}
                        className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                      >
                        Quay lại TikTok Mode
                      </button>
                    </div>
                  )}
                </div>
              )}

              {autoImproveOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h4 className="text-lg font-bold text-white">Auto Improve (AI)</h4>
                        <p className="text-xs text-slate-400">
                          AI sẽ tối ưu On-screen/Voiceover/Visual action/pacing theo gợi ý và hiển thị preview trước khi áp dụng.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setAutoImproveOpen(false);
                            setAutoImproveDraft(null);
                            setAutoImproveError(null);
                          }}
                          className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {autoImproveLoading && (
                      <div className="flex items-center gap-2 text-slate-200 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Đang gọi AI tối ưu...
                      </div>
                    )}

                    {autoImproveError && (
                      <div className="text-sm text-red-200 bg-red-500/10 border border-red-500/30 px-4 py-3 rounded-lg">
                        {autoImproveError}
                      </div>
                    )}

                    {!autoImproveLoading && autoImproveDraft && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="text-sm text-slate-300">
                            Preview thay đổi ({autoImproveDraft.length} scenes)
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleRequestAutoImprove}
                              className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600"
                            >
                              Regenerate
                            </button>
                            <button
                              onClick={applyAutoImproveDraft}
                              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 font-semibold"
                            >
                              Apply & Review in Storyboard
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {autoImproveDraft.map((p) => {
                            const before = state.scenes.find((s) => s.id === p.id);
                            if (!before) return null;
                            const beforeOn = before.storyboard?.on_screen_text || '';
                            const beforeVo = before.voiceover_text || '';
                            const beforeAct = before.storyboard?.action || '';
                            return (
                              <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-sm font-semibold text-white">Scene {p.id} • {before.type}</div>
                                  <div className="text-xs text-slate-400">
                                    {before.estimated_duration}s → {p.estimated_duration}s
                                  </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-3">
                                  <div className="text-xs text-slate-300 space-y-1">
                                    <div className="text-slate-400">Before</div>
                                    <div><span className="text-slate-400">On-screen:</span> {beforeOn}</div>
                                    <div><span className="text-slate-400">Voiceover:</span> {beforeVo}</div>
                                    <div className="line-clamp-2"><span className="text-slate-400">Action:</span> {beforeAct}</div>
                                  </div>
                                  <div className="text-xs text-slate-200 space-y-1">
                                    <div className="text-slate-400">After</div>
                                    <div><span className="text-slate-400">On-screen:</span> {p.on_screen_text}</div>
                                    <div><span className="text-slate-400">Voiceover:</span> {p.voiceover_text}</div>
                                    <div className="line-clamp-2"><span className="text-slate-400">Action:</span> {p.action}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!autoImproveLoading && !autoImproveDraft && !autoImproveError && (
                      <div className="text-sm text-slate-300">
                        Bấm <span className="font-semibold text-white">Auto Improve (AI)</span> để tạo preview tối ưu.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Presets Tab */}
              {activeTab === 'presets' && (
                <PresetSelector
                  selectedPresetId={state.selectedPresetId}
                  onSelect={(preset: PresetConfig) => {
                    setState(prev => ({
                      ...prev,
                      selectedPresetId: preset.id,
                      scenes:
                        preset.artStyle !== artStyle
                          ? prev.scenes.map((scene) => ({
                            ...scene,
                            generated_image_url: undefined,
                            status: 'pending',
                          }))
                          : prev.scenes,
                    }));
                    setArtStyle(preset.artStyle);
                    pushLog(`Preset selected: ${preset.name}`);
                  }}
                />
              )}

              {/* Storyboard Tab */}
              {activeTab === 'storyboard' && (
                <div className="space-y-4">
                  {state.scenes.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setStoryboardView('edit')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${storyboardView === 'edit' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                          >
                            Storyboard
                          </button>
                          <button
                            onClick={() => setStoryboardView('preview')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${storyboardView === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
                          >
                            Full preview
                          </button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button
                            onClick={handleGenerateScriptDraft}
                            disabled={state.isProcessing || state.scenes.length === 0 || !state.analysis}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tạo storyboard nháp (On-screen text + Voiceover) để chỉnh trước khi generate assets"
                          >
                            Tạo On-screen + Voiceover
                          </button>
                          <div className="text-xs text-slate-400">
                            Xem toàn bộ preview hoặc quay lại chỉnh sửa storyboard.
                          </div>
                        </div>
                      </div>

                      {storyboardView === 'edit' ? (
                        <StoryboardPreview
                          scenes={state.scenes}
                          onSwap={(idx1, idx2) => {
                            const newScenes = [...state.scenes];
                            [newScenes[idx1], newScenes[idx2]] = [newScenes[idx2], newScenes[idx1]];
                            setState(prev => ({ ...prev, scenes: newScenes }));
                            pushLog(`Swapped scenes #${idx1 + 1} ↔ #${idx2 + 1}`);
                          }}
                          onDelete={(idx) => {
                            const newScenes = state.scenes.filter((_, i) => i !== idx);
                            setState(prev => ({ ...prev, scenes: newScenes }));
                            pushLog(`Deleted scene #${idx + 1}`);
                          }}
                          onRegenerate={(idx) => {
                            pushLog(`Regenerating scene #${idx + 1}...`);
                            handleGeneration(state.scenes[idx]);
                          }}
                          onUpdateText={handleSceneTextUpdate}
                          onRegenerateWithPrompt={handleRegenerateWithPrompt}
                        />
                      ) : (
                        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                          <VideoPreviewModule
                            scenes={state.scenes}
                            skipTTS={skipTTS}
                            isGenerating={state.currentStep === AppStep.GENERATION}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
                      <p className="text-slate-400 mb-4">Chưa có scenes. Bắt đầu từ TikTok Mode.</p>
                      <button
                        onClick={() => setActiveTab('tiktok')}
                        className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-colors"
                      >
                        Quay lại TikTok Mode
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Settings Tab */}
              {(activeTab === 'settings' || activeTab === 'voice') && (
                <SettingsPanel
                  providers={providers}
                  onUpdateProviders={setProviders}
                  costPolicy={costPolicy}
                  onSetCostPolicy={setCostPolicy}
                  useFreeOnly={useFreeOnly}
                  onSetUseFreeOnly={setUseFreeOnly}
                />
              )}

              {/* Guide Tab */}
              {activeTab === 'guide' && <GuideTab />}

              {/* Veo / Flow Tab */}
              {activeTab === 'veo' && (
                <VeoPromptExportTab scenes={state.scenes} analysis={state.analysis} artStyle={veoArtStyle} />
              )}

              {/* Home Tab */}
              {activeTab === 'home' && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4">ComicVideoAI - TikTok Mode</h2>
                  <p className="text-slate-300 mb-6">Viral video generator với AI scoring, preset styles, và multi-provider config.</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <button
                      onClick={() => setActiveTab('tiktok')}
                      className="p-4 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white text-left hover:scale-105 transition-transform"
                    >
                      <div className="font-bold text-lg mb-2">🎬 TikTok Mode</div>
                      <div className="text-sm opacity-90">Create viral-optimized videos</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('score')}
                      className="p-4 rounded-lg bg-slate-700 text-white text-left hover:bg-slate-600  transition-colors"
                    >
                      <div className="font-bold text-lg mb-2">📊 Viral Score</div>
                      <div className="text-sm opacity-90">Analyze content virality</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('presets')}
                      className="p-4 rounded-lg bg-slate-700 text-white text-left hover:bg-slate-600 transition-colors"
                    >
                      <div className="font-bold text-lg mb-2">🎨 Presets</div>
                      <div className="text-sm opacity-90">Choose style & tone</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('storyboard')}
                      className="p-4 rounded-lg bg-slate-700 text-white text-left hover:bg-slate-600 transition-colors"
                    >
                      <div className="font-bold text-lg mb-2">🎞️ Storyboard</div>
                      <div className="text-sm opacity-90">Preview & edit scenes</div>
                    </button>
                    <button
                      onClick={() => setActiveTab('veo')}
                      className="p-4 rounded-lg bg-slate-700 text-white text-left hover:bg-slate-600 transition-colors"
                    >
                      <div className="font-bold text-lg mb-2">Veo / Flow</div>
                      <div className="text-sm opacity-90">Export prompts to animate stills</div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TikTok Mode Pipeline */}
        {activeTab === 'tiktok' && (
          <>
            {/* Controls overlay */}
            <div className="absolute top-20 right-4 z-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 flex items-center gap-3 shadow-lg shadow-slate-900/40">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRun}
                  onChange={(e) => setAutoRun(e.target.checked)}
                  className="accent-blue-500"
                />
                Auto-run
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={supervisorEnabled}
                  onChange={(e) => setSupervisorEnabled(e.target.checked)}
                  className="accent-purple-500"
                />
                Supervisor
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipTTS}
                  onChange={(e) => setSkipTTS(e.target.checked)}
                  className="accent-amber-500"
                />
                Images only (save TTS)
              </label>
              <span className="w-px h-4 bg-slate-700"></span>
              <button
                onClick={handleBackStep}
                disabled={state.currentStep === AppStep.INPUT}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${state.currentStep === AppStep.INPUT ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'}`}
              >
                ◀ Back
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1 rounded-md font-semibold bg-red-600/80 hover:bg-red-500 text-white transition-colors"
              >
                Reset
              </button>
            </div>

            {/* Supervisor Panel (desktop) */}
            <aside className="px-4 pt-4 hidden xl:block space-y-2 w-[320px] flex-shrink-0 lg:sticky lg:top-24 lg:h-[calc(100vh-140px)] lg:overflow-y-auto">
              <PipelineSupervisor state={state} supervisorEnabled={supervisorEnabled} autoRun={autoRun} />
              <ProcessTimeline state={state} />
              <ProducerPanel
                scenes={state.scenes}
                skipTTS={skipTTS}
                onFixImages={(scenesToFix) => handleGeneration(scenesToFix)}
                onFixAudio={(scenesToFix) => handleGeneration(scenesToFix)}
              />
              <ViralChecklist scenes={state.scenes} />
              <SupervisorLog logs={supervisorLog} />
            </aside>

            {/* Main Pipeline Content */}
            <div className="flex-1 overflow-y-auto">
              {state.currentStep === AppStep.INPUT && (
                <InputModule
                  rawInput={state.rawInput || ''}
                  onNext={handleInputSubmit}
                  isLoading={state.isProcessing}
                  desiredSceneCount={state.desiredSceneCount}
                  autoSceneCount={state.autoSceneCount}
                  onToggleAutoScene={(value) => setState(prev => ({ ...prev, autoSceneCount: value }))}
                  allowRewriteForViral={state.allowRewriteForViral}
                  onToggleRewrite={(value) => setState(prev => ({ ...prev, allowRewriteForViral: value }))}
                  onSceneCountChange={(count) => setState(prev => ({ ...prev, desiredSceneCount: count }))}
                />
              )}

              {state.currentStep === AppStep.ANALYSIS && state.normalized && state.analysis && (
                <AnalysisModule
                  normalized={state.normalized}
                  analysis={state.analysis}
                  onNext={handleAnalysisNext}
                />
              )}

              {state.currentStep === AppStep.CHARACTERS && state.normalized && state.analysis && (
                <CharacterSetupModule
                  analysis={state.analysis}
                  onUpdateCharacters={handleUpdateCharacters}
                  onNext={handleCharactersNext}
                />
              )}

              {(state.currentStep === AppStep.SCENES || state.currentStep === AppStep.STORYBOARD) && state.scenes.length > 0 && state.analysis && (
                <StoryboardModule
                  scenes={state.scenes}
                  onGenerate={handleGenerateAssetsFromTikTok}
                  onOpenStoryboard={openStoryboardEditor}
                  isProcessing={state.isProcessing}
                />
              )}

              {showManualEdit && state.scenes.length > 0 && (
                <div className="p-6">
                  <SceneEditor
                    scenes={state.scenes}
                    characters={generationCharacters}
                    artStyle={artStyle}
                    onSave={(updatedScenes) => {
                      setState(prev => ({ ...prev, scenes: updatedScenes }));
                      setShowManualEdit(false);
                    }}
                    onCancel={() => setShowManualEdit(false)}
                  />
                </div>
              )}

              {(state.currentStep === AppStep.GENERATION || state.currentStep === AppStep.PREVIEW) && state.scenes.length > 0 && !showManualEdit && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white">Pipeline Complete</h2>
                    <button onClick={handleReset} className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors">
                      Reset
                    </button>
                  </div>

                  {/* Mobile Supervisor Toggle */}
                  <div className="xl:hidden mb-4">
                    <button
                      onClick={() => setShowMobileSupervisor(!showMobileSupervisor)}
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white font-semibold hover:bg-slate-700 transition-colors"
                    >
                      {showMobileSupervisor ? 'Hide' : 'Show'} Pipeline Stats
                    </button>
                    {showMobileSupervisor && (
                      <div className="mt-4 space-y-2">
                        <PipelineSupervisor state={state} supervisorEnabled={supervisorEnabled} autoRun={autoRun} />
                        <ProcessTimeline state={state} />
                        <ProducerPanel
                          scenes={state.scenes}
                          skipTTS={skipTTS}
                          onFixImages={(scenesToFix) => handleGeneration(scenesToFix)}
                          onFixAudio={(scenesToFix) => handleGeneration(scenesToFix)}
                        />
                        <ViralChecklist scenes={state.scenes} />
                        <SupervisorLog logs={supervisorLog} />
                      </div>
                    )}
                  </div>

                  {/* Preview/Export Tabs */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => setPreviewTab('preview')}
                      className={`px-6 py-3 rounded-lg font-semibold transition-colors ${previewTab === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      Preview
                    </button>
                    <button
                      onClick={() => setPreviewTab('export')}
                      className={`px-6 py-3 rounded-lg font-semibold transition-colors ${previewTab === 'export' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                    >
                      Export
                    </button>
                  </div>

                  {previewTab === 'preview' && (
                    <VideoPreviewModule
                      scenes={state.scenes}
                      isGenerating={state.currentStep === AppStep.GENERATION}
                      onGenerate={() => handleGeneration(state.scenes)}
                      skipTTS={skipTTS}
                      generationProgress={generationProgress}
                    />
                  )}

                  {previewTab === 'export' && (
                    <ExportAssets scenes={state.scenes} />
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
