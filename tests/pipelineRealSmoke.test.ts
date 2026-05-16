import { describe, expect, test } from 'vitest';
import { ArtStyle } from '../types/storyTypes';
import {
  analyzeStory,
  breakdownScenes,
  generateComicImage,
  generatePlayableAudio,
  generateStoryboardAndScript,
  normalizeInput
} from '../services/geminiService';
import { setOmniVoiceSettings, DEFAULT_OMNIVOICE_SETTINGS } from '../services/omniVoice';

const installLocalStorageStub = () => {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key)
    }
  };
};

describe('real provider pipeline smoke', () => {
  test(
    'runs a minimal story through scene breakdown, storyboard, image, and audio',
    async () => {
      installLocalStorageStub();
      setOmniVoiceSettings({
        ...DEFAULT_OMNIVOICE_SETTINGS,
        endpointUrl: 'http://127.0.0.1:7861/tts',
        healthUrl: 'http://127.0.0.1:7861/health',
        voicesUrl: 'http://127.0.0.1:7861/voices',
        cloneUrl: 'http://127.0.0.1:7861/clone',
        maxCharsPerRequest: 240,
        maxWordsPerRequest: 36,
        cacheEnabled: false,
        format: 'wav'
      });

      const input =
        'Một cậu bé nhặt được chiếc đồng hồ cũ trong sân trường. Mỗi khi kim giây chạy ngược, cậu nhìn thấy trước một tai nạn nhỏ sắp xảy ra. Cậu dùng nó để cứu bạn mình khỏi một cú ngã, nhưng cuối cùng phát hiện chiếc đồng hồ chỉ hoạt động khi cậu dám giúp người khác.';

      const normalized = await normalizeInput(input);
      expect(normalized.clean_text.trim().length).toBeGreaterThan(20);

      const analysis = await analyzeStory(normalized.clean_text);
      expect(analysis.theme.trim().length).toBeGreaterThan(0);

      const scenes = await breakdownScenes(normalized.clean_text, analysis, 3, false);
      expect(scenes.length).toBeGreaterThan(0);
      expect(scenes.every((scene) => scene.summary.trim().length > 0)).toBe(true);

      const storyboard = await generateStoryboardAndScript(scenes[0], analysis, analysis.theme, {
        index: 1,
        total: scenes.length
      });
      expect(storyboard.voiceover_text.trim().length).toBeGreaterThan(0);
      expect(storyboard.storyboard.on_screen_text.trim().length).toBeGreaterThan(0);
      expect((storyboard.visual_prompt || storyboard.storyboard.visual_prompt || '').trim().length).toBeGreaterThan(0);

      const image = await generateComicImage(
        storyboard.visual_prompt || storyboard.storyboard.visual_prompt || scenes[0].summary,
        analysis.characters || [],
        ArtStyle.COMIC_MANHUA,
        analysis.theme
      );
      expect(image.startsWith('data:image/')).toBe(true);

      const audio = await generatePlayableAudio('Cậu bé nhặt được chiếc đồng hồ kỳ lạ.', {
        voiceName: 'auto',
        languageCode: 'vi-VN'
      });
      expect(audio.startsWith('data:audio/')).toBe(true);
    },
    240_000
  );
});
