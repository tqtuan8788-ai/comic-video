// Manual Editing Functions
import { SceneFull, Character } from '../types';
import { ArtStyle } from '../types/storyTypes';
import { generateComicImage, generatePlayableAudio } from './geminiService';
import { getGeminiTtsVoice } from './ttsSettings';
import { selectTTSProvider } from './providerConfig';

/**
 * Regenerate image for a specific scene
 */
export const regenerateSceneImage = async (
    scene: SceneFull,
    characters: Character[],
    artStyle: ArtStyle = ArtStyle.COMIC_MANHUA
): Promise<string> => {
    console.log(`[EDIT] Regenerating image for scene ${scene.id}`);

    const visualPrompt = scene.storyboard?.visual_prompt || scene.summary;
    const newImage = await generateComicImage(visualPrompt, characters, artStyle);

    console.log(`[EDIT] New image generated for scene ${scene.id}`);
    return newImage;
};

/**
 * Regenerate audio for a specific scene
 */
export const regenerateSceneAudio = async (
    scene: SceneFull,
    voiceoverText?: string
): Promise<string> => {
    console.log(`[EDIT] Regenerating audio for scene ${scene.id}`);

    const textToSpeak = voiceoverText || scene.voiceover_text || scene.summary;
    const provider = selectTTSProvider();
    const voiceName = (getGeminiTtsVoice() || provider?.ttsVoice || '').trim();
    const newAudio = await generatePlayableAudio(textToSpeak, { voiceName, languageCode: 'vi-VN' });

    console.log(`[EDIT] New audio generated for scene ${scene.id}`);
    return newAudio;
};

/**
 * Batch regenerate images for multiple scenes
 */
export const batchRegenerateImages = async (
    scenes: SceneFull[],
    characters: Character[],
    artStyle: ArtStyle,
    onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> => {
    const results = new Map<number, string>();

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        try {
            const newImage = await regenerateSceneImage(scene, characters, artStyle);
            results.set(scene.id, newImage);

            if (onProgress) {
                onProgress(i + 1, scenes.length);
            }
        } catch (error) {
            console.error(`[EDIT] Failed to regenerate scene ${scene.id}:`, error);
        }
    }

    return results;
};

/**
 * Batch regenerate audio for multiple scenes
 */
export const batchRegenerateAudios = async (
    scenes: SceneFull[],
    onProgress?: (current: number, total: number) => void
): Promise<Map<number, string>> => {
    const results = new Map<number, string>();

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        try {
            const newAudio = await regenerateSceneAudio(scene);
            results.set(scene.id, newAudio);

            if (onProgress) {
                onProgress(i + 1, scenes.length);
            }
        } catch (error) {
            console.error(`[EDIT] Failed to regenerate audio for scene ${scene.id}:`, error);
        }
    }

    return results;
};

/**
 * Upload and replace scene image
 */
export const replaceSceneImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
                resolve(result);
            } else {
                reject(new Error('Invalid file format'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};

/**
 * Upload and replace scene audio
 */
export const replaceSceneAudio = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const result = e.target?.result;
            if (typeof result === 'string') {
                resolve(result);
            } else {
                reject(new Error('Invalid file format'));
            }
        };

        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
};
