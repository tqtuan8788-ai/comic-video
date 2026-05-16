// Centralized provider configuration and selection with env-driven policies.
// Supports fallback and cost/speed/quality priorities without coupling to a single vendor.

type CostPolicy = 'quality_first' | 'cost_saver' | 'speed_first';
type ProviderName =
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
  | 'tts_free';

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

const readEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta !== undefined) return meta;
  if (typeof process !== 'undefined' && process.env && key in process.env) {
    return process.env[key] as string;
  }
  if (typeof window !== 'undefined') {
    const winVal = (window as any)[key];
    if (winVal !== undefined) return winVal;
  }
  return '';
};

const parsePriority = (raw: string | undefined): ProviderName[] => {
  if (!raw) {
    return [
      'deepseek',
      'pollinations',
      'tts_free',
      'gemini',
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
      baseUrl: readEnv('TTS_FREE_URL') || '/api/omnivoice/tts',
      ttsVoice: readEnv('TTS_FREE_VOICE') || 'default',
      apiKey: readEnv('TTS_FREE_KEY') || undefined,
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

const pick = (type: 'llm' | 'image' | 'tts'): ProviderConfig | undefined => {
  const { priority, useFreeOnly, providers } = runtimeConfig;
  for (const name of priority) {
    // MATCHING LOGIC FIX: Check id OR name
    const candidate = providers.find((p) => (p.id === name || p.name === name) && normalizeType(p.type) === type && p.enabled !== false);
    if (!candidate) continue;
    if (type === 'tts' && candidate.name === 'tts_elevenlabs' && !candidate.apiKey) continue;
    if (type === 'tts' && candidate.name === 'tts_free' && !candidate.baseUrl) continue;
    if (type === 'llm' && !candidate.apiKey) continue;
    if (useFreeOnly && !candidate.free) continue;
    if (candidate.apiKey || candidate.baseUrl) return normalizeProvider(candidate);
  }
  // Fallback by type if nothing in priority fits
  const fallback = providers.find((p) => normalizeType(p.type) === type && p.enabled !== false && (!useFreeOnly || p.free));
  return fallback ? normalizeProvider(fallback) : undefined;
};

export const selectLLMProvider = (): ProviderConfig => {
  const provider = pick('llm');
  if (provider) return provider;
  // Hard fallback to gemini placeholder to avoid crashes
  return { name: 'gemini', type: 'llm', modelText: 'gemini-2.5-flash' };
};

export const selectImageProvider = (): ProviderConfig => {
  const provider = pick('image');
  if (provider) return provider;
  return { name: 'gemini', type: 'image', modelImage: 'gemini-3-pro-image-preview' };
};

export const selectTTSProvider = (): ProviderConfig => {
  const provider = pick('tts');
  if (provider) return provider;
  return { name: 'tts_free', type: 'tts', baseUrl: '/api/omnivoice/tts', free: true };
};

export const getRuntimeConfig = (): RuntimeConfig => runtimeConfig;

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
  const type = normalizeType(provider.type);
  const modelText = provider.modelText || (type === 'llm' ? provider.model : undefined);
  const modelImage = provider.modelImage || (type === 'image' ? provider.model : undefined);

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
      baseUrl: provider.baseUrl || readEnv('VITE_TTS_FREE_URL') || readEnv('TTS_FREE_URL') || '/api/omnivoice/tts',
      ttsVoice: provider.ttsVoice || readEnv('VITE_TTS_FREE_VOICE') || readEnv('TTS_FREE_VOICE') || 'default',
      apiKey: provider.apiKey || readEnv('VITE_TTS_FREE_KEY') || readEnv('TTS_FREE_KEY') || undefined,
      free: true
    };
  }

  if (id === 'gemini') {
    return {
      ...provider,
      id: 'gemini',
      name: 'gemini',
      type,
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
