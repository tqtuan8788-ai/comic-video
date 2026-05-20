import { ProviderConfig } from './providerConfig';
import { normalizeTtsText } from './omniVoice';

export interface EdgeTtsSettings {
  endpointUrl: string;
  healthUrl: string;
  voicesUrl: string;
  voice: string;
  speed: number;
  responseFormat: 'mp3';
  model: 'tts-1' | 'tts-1-hd';
  cacheEnabled: boolean;
}

export interface EdgeTtsHealth {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

export interface EdgeTtsVoiceOption {
  id: string;
  name: string;
  locale?: string;
  gender?: string;
}

const EDGE_TTS_FRIENDLY_NAMES: Record<string, string> = {
  'vi-VN-HoaiMyNeural': 'Hoai My',
  'vi-VN-NamMinhNeural': 'Nam Minh',
};

export const EDGE_TTS_RECOMMENDED_VOICES: EdgeTtsVoiceOption[] = [
  { id: 'vi-VN-HoaiMyNeural', name: 'Hoai My', locale: 'vi-VN', gender: 'Female' },
  { id: 'vi-VN-NamMinhNeural', name: 'Nam Minh', locale: 'vi-VN', gender: 'Male' },
];

const EDGE_TTS_SETTINGS_KEY = 'comicvideoai_edge_tts_settings_v1';

export const DEFAULT_EDGE_TTS_SETTINGS: EdgeTtsSettings = {
  endpointUrl: '/api/edge-tts/tts',
  healthUrl: '/api/edge-tts/health',
  voicesUrl: '/api/edge-tts/voices',
  voice: 'vi-VN-HoaiMyNeural',
  speed: 1,
  responseFormat: 'mp3',
  model: 'tts-1',
  cacheEnabled: true
};

const memoryAudioCache = new Map<string, string>();

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
    // ignore privacy/quota errors
  }
};

const readEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta !== undefined && meta !== 'undefined' && meta !== 'null') return meta;
  if (typeof process !== 'undefined' && process.env?.[key]) {
    const value = process.env[key] as string;
    return value === 'undefined' || value === 'null' ? '' : value;
  }
  return '';
};

const resolveFetchUrl = (url: string): string => {
  const value = String(url || '').trim();
  if (!value.startsWith('/')) return value;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${value}`;
  }
  if (value.startsWith('/api/edge-tts')) {
    const target = (readEnv('VITE_EDGE_TTS_PROXY_TARGET') || readEnv('EDGE_TTS_PROXY_TARGET') || 'http://127.0.0.1:5050').replace(/\/$/, '');
    return `${target}${value.replace(/^\/api\/edge-tts/, '')}`;
  }
  return value;
};

const readErrorText = async (response: Response): Promise<string> => {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText;
  return text.length > 240 ? `${text.slice(0, 240)}...` : text;
};

const fetchErrorMessage = (error: any, target: string, action: string): string => {
  const raw = error?.message || String(error || 'Unknown error');
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(raw)) {
    return `${action} khong ket noi duoc (${target}). Hay kiem tra edge-tts backend tai port 5050 hoac Vite proxy /api/edge-tts.`;
  }
  return raw;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const formatEdgeVoiceName = (id: string, rawName: string): string => {
  if (EDGE_TTS_FRIENDLY_NAMES[id]) return EDGE_TTS_FRIENDLY_NAMES[id];

  const cleaned = rawName
    .replace(/^Microsoft\s+/i, '')
    .replace(/\s+Online\s+\(Natural\)\s*-\s*.*$/i, '')
    .trim();
  const fallback = cleaned || id.match(/^[a-z]{2}-[A-Z]{2}-([A-Za-z]+)Neural$/)?.[1] || id;
  return fallback.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
};

export const getEdgeTtsSettings = (): EdgeTtsSettings => {
  const raw = safeLocalStorageGet(EDGE_TTS_SETTINGS_KEY);
  if (!raw) return DEFAULT_EDGE_TTS_SETTINGS;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_EDGE_TTS_SETTINGS,
      ...parsed,
      speed: clampNumber(parsed.speed, 0.5, 2, DEFAULT_EDGE_TTS_SETTINGS.speed)
    };
  } catch {
    return DEFAULT_EDGE_TTS_SETTINGS;
  }
};

export const setEdgeTtsSettings = (settings: EdgeTtsSettings): void => {
  safeLocalStorageSet(EDGE_TTS_SETTINGS_KEY, JSON.stringify(settings));
};

export const checkEdgeTtsHealth = async (settings: EdgeTtsSettings = getEdgeTtsSettings()): Promise<EdgeTtsHealth> => {
  const start = performance.now();
  const healthUrl = resolveFetchUrl(settings.healthUrl);
  try {
    const response = await fetch(healthUrl, { method: 'GET' });
    const latencyMs = Math.round(performance.now() - start);
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}: ${await readErrorText(response)}`, latencyMs };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true, message: data.message || 'Connected', latencyMs };
  } catch (error: any) {
    return { ok: false, message: fetchErrorMessage(error, healthUrl, 'Health check Edge TTS') };
  }
};

export const fetchEdgeTtsVoices = async (settings: EdgeTtsSettings = getEdgeTtsSettings()): Promise<EdgeTtsVoiceOption[]> => {
  const endpoint = resolveFetchUrl(settings.voicesUrl);
  try {
    const response = await fetch(endpoint, { method: 'GET' });
    if (!response.ok) throw new Error(`Voice list error ${response.status}: ${await readErrorText(response)}`);
    const data = await response.json();
    const rawVoices = Array.isArray(data) ? data : (data.voices || data.data || []);
    return rawVoices
      .map((voice: any) => {
        const id = String(voice.id || voice.name || voice.voice || '').trim();
        const rawName = String(voice.name || voice.shortName || voice.id || '').trim();
        return {
          id,
          name: formatEdgeVoiceName(id, rawName),
          locale: voice.locale || voice.language,
          gender: voice.gender
        };
      })
      .filter((voice: EdgeTtsVoiceOption) => voice.id);
  } catch (error: any) {
    throw new Error(fetchErrorMessage(error, endpoint, 'Tai danh sach Edge TTS voice'));
  }
};

const cacheKey = (settings: EdgeTtsSettings, text: string): string => [
  'edge-tts',
  settings.endpointUrl,
  settings.voice,
  settings.speed,
  settings.responseFormat,
  normalizeTtsText(text)
].join('|');

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

export const generateEdgeTtsAudio = async (
  rawText: string,
  provider: ProviderConfig,
  override?: Partial<EdgeTtsSettings>
): Promise<string> => {
  const settings = { ...getEdgeTtsSettings(), ...override };
  const endpoint = resolveFetchUrl((settings.endpointUrl || provider.baseUrl || '').trim());
  if (!endpoint) throw new Error('Edge TTS endpoint missing');

  const text = normalizeTtsText(rawText);
  if (!text) throw new Error('No text to synthesize');

  const key = cacheKey(settings, text);
  if (settings.cacheEnabled && memoryAudioCache.has(key)) {
    return memoryAudioCache.get(key)!;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: text,
        text,
        model: settings.model,
        voice: settings.voice || provider.ttsVoice || 'vi-VN-HoaiMyNeural',
        response_format: settings.responseFormat,
        format: settings.responseFormat,
        speed: settings.speed
      })
    });
  } catch (error: any) {
    throw new Error(fetchErrorMessage(error, endpoint, 'TTS Edge'));
  }

  if (!response.ok) {
    throw new Error(`Edge TTS error ${response.status}: ${await readErrorText(response)}`);
  }

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    const audio = data.audio || data.base64 || data.data;
    if (!audio) throw new Error('Edge TTS returned JSON without audio payload');
    const result = String(audio).startsWith('data:') ? String(audio) : `data:audio/mpeg;base64,${audio}`;
    if (settings.cacheEnabled) memoryAudioCache.set(key, result);
    return result;
  }

  const buffer = await response.arrayBuffer();
  const result = `data:${contentType.startsWith('audio/') ? contentType : 'audio/mpeg'};base64,${arrayBufferToBase64(buffer)}`;
  if (settings.cacheEnabled) memoryAudioCache.set(key, result);
  return result;
};
