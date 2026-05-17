import { SceneFull } from '../types';

const STOPWORDS = new Set([
  'và', 'với', 'của', 'cho', 'trong', 'ngoài', 'những', 'các', 'một', 'này', 'kia',
  'đang', 'được', 'là', 'thì', 'mà', 'khi', 'đến', 'vào', 'ra', 'lại', 'như',
  'the', 'and', 'with', 'from', 'that', 'this', 'into', 'scene'
]);

const stripDiacritics = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

export const normalizeForAssetBinding = (value: string): string =>
  stripDiacritics(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const contentTokens = (value: string): string[] =>
  normalizeForAssetBinding(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));

export const assetBindingKey = (value: string): string => {
  let hash = 2166136261;
  const input = normalizeForAssetBinding(value);
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `v2-${hash >>> 0}`;
};

export const isTextGroundedInScene = (candidate: string, sceneSource: string): boolean => {
  const sourceTokens = Array.from(new Set(contentTokens(sceneSource))).slice(0, 24);
  if (!sourceTokens.length) return true;

  const candidateTokens = new Set(contentTokens(candidate));
  if (!candidateTokens.size) return false;

  const shared = sourceTokens.filter((token) => candidateTokens.has(token));
  const required = sourceTokens.length <= 3 ? 1 : Math.max(2, Math.ceil(Math.min(sourceTokens.length, 10) * 0.25));
  return shared.length >= required;
};

export const getGroundedTtsText = (
  scene: Pick<SceneFull, 'id' | 'summary' | 'voiceover_text'>,
  onFallback?: (message: string) => void
): string => {
  const source = (scene.summary || '').trim();
  const voiceover = (scene.voiceover_text || '').trim();
  if (!voiceover) return source;
  if (!source) return voiceover;

  if (!isTextGroundedInScene(voiceover, source)) {
    onFallback?.(`TTS scene ${scene.id}: voiceover không khớp scene, dùng nội dung gốc của scene.`);
    return source;
  }

  return voiceover;
};

export const buildBoundSceneImagePrompt = (
  scene: Pick<SceneFull, 'id' | 'summary' | 'type' | 'storyboard' | 'voiceover_text'>
): string => {
  const sb = scene.storyboard;
  const characters = Array.isArray(sb?.characters)
    ? sb.characters
      .map((char) => [char.name, char.position, char.pose, char.emotion].filter(Boolean).join(' - '))
      .filter(Boolean)
      .join('; ')
    : '';

  return [
    `SCENE ${scene.id} ${scene.type}: MUST depict this exact story beat, not a generic portrait.`,
    `Original scene content: ${scene.summary}`,
    scene.voiceover_text ? `Voiceover meaning to match: ${scene.voiceover_text}` : '',
    sb?.visual_prompt ? `Storyboard visual: ${sb.visual_prompt}` : '',
    sb?.action ? `Required action: ${sb.action}` : '',
    sb?.background ? `Required location/background: ${sb.background}` : '',
    sb?.lighting ? `Lighting/mood: ${sb.lighting}` : '',
    sb?.shot || sb?.angle || sb?.movement
      ? `Camera: ${[sb?.shot, sb?.angle, sb?.movement].filter(Boolean).join(', ')}`
      : '',
    characters ? `Characters explicitly in scene: ${characters}` : 'Only include people if this exact scene requires them.',
    'Forbidden: unrelated young women/men, random fashion portraits, unrelated rooms, unrelated beaches/cities, text, logos, UI, speech bubbles.'
  ].filter(Boolean).join('\n');
};
