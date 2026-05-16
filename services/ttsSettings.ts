const GEMINI_TTS_VOICE_KEY = 'comicvideoai_gemini_tts_voice';

export const GEMINI_TTS_VOICE_DEFAULT = 'Fenrir';

export function getGeminiTtsVoice(): string {
  try {
    if (typeof window === 'undefined') return GEMINI_TTS_VOICE_DEFAULT;
    const raw = window.localStorage.getItem(GEMINI_TTS_VOICE_KEY) || '';
    const trimmed = raw.trim();
    return trimmed || GEMINI_TTS_VOICE_DEFAULT;
  } catch {
    return GEMINI_TTS_VOICE_DEFAULT;
  }
}

export function setGeminiTtsVoice(voiceName: string): void {
  try {
    if (typeof window === 'undefined') return;
    const trimmed = (voiceName || '').trim();
    if (!trimmed) {
      window.localStorage.removeItem(GEMINI_TTS_VOICE_KEY);
      return;
    }
    window.localStorage.setItem(GEMINI_TTS_VOICE_KEY, trimmed);
  } catch {
    // ignore
  }
}

