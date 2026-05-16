import { ProviderConfig } from './providerConfig';

export type OmniVoiceEmotion = 'neutral' | 'dramatic' | 'warm' | 'suspense' | 'urgent' | 'sad';

export interface OmniVoiceSettings {
  endpointUrl: string;
  healthUrl: string;
  voicesUrl: string;
  cloneUrl: string;
  voiceProfileId: string;
  languageCode: string;
  emotion: OmniVoiceEmotion;
  speed: number;
  pitch: number;
  maxCharsPerRequest: number;
  maxWordsPerRequest: number;
  pauseMs: number;
  trimSilence: boolean;
  normalizeVolume: boolean;
  cacheEnabled: boolean;
  format: 'mp3' | 'wav';
  sampleRate: number;
}

export interface OmniVoiceHealth {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface OmniVoiceOption {
  id: string;
  name: string;
  language?: string;
  cloned?: boolean;
}

export interface OmniVoiceReferenceSample {
  name: string;
  mimeType: string;
  size: number;
  dataUri: string;
  base64: string;
}

export interface OmniVoiceCloneResult {
  ok: boolean;
  voiceProfileId?: string;
  message: string;
}

export const OMNIVOICE_SETTINGS_KEY = 'comicvideoai_omnivoice_settings_v1';

export const DEFAULT_OMNIVOICE_SETTINGS: OmniVoiceSettings = {
  endpointUrl: '/api/omnivoice/tts',
  healthUrl: '/api/omnivoice/health',
  voicesUrl: '/api/omnivoice/voices',
  cloneUrl: '/api/omnivoice/clone',
  voiceProfileId: 'default',
  languageCode: 'vi-VN',
  emotion: 'dramatic',
  speed: 1.0,
  pitch: 0,
  maxCharsPerRequest: 160,
  maxWordsPerRequest: 24,
  pauseMs: 160,
  trimSilence: true,
  normalizeVolume: true,
  cacheEnabled: true,
  format: 'mp3',
  sampleRate: 24000
};

const memoryAudioCache = new Map<string, string>();
let referenceSample: OmniVoiceReferenceSample | null = null;

const safeLocalStorageGet = (key: string): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeLocalStorageSet = (key: string, value: string): void => {
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  } catch {
    // ignore storage quota/privacy errors
  }
};

export const getOmniVoiceSettings = (): OmniVoiceSettings => {
  const raw = safeLocalStorageGet(OMNIVOICE_SETTINGS_KEY);
  if (!raw) return DEFAULT_OMNIVOICE_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
    const merged = {
      ...DEFAULT_OMNIVOICE_SETTINGS,
      ...parsed,
      speed: clampNumber(parsed.speed, 0.65, 1.45, DEFAULT_OMNIVOICE_SETTINGS.speed),
      pitch: clampNumber(parsed.pitch, -12, 12, DEFAULT_OMNIVOICE_SETTINGS.pitch),
      maxCharsPerRequest: Math.round(clampNumber(parsed.maxCharsPerRequest, 60, 260, DEFAULT_OMNIVOICE_SETTINGS.maxCharsPerRequest)),
      maxWordsPerRequest: Math.round(clampNumber(parsed.maxWordsPerRequest, 8, 36, DEFAULT_OMNIVOICE_SETTINGS.maxWordsPerRequest)),
      pauseMs: Math.round(clampNumber(parsed.pauseMs, 0, 600, DEFAULT_OMNIVOICE_SETTINGS.pauseMs)),
      sampleRate: Math.round(clampNumber(parsed.sampleRate, 16000, 48000, DEFAULT_OMNIVOICE_SETTINGS.sampleRate))
    };
    return normalizeLegacyLocalhostDefaults(merged);
  } catch {
    return DEFAULT_OMNIVOICE_SETTINGS;
  }
};

export const setOmniVoiceSettings = (settings: OmniVoiceSettings): void => {
  safeLocalStorageSet(OMNIVOICE_SETTINGS_KEY, JSON.stringify(settings));
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const normalizeLegacyLocalhostDefaults = (settings: OmniVoiceSettings): OmniVoiceSettings => {
  const normalize = (url: string, legacyPath: string, proxyPath: string): string => {
    const value = String(url || '').trim();
    if (!value) return proxyPath;
    try {
      const parsed = new URL(value);
      const isLegacyDefaultHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname) && parsed.port === '7861';
      if (isLegacyDefaultHost && parsed.pathname === legacyPath) return proxyPath;
    } catch {
      // Relative URLs are already safe for the Vite proxy.
    }
    return value;
  };

  return {
    ...settings,
    endpointUrl: normalize(settings.endpointUrl, '/tts', DEFAULT_OMNIVOICE_SETTINGS.endpointUrl),
    healthUrl: normalize(settings.healthUrl, '/health', DEFAULT_OMNIVOICE_SETTINGS.healthUrl),
    voicesUrl: normalize(settings.voicesUrl, '/voices', DEFAULT_OMNIVOICE_SETTINGS.voicesUrl),
    cloneUrl: normalize(settings.cloneUrl, '/clone', DEFAULT_OMNIVOICE_SETTINGS.cloneUrl)
  };
};

export const setOmniVoiceReferenceSample = (sample: OmniVoiceReferenceSample | null): void => {
  referenceSample = sample;
};

export const getOmniVoiceReferenceSample = (): OmniVoiceReferenceSample | null => referenceSample;

export const fileToOmniVoiceReferenceSample = (file: File): Promise<OmniVoiceReferenceSample> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được file audio mẫu.'));
    reader.onload = () => {
      const dataUri = String(reader.result || '');
      const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
      if (!base64) {
        reject(new Error('File audio mẫu không hợp lệ.'));
        return;
      }
      resolve({
        name: file.name,
        mimeType: file.type || 'audio/wav',
        size: file.size,
        dataUri,
        base64
      });
    };
    reader.readAsDataURL(file);
  });
};

const fetchErrorMessage = (error: any, target: string, action: string): string => {
  const raw = error?.message || String(error || 'Unknown error');
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(raw)) {
    return `${action} không kết nối được (${target}). Nếu đang chạy bằng npm run dev, hãy dùng URL /api/omnivoice/* hoặc chạy OmniVoice backend ở http://localhost:7861. Nếu gọi thẳng host ngoài, backend cần bật CORS.`;
  }
  return raw;
};

const readEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta) return meta;
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key] as string;
  return '';
};

const resolveFetchUrl = (url: string): string => {
  const value = String(url || '').trim();
  if (!value.startsWith('/')) return value;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${value}`;
  }

  if (value.startsWith('/api/omnivoice')) {
    const target = (readEnv('VITE_OMNIVOICE_PROXY_TARGET') || readEnv('OMNIVOICE_PROXY_TARGET') || 'http://127.0.0.1:7861').replace(/\/$/, '');
    return `${target}${value.replace(/^\/api\/omnivoice/, '')}`;
  }

  return value;
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText;
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
};

export const normalizeTtsText = (text: string): string => {
  return (text || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[*_`#>[\]{}]/g, '')
    .replace(/\s*\/\s*/g, ' hoặc ')
    .replace(/%/g, ' phần trăm')
    .replace(/\$/g, ' đô la ')
    .replace(/\bAI\b/g, 'trí tuệ nhân tạo')
    .replace(/\bCEO\b/g, 'giám đốc điều hành')
    .replace(/\bTikTok\b/gi, 'Tích Tốc')
    .replace(/\b(\d{4})\b/g, (_m, year) => yearToVietnamese(year))
    .replace(/\b(\d+)\b/g, (_m, num) => numberToVietnamese(Number(num)))
    .replace(/[;:]+/g, ',')
    .replace(/\s*([,.!?…])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();
};

const digitWords = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

const numberToVietnamese = (num: number): string => {
  if (!Number.isFinite(num)) return '';
  if (num >= 0 && num <= 10) {
    return ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'][num];
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    if (ones === 0) return `${digitWords[tens]} mươi`;
    if (ones === 1) return `${digitWords[tens]} mươi mốt`;
    if (ones === 5) return `${digitWords[tens]} mươi lăm`;
    return `${digitWords[tens]} mươi ${digitWords[ones]}`;
  }
  return String(num).split('').map((d) => digitWords[Number(d)] || d).join(' ');
};

const yearToVietnamese = (year: string): string => {
  if (year.startsWith('20')) {
    const last = Number(year.slice(2));
    return `hai nghìn không trăm ${numberToVietnamese(last)}`.replace('không trăm không', 'không trăm');
  }
  return year.split('').map((d) => digitWords[Number(d)] || d).join(' ');
};

export const splitTtsText = (text: string, settings: OmniVoiceSettings = getOmniVoiceSettings()): string[] => {
  const normalized = normalizeTtsText(text);
  if (!normalized) return [];

  const hardLimit = settings.maxCharsPerRequest;
  const wordLimit = settings.maxWordsPerRequest;
  const sentenceParts = normalized
    .split(/(?<=[.!?…])\s+/)
    .flatMap((part) => part.split(/\s*[—–]\s*/))
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentenceParts.length ? sentenceParts : [normalized]) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (sentence.length <= hardLimit && words.length <= wordLimit) {
      chunks.push(sentence);
      continue;
    }

    let current: string[] = [];
    for (const word of words) {
      const candidate = [...current, word];
      if (candidate.join(' ').length > hardLimit || candidate.length > wordLimit) {
        if (current.length) chunks.push(current.join(' '));
        current = [word];
      } else {
        current = candidate;
      }
    }
    if (current.length) chunks.push(current.join(' '));
  }

  return chunks.map((chunk) => chunk.replace(/\s+/g, ' ').trim()).filter(Boolean);
};

const cacheKey = (settings: OmniVoiceSettings, text: string): string => {
  return [
    'omnivoice',
    settings.endpointUrl,
    settings.voiceProfileId,
    settings.languageCode,
    settings.emotion,
    settings.speed,
    settings.pitch,
    settings.format,
    normalizeTtsText(text)
  ].join('|');
};

export const checkOmniVoiceHealth = async (settings: OmniVoiceSettings = getOmniVoiceSettings()): Promise<OmniVoiceHealth> => {
  const start = performance.now();
  const healthUrl = resolveFetchUrl(settings.healthUrl);
  try {
    const response = await fetch(healthUrl, { method: 'GET' });
    const latencyMs = Math.round(performance.now() - start);
    if (!response.ok) {
      const errorText = await readErrorText(response);
      return { ok: false, message: `HTTP ${response.status}: ${errorText}`, latencyMs };
    }
    return { ok: true, message: 'Connected', latencyMs };
  } catch (error: any) {
    return { ok: false, message: fetchErrorMessage(error, healthUrl, 'Health check OmniVoice') };
  }
};

export const fetchOmniVoiceOptions = async (settings: OmniVoiceSettings = getOmniVoiceSettings()): Promise<OmniVoiceOption[]> => {
  let response: Response;
  const voicesUrl = resolveFetchUrl(settings.voicesUrl);
  try {
    response = await fetch(voicesUrl, { method: 'GET' });
  } catch (error: any) {
    throw new Error(fetchErrorMessage(error, voicesUrl, 'Tải danh sách voice'));
  }
  if (!response.ok) throw new Error(`Voice list error ${response.status}: ${await readErrorText(response)}`);
  const data = await response.json();
  const rawVoices = Array.isArray(data) ? data : (data.voices || data.data || []);
  return rawVoices
    .map((voice: any) => ({
      id: String(voice.id || voice.voice || voice.name || '').trim(),
      name: String(voice.name || voice.label || voice.id || voice.voice || '').trim(),
      language: voice.language || voice.languageCode,
      cloned: Boolean(voice.cloned || voice.is_clone || voice.type === 'clone')
    }))
    .filter((voice: OmniVoiceOption) => voice.id);
};

export const uploadOmniVoiceReferenceSample = async (
  sample: OmniVoiceReferenceSample,
  settings: OmniVoiceSettings = getOmniVoiceSettings()
): Promise<OmniVoiceCloneResult> => {
  if (!sample?.base64) throw new Error('Chưa chọn audio mẫu để clone voice.');

  const form = new FormData();
  const audioBlob = dataUriToBlob(sample.dataUri, sample.mimeType);
  const profileName = settings.voiceProfileId && settings.voiceProfileId !== 'default'
    ? settings.voiceProfileId
    : sample.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48) || 'comic_voice_clone';

  form.append('audio', audioBlob, sample.name);
  form.append('sample', audioBlob, sample.name);
  form.append('voice_name', profileName);
  form.append('profile_name', profileName);
  form.append('language', settings.languageCode);
  form.append('languageCode', settings.languageCode);

  let response: Response;
  const cloneUrl = resolveFetchUrl(settings.cloneUrl);
  try {
    response = await fetch(cloneUrl, { method: 'POST', body: form });
  } catch (error: any) {
    throw new Error(fetchErrorMessage(error, cloneUrl, 'Upload audio mẫu'));
  }

  if (!response.ok) {
    throw new Error(`Voice clone upload error ${response.status}: ${await readErrorText(response)}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    const id = String(data.id || data.voiceId || data.voice_id || data.voiceProfileId || data.profile_id || data.name || profileName).trim();
    return { ok: true, voiceProfileId: id, message: data.message || `Đã tạo voice profile ${id}` };
  }

  return { ok: true, voiceProfileId: profileName, message: `Đã upload audio mẫu cho profile ${profileName}` };
};

const fetchChunkAudio = async (
  text: string,
  provider: ProviderConfig,
  settings: OmniVoiceSettings,
  attempt: number
): Promise<string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;

  const endpoint = resolveFetchUrl((settings.endpointUrl || provider.baseUrl || '').trim());
  if (!endpoint) throw new Error('OmniVoice endpoint missing');

  const sample = getOmniVoiceReferenceSample();
  const payload: Record<string, any> = {
    text,
    voice: settings.voiceProfileId || provider.ttsVoice || 'default',
    voiceProfileId: settings.voiceProfileId || provider.ttsVoice || 'default',
    language: settings.languageCode,
    languageCode: settings.languageCode,
    speed: attempt >= 2 ? Math.min(1.18, settings.speed + 0.06) : settings.speed,
    pitch: settings.pitch,
    emotion: attempt >= 3 ? 'neutral' : settings.emotion,
    style: attempt >= 3 ? 'neutral' : settings.emotion,
    format: settings.format,
    sample_rate: settings.sampleRate,
    sampleRate: settings.sampleRate,
    trimSilence: settings.trimSilence,
    normalizeVolume: settings.normalizeVolume
  };

  if (sample) {
    payload.referenceAudioBase64 = sample.base64;
    payload.reference_audio = sample.base64;
    payload.referenceAudioMimeType = sample.mimeType;
    payload.referenceAudioName = sample.name;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error: any) {
    throw new Error(fetchErrorMessage(error, endpoint, 'TTS OmniVoice'));
  }

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(`OmniVoice error ${response.status}: ${errorText || response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    const audio = data.audio || data.base64 || data.data || data.audioBase64;
    const mimeType = data.mimeType || data.mime_type || (settings.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    if (audio) {
      return String(audio).startsWith('data:')
        ? String(audio)
        : `data:${mimeType};base64,${audio}`;
    }
    if (data.url) {
      const audioResponse = await fetch(data.url);
      if (!audioResponse.ok) throw new Error(`OmniVoice audio URL error ${audioResponse.status}`);
      const buffer = await audioResponse.arrayBuffer();
      return `data:${audioResponse.headers.get('content-type') || mimeType};base64,${arrayBufferToBase64(buffer)}`;
    }
    throw new Error('OmniVoice returned JSON without audio/base64/url');
  }

  const buffer = await response.arrayBuffer();
  const mimeType = contentType.startsWith('audio/') ? contentType : (settings.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
  return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
};

export const generateOmniVoiceAudio = async (
  rawText: string,
  provider: ProviderConfig,
  override?: Partial<OmniVoiceSettings>
): Promise<string> => {
  const settings = { ...getOmniVoiceSettings(), ...override };
  const chunks = splitTtsText(rawText, settings);
  if (!chunks.length) throw new Error('No text to synthesize');

  const audios: string[] = [];
  for (const chunk of chunks) {
    const key = cacheKey(settings, chunk);
    if (settings.cacheEnabled && memoryAudioCache.has(key)) {
      audios.push(memoryAudioCache.get(key)!);
      continue;
    }

    let lastError: unknown;
    const attempts = [
      chunk,
      shortenChunk(chunk, Math.max(70, Math.floor(settings.maxCharsPerRequest * 0.75))),
      stripExpressivePunctuation(shortenChunk(chunk, Math.max(60, Math.floor(settings.maxCharsPerRequest * 0.6))))
    ];

    for (let attempt = 0; attempt < attempts.length; attempt++) {
      try {
        const audio = await fetchChunkAudio(attempts[attempt], provider, settings, attempt + 1);
        if (settings.cacheEnabled) memoryAudioCache.set(key, audio);
        audios.push(audio);
        lastError = undefined;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) throw lastError;
  }

  if (audios.length === 1) return audios[0];
  return concatenateAudioDataUris(audios, settings.pauseMs, settings.sampleRate);
};

const shortenChunk = (text: string, maxChars: number): string => {
  if (text.length <= maxChars) return text;
  const words = text.split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    const candidate = [...kept, word].join(' ');
    if (candidate.length > maxChars) break;
    kept.push(word);
  }
  return kept.join(' ').replace(/[,.!?…]+$/, '').trim() || text.slice(0, maxChars).trim();
};

const stripExpressivePunctuation = (text: string): string => {
  return text.replace(/…/g, '.').replace(/[!?]+/g, '.').replace(/\s+/g, ' ').trim();
};

const dataUriToBlob = (dataUri: string, fallbackMimeType: string): Blob => {
  const [header, base64 = ''] = dataUri.split(',');
  const mimeType = header.match(/data:([^;]+)/)?.[1] || fallbackMimeType || 'audio/wav';
  const binary = atob(base64 || dataUri);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
};

const dataUriToArrayBuffer = (dataUri: string): ArrayBuffer => {
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const concatenateAudioDataUris = async (uris: string[], pauseMs: number, sampleRate: number): Promise<string> => {
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx || typeof OfflineAudioContext === 'undefined') {
    // MP3 byte concatenation is not guaranteed, but works in some browsers and
    // is still better than crashing if WebAudio is unavailable.
    return uris[0];
  }

  const ctx = new AudioCtx();
  const decoded = await Promise.all(
    uris.map(async (uri) => {
      const buffer = dataUriToArrayBuffer(uri);
      return await ctx.decodeAudioData(buffer.slice(0));
    })
  );
  await ctx.close?.();

  const channels = Math.max(...decoded.map((buffer) => buffer.numberOfChannels), 1);
  const targetRate = sampleRate || decoded[0].sampleRate || 24000;
  const pauseFrames = Math.round((pauseMs / 1000) * targetRate);
  const totalFrames = decoded.reduce((sum, buffer) => sum + Math.ceil(buffer.duration * targetRate), 0) + pauseFrames * (decoded.length - 1);
  const offline = new OfflineAudioContext(channels, totalFrames, targetRate);

  let offset = 0;
  for (const buffer of decoded) {
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(offset / targetRate);
    offset += Math.ceil(buffer.duration * targetRate) + pauseFrames;
  }

  const rendered = await offline.startRendering();
  return audioBufferToWavDataUri(rendered);
};

const audioBufferToWavDataUri = (audioBuffer: AudioBuffer): string => {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length * numChannels * 2;
  const buffer = new ArrayBuffer(44 + length);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return `data:audio/wav;base64,${arrayBufferToBase64(buffer)}`;
};

const writeAscii = (view: DataView, offset: number, value: string): void => {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};
