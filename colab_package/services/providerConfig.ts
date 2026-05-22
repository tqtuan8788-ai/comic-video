// Centralized provider configuration and selection with env-driven policies.
// Supports fallback and cost/speed/quality priorities without coupling to a single vendor.

type CostPolicy = 'quality_first' | 'cost_saver' | 'speed_first';
type ProviderName =
  | 'openai_codex'
  | 'openai_codex_image'
  | 'deepseek'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'openrouter'
  | 'anthropic'
  | 'pollinations'
  | 'sdxl_local'
  | 'tts_gemini'
  | 'tts_elevenlabs'
  | 'tts_free'
  | 'tts_omnivoice';

export interface ProviderConfig {
  id?: string;
  name: string; // or ProviderName, but keeping string for compat
  type: 'llm' | 'text' | 'image' | 'tts';
  apiKey?: string;
  baseUrl?: string;
  modelText?: string;
  modelImage?: string;
  model?: string;
  ttsVoice?: string;
  free?: boolean;
  enabled?: boolean;
  priority?: number;
  healthStatus?: 'healthy' | 'degraded' | 'down' | 'unknown';
}

interface RuntimeConfig {
  priority: ProviderName[];
  useFreeOnly: boolean;
  policy: CostPolicy;
  providers: ProviderConfig[];
}

const CODEX_OPENAI_BASE_URL_DEFAULT = 'http://127.0.0.1:10531/v1';
const CODEX_IMAGE_ENDPOINT_DEFAULT = '/api/codex-image/generate';

const readEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta !== undefined && meta !== 'undefined' && meta !== 'null') return meta;
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    const value = process.env[key] as string;
    return value === 'undefined' || value === 'null' ? '' : value;
  }
  if (typeof window !== 'undefined') {
    const winVal = (window as any)[key];
    if (winVal !== undefined && winVal !== 'undefined' && winVal !== 'null') return winVal;
  }
  return '';
};

const readFlag = (keys: string[], defaultValue = false): boolean => {
  for (const key of keys) {
    const raw = readEnv(key);
    if (!raw) continue;
    const normalized = raw.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return defaultValue;
};

const isGeminiEnabledFromEnv = (): boolean =>
  readFlag(['VITE_GEMINI_ENABLED', 'GEMINI_ENABLED', 'VITE_ENABLE_GEMINI', 'ENABLE_GEMINI'], false);

const parsePriority = (raw: string | undefined): ProviderName[] => {
  if (!raw) {
    return [
      'deepseek',
      'gemini',
      'pollinations',
      'tts_omnivoice',
      'tts_free',
      'openai_codex',
      'openai_codex_image',
      'openai',
      'groq',
      'openrouter',
      'sdxl_local',
      'tts_gemini',
      'tts_elevenlabs'
    ];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as ProviderName[];
};

const buildProviders = (): ProviderConfig[] => {
  return [
    {
      id: 'openai_codex',
      name: 'openai_codex',
      type: 'llm',
      // Talks to the local openai-oauth proxy. It must not use a real sk-* key.
      apiKey: readEnv('VITE_CODEX_OPENAI_API_KEY') || readEnv('CODEX_OPENAI_API_KEY') || 'codex-oauth-placeholder',
      baseUrl: readEnv('VITE_CODEX_OPENAI_BASE_URL') || readEnv('CODEX_OPENAI_BASE_URL') || readEnv('VITE_OPENAI_BASE_URL') || readEnv('OPENAI_BASE_URL') || CODEX_OPENAI_BASE_URL_DEFAULT,
      modelText: readEnv('VITE_CODEX_OPENAI_MODEL_TEXT') || readEnv('CODEX_OPENAI_MODEL_TEXT') || 'gpt-5.5',
      free: false
    },
    {
      id: 'openai_codex_image',
      name: 'openai_codex_image',
      type: 'image',
      // Browser calls this same-origin endpoint; Vite/Colab dev server invokes codex-image-gen via Python.
      baseUrl: readEnv('VITE_CODEX_IMAGE_GENERATE_URL') || readEnv('CODEX_IMAGE_GENERATE_URL') || CODEX_IMAGE_ENDPOINT_DEFAULT,
      modelImage: readEnv('VITE_CODEX_IMAGE_MODEL') || readEnv('CODEX_IMAGE_MODEL') || 'gpt-image-2',
      free: false
    },
    {
      id: 'deepseek',
      name: 'deepseek',
      type: 'llm',
      apiKey: readEnv('VITE_DEEPSEEK_API_KEY') || readEnv('DEEPSEEK_API_KEY'),
      baseUrl: readEnv('VITE_DEEPSEEK_BASE_URL') || readEnv('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
      modelText: readEnv('VITE_DEEPSEEK_MODEL_TEXT') || readEnv('DEEPSEEK_MODEL_TEXT') || 'deepseek-chat',
      free: false
    },
    {
      id: 'gemini',
      name: 'gemini',
      type: 'llm',
      enabled: isGeminiEnabledFromEnv(),
      apiKey: readEnv('VITE_GEMINI_API_KEY') || readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('VITE_GOOGLE_API_KEY'),
      baseUrl: readEnv('GEMINI_BASE_URL'),
      modelText: readEnv('GEMINI_MODEL_TEXT') || 'gemini-2.5-flash',
      modelImage: readEnv('GEMINI_MODEL_IMAGE') || 'gemini-3-pro-image-preview',
      free: false
    },
    {
      id: 'tts_gemini',
      name: 'tts_gemini',
      type: 'tts',
      enabled: isGeminiEnabledFromEnv(),
      apiKey: readEnv('VITE_GEMINI_API_KEY') || readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('VITE_GOOGLE_API_KEY'),
      baseUrl: readEnv('GEMINI_BASE_URL'),
      ttsVoice: readEnv('GEMINI_TTS_VOICE') || 'Fenrir',
      free: false
    },
    {
      id: 'openai',
      name: 'openai',
      type: 'llm',
      apiKey: readEnv('OPENAI_API_KEY'),
      baseUrl: readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      modelText: readEnv('OPENAI_MODEL_TEXT') || 'gpt-4o',
      modelImage: readEnv('OPENAI_MODEL_IMAGE') || 'dall-e-3',
      free: false
    },
    {
      name: 'groq',
      type: 'llm',
      apiKey: readEnv('VITE_GROQ_API_KEY') || readEnv('GROQ_API_KEY'),
      baseUrl: readEnv('VITE_GROQ_BASE_URL') || readEnv('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1',
      modelText: readEnv('VITE_GROQ_MODEL_TEXT') || readEnv('GROQ_MODEL_TEXT') || 'llama3-70b-8192',
      free: true
    },
    {
      name: 'openrouter',
      type: 'llm',
      apiKey: readEnv('OPENROUTER_API_KEY'),
      baseUrl: readEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
      modelText: readEnv('OPENROUTER_MODEL_TEXT') || 'meta-llama/llama-3-70b-instruct',
      modelImage: readEnv('OPENROUTER_MODEL_IMAGE') || 'stability-ai/sdxl',
      free: true
    },
    {
      name: 'anthropic',
      type: 'llm',
      apiKey: readEnv('ANTHROPIC_API_KEY'),
      baseUrl: readEnv('ANTHROPIC_BASE_URL'),
      modelText: readEnv('ANTHROPIC_MODEL_TEXT') || 'claude-3-5-sonnet',
      free: false
    },
    {
      name: 'pollinations',
      type: 'image',
      baseUrl: readEnv('VITE_POLLINATIONS_IMAGE_URL') || readEnv('POLLINATIONS_IMAGE_URL') || 'https://image.pollinations.ai/prompt',
      modelImage: readEnv('VITE_POLLINATIONS_MODEL_IMAGE') || readEnv('POLLINATIONS_MODEL_IMAGE') || 'flux',
      free: true
    },
    {
      name: 'sdxl_local',
      type: 'image',
      baseUrl: readEnv('SDXL_LOCAL_URL') || 'http://localhost:5000/generate',
      modelImage: 'sdxl',
      free: true
    },
    {
      name: 'tts_elevenlabs',
      type: 'tts',
      apiKey: readEnv('TTS_ELEVENLABS_KEY'),
      baseUrl: readEnv('TTS_ELEVENLABS_URL') || 'https://api.elevenlabs.io',
      ttsVoice: readEnv('TTS_ELEVENLABS_VOICE') || 'default_voice_id',
      free: false
    },
    {
      name: 'tts_free',
      type: 'tts',
      baseUrl: readEnv('TTS_FREE_URL') || '/api/edge-tts/tts',
      ttsVoice: readEnv('TTS_FREE_VOICE') || 'vi-VN-HoaiMyNeural',
      apiKey: readEnv('TTS_FREE_KEY') || undefined,
      free: true
    },
    {
      id: 'tts_omnivoice',
      name: 'tts_omnivoice',
      type: 'tts',
      baseUrl: readEnv('TTS_OMNIVOICE_URL') || '/api/omnivoice/tts',
      ttsVoice: readEnv('TTS_OMNIVOICE_VOICE') || 'default',
      apiKey: readEnv('TTS_OMNIVOICE_KEY') || undefined,
      free: true
    }
  ];
};

const runtimeConfig: RuntimeConfig = {
  priority: parsePriority(readEnv('PROVIDER_PRIORITY')),
  useFreeOnly: (readEnv('USE_FREE_ONLY') || '').toString().toLowerCase() === 'true',
  policy: (readEnv('COST_POLICY') as CostPolicy) || 'quality_first',
  providers: buildProviders()
};

const normalizeType = (type: ProviderConfig['type']): 'llm' | 'image' | 'tts' => {
  return type === 'text' ? 'llm' : type;
};

const isProviderReady = (provider: ProviderConfig, type: 'llm' | 'image' | 'tts'): boolean => {
  if (provider.enabled === false) return false;
  if (type === 'llm') {
    if ((provider.id === 'openai_codex' || provider.name === 'openai_codex') && provider.baseUrl) return true;
    return !!provider.apiKey;
  }
  if (type === 'image') {
    return !!provider.baseUrl;
  }
  if (provider.name === 'tts_elevenlabs' || provider.id === 'tts_elevenlabs') return !!provider.apiKey;
  return !!provider.baseUrl;
};

const pick = (type: 'llm' | 'image' | 'tts'): ProviderConfig | undefined => {
  const { priority, useFreeOnly, providers } = runtimeConfig;
  for (const name of priority) {
    // MATCHING LOGIC FIX: Check id OR name
    const candidate = providers.find((p) => (p.id === name || p.name === name) && normalizeType(p.type) === type && p.enabled !== false);
    if (!candidate) continue;
    if (useFreeOnly && !candidate.free) continue;
    const normalized = normalizeProvider(candidate);
    if (isProviderReady(normalized, type)) return normalized;
  }
  // Fallback by type if nothing in priority fits
  const fallback = providers
    .map(normalizeProvider)
    .find((p) => normalizeType(p.type) === type && (!useFreeOnly || p.free) && isProviderReady(p, type));
  return fallback ? normalizeProvider(fallback) : undefined;
};

export const selectLLMProvider = (): ProviderConfig => {
  const provider = pick('llm');
  if (provider) return provider;
  throw new Error('No enabled LLM provider configured. Enable OpenAI Codex OAuth, DeepSeek, or another LLM provider in Settings.');
};

export const selectImageProvider = (): ProviderConfig | undefined => {
  const provider = pick('image');
  if (provider) return provider;
  return undefined;
};

export const selectTTSProvider = (): ProviderConfig => {
  const provider = pick('tts');
  if (provider) return provider;
  return { name: 'tts_free', type: 'tts', baseUrl: '/api/edge-tts/tts', free: true };
};

export const getRuntimeConfig = (): RuntimeConfig => runtimeConfig;

export const isProviderFallbackEnabled = (): boolean => {
  const raw = (readEnv('VITE_CODEX_PROVIDER_FALLBACK') || readEnv('CODEX_PROVIDER_FALLBACK') || 'true').toLowerCase();
  return raw !== '0' && raw !== 'false' && raw !== 'off' && raw !== 'no';
};

export const getProviderById = (id: ProviderName | string): ProviderConfig | undefined => {
  const provider = runtimeConfig.providers.find((p) => p.id === id || p.name === id);
  return provider ? normalizeProvider(provider) : undefined;
};

const getEnabledProviderById = (id: ProviderName | string): ProviderConfig | undefined => {
  const provider = runtimeConfig.providers.find((p) => (p.id === id || p.name === id) && p.enabled !== false);
  return provider ? normalizeProvider(provider) : undefined;
};

export const getLLMFallbackProvider = (primary?: ProviderConfig): ProviderConfig | undefined => {
  if (!isProviderFallbackEnabled()) return undefined;
  if (primary?.id === 'deepseek' || primary?.name === 'deepseek') return undefined;
  return getEnabledProviderById('deepseek');
};

export const getImageFallbackProvider = (primary?: ProviderConfig): ProviderConfig | undefined => {
  if (!isProviderFallbackEnabled()) return undefined;
  if (primary?.id === 'pollinations' || primary?.name === 'pollinations') return undefined;
  return getEnabledProviderById('pollinations');
};

export const updateRuntimeConfig = (newProviders: ProviderConfig[]) => {
  runtimeConfig.providers = newProviders.map(normalizeProvider);
  runtimeConfig.priority = newProviders
    .filter((p) => p.enabled !== false)
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
    .map((p) => (p.id || p.name) as ProviderName);
};

const normalizeProvider = (provider: ProviderConfig): ProviderConfig => {
  const id = provider.id || provider.name;
  const name = provider.name || id;
  const normalizedId = String(id).toLowerCase();
  const normalizedName = String(name).toLowerCase();
  const type = normalizeType(provider.type);
  const modelText = provider.modelText || (type === 'llm' ? provider.model : undefined);
  const modelImage = provider.modelImage || (type === 'image' ? provider.model : undefined);

  if (normalizedId === 'openai_codex_image' || normalizedName === 'openai_codex_image' || normalizedName.includes('codex image')) {
    return {
      ...provider,
      id: 'openai_codex_image',
      name: 'openai_codex_image',
      type,
      baseUrl: provider.baseUrl || readEnv('VITE_CODEX_IMAGE_GENERATE_URL') || readEnv('CODEX_IMAGE_GENERATE_URL') || CODEX_IMAGE_ENDPOINT_DEFAULT,
      modelImage: modelImage || readEnv('VITE_CODEX_IMAGE_MODEL') || readEnv('CODEX_IMAGE_MODEL') || 'gpt-image-2',
      free: false
    };
  }

  if (normalizedId === 'openai_codex' || normalizedName === 'openai_codex' || normalizedName.includes('codex oauth')) {
    return {
      ...provider,
      id: 'openai_codex',
      name: 'openai_codex',
      type,
      apiKey: provider.apiKey || readEnv('VITE_CODEX_OPENAI_API_KEY') || readEnv('CODEX_OPENAI_API_KEY') || 'codex-oauth-placeholder',
      baseUrl: provider.baseUrl || readEnv('VITE_CODEX_OPENAI_BASE_URL') || readEnv('CODEX_OPENAI_BASE_URL') || CODEX_OPENAI_BASE_URL_DEFAULT,
      modelText: modelText || readEnv('VITE_CODEX_OPENAI_MODEL_TEXT') || readEnv('CODEX_OPENAI_MODEL_TEXT') || 'gpt-5.5',
      free: false
    };
  }

  if (id === 'deepseek' || name.toLowerCase().includes('deepseek')) {
    return {
      ...provider,
      id: 'deepseek',
      name: 'deepseek',
      type,
      apiKey: provider.apiKey || readEnv('VITE_DEEPSEEK_API_KEY') || readEnv('DEEPSEEK_API_KEY'),
      baseUrl: provider.baseUrl || readEnv('VITE_DEEPSEEK_BASE_URL') || readEnv('DEEPSEEK_BASE_URL') || 'https://api.deepseek.com',
      modelText: modelText || readEnv('VITE_DEEPSEEK_MODEL_TEXT') || readEnv('DEEPSEEK_MODEL_TEXT') || 'deepseek-chat',
      free: false
    };
  }

  if (id === 'pollinations' || name.toLowerCase().includes('pollinations')) {
    return {
      ...provider,
      id: 'pollinations',
      name: 'pollinations',
      type,
      baseUrl: provider.baseUrl || readEnv('VITE_POLLINATIONS_IMAGE_URL') || readEnv('POLLINATIONS_IMAGE_URL') || 'https://image.pollinations.ai/prompt',
      modelImage: modelImage || readEnv('VITE_POLLINATIONS_MODEL_IMAGE') || readEnv('POLLINATIONS_MODEL_IMAGE') || 'flux',
      free: true
    };
  }

  if (id === 'tts_free') {
    return {
      ...provider,
      id: 'tts_free',
      name: 'tts_free',
      type,
      baseUrl: provider.baseUrl || readEnv('VITE_TTS_FREE_URL') || readEnv('TTS_FREE_URL') || '/api/edge-tts/tts',
      ttsVoice: provider.ttsVoice || readEnv('VITE_TTS_FREE_VOICE') || readEnv('TTS_FREE_VOICE') || 'vi-VN-HoaiMyNeural',
      apiKey: provider.apiKey || readEnv('VITE_TTS_FREE_KEY') || readEnv('TTS_FREE_KEY') || undefined,
      free: true
    };
  }

  if (id === 'tts_omnivoice' || name.toLowerCase().includes('omnivoice')) {
    return {
      ...provider,
      id: 'tts_omnivoice',
      name: 'tts_omnivoice',
      type,
      baseUrl: provider.baseUrl || readEnv('VITE_TTS_OMNIVOICE_URL') || readEnv('TTS_OMNIVOICE_URL') || '/api/omnivoice/tts',
      ttsVoice: provider.ttsVoice || readEnv('VITE_TTS_OMNIVOICE_VOICE') || readEnv('TTS_OMNIVOICE_VOICE') || 'default',
      apiKey: provider.apiKey || readEnv('VITE_TTS_OMNIVOICE_KEY') || readEnv('TTS_OMNIVOICE_KEY') || undefined,
      free: true
    };
  }

  if (id === 'gemini') {
    return {
      ...provider,
      id: 'gemini',
      name: 'gemini',
      type,
      enabled: provider.enabled ?? isGeminiEnabledFromEnv(),
      apiKey: provider.apiKey || readEnv('VITE_GEMINI_API_KEY') || readEnv('GEMINI_API_KEY') || readEnv('GOOGLE_API_KEY') || readEnv('VITE_GOOGLE_API_KEY'),
      baseUrl: provider.baseUrl || readEnv('GEMINI_BASE_URL'),
      modelText: modelText || readEnv('GEMINI_MODEL_TEXT') || 'gemini-2.5-flash',
      modelImage: modelImage || readEnv('GEMINI_MODEL_IMAGE') || 'gemini-3-pro-image-preview',
      free: false
    };
  }

  if (id === 'openai') {
    return {
      ...provider,
      id: 'openai',
      name: 'openai',
      type,
      apiKey: provider.apiKey || readEnv('VITE_OPENAI_API_KEY') || readEnv('OPENAI_API_KEY'),
      baseUrl: provider.baseUrl || readEnv('VITE_OPENAI_BASE_URL') || readEnv('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
      modelText: modelText || readEnv('VITE_OPENAI_MODEL_TEXT') || readEnv('OPENAI_MODEL_TEXT') || 'gpt-4o',
      modelImage: modelImage || readEnv('VITE_OPENAI_MODEL_IMAGE') || readEnv('OPENAI_MODEL_IMAGE') || 'dall-e-3',
      free: false
    };
  }

  if (id === 'groq') {
    return {
      ...provider,
      id: 'groq',
      name: 'groq',
      type,
      apiKey: provider.apiKey || readEnv('VITE_GROQ_API_KEY') || readEnv('GROQ_API_KEY'),
      baseUrl: provider.baseUrl || readEnv('VITE_GROQ_BASE_URL') || readEnv('GROQ_BASE_URL') || 'https://api.groq.com/openai/v1',
      modelText: modelText || readEnv('VITE_GROQ_MODEL_TEXT') || readEnv('GROQ_MODEL_TEXT') || 'llama3-70b-8192',
      free: true
    };
  }

  if (id === 'openrouter') {
    return {
      ...provider,
      id: 'openrouter',
      name: 'openrouter',
      type,
      apiKey: provider.apiKey || readEnv('VITE_OPENROUTER_API_KEY') || readEnv('OPENROUTER_API_KEY'),
      baseUrl: provider.baseUrl || readEnv('VITE_OPENROUTER_BASE_URL') || readEnv('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
      modelText: modelText || readEnv('VITE_OPENROUTER_MODEL_TEXT') || readEnv('OPENROUTER_MODEL_TEXT') || 'meta-llama/llama-3-70b-instruct',
      modelImage: modelImage || readEnv('VITE_OPENROUTER_MODEL_IMAGE') || readEnv('OPENROUTER_MODEL_IMAGE') || 'stability-ai/sdxl',
      free: true
    };
  }

  if (id === 'sdxl_local' || id === 'sdxl') {
    return {
      ...provider,
      id: 'sdxl_local',
      name: 'sdxl_local',
      type,
      baseUrl: provider.baseUrl || readEnv('VITE_SDXL_LOCAL_URL') || readEnv('SDXL_LOCAL_URL') || 'http://localhost:5000/generate',
      modelImage: modelImage || 'sdxl',
      free: true
    };
  }

  if (id === 'tts_elevenlabs' || id === 'elevenlabs') {
    return {
      ...provider,
      id: 'tts_elevenlabs',
      name: 'tts_elevenlabs',
      type,
      apiKey: provider.apiKey || readEnv('VITE_TTS_ELEVENLABS_KEY') || readEnv('TTS_ELEVENLABS_KEY'),
      baseUrl: provider.baseUrl || readEnv('VITE_TTS_ELEVENLABS_URL') || readEnv('TTS_ELEVENLABS_URL') || 'https://api.elevenlabs.io',
      ttsVoice: provider.ttsVoice || readEnv('VITE_TTS_ELEVENLABS_VOICE') || readEnv('TTS_ELEVENLABS_VOICE') || 'default_voice_id',
      free: false
    };
  }

  return {
    ...provider,
    id,
    name: id === 'tts_gemini' ? 'tts_gemini' : provider.name,
    type,
    modelText,
    modelImage
  };
};
