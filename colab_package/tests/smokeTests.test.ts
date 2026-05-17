/**
 * Basic smoke tests for core TikTok Mode flows
 */

import { describe, test, expect } from 'vitest';
import { calculateViralScore, calculatePacingHeatmap } from '../services/viralScoring';
import { getPresetById, getDefaultTikTokPreset, ALL_PRESETS } from '../services/presetConfig';
import { SceneFull } from '../types';
import { buildBoundSceneImagePrompt, getGroundedTtsText } from '../services/assetBinding';
import { buildPollinationsPrompt } from '../services/geminiService';

describe('Viral Scoring', () => {
    test('calculates viral score for basic scenes', () => {
        const mockScenes: SceneFull[] = [
            {
                id: 1,
                type: 'HOOK',
                summary: 'Phát hiện cổng bí ẩn trong rừng!',
                estimated_duration: 2,
                voiceover_text: 'Chuyện gì đang xảy ra? Cổng này dẫn đến đâu?',
                storyboard: {
                    shot: 'Close-up',
                    angle: 'Low angle',
                    movement: 'Zoom in',
                    characters: [],
                    background: 'Dense forest',
                    lighting: 'Dark, mysterious',
                    action: 'Character discovers glowing portal',
                    on_screen_text: 'CỔ B  ÍẨN!',
                    sound_effect: 'Whoosh',
                },
                status: 'pending',
            },
            {
                id: 2,
                type: 'REVEAL',
                summary: 'Cổng mở ra, hiện ra thế giới kỳ diệu',
                estimated_duration: 3,
                voiceover_text: 'Ánh sáng xuất hiện, cả một thế giới bên kia!',
                storyboard: {
                    shot: 'Wide',
                    angle: 'Eye-level',
                    movement: 'Pan',
                    characters: [],
                    background: 'Magical realm',
                    lighting: 'Bright, colorful',
                    action: 'Portal opens',
                    on_screen_text: 'THẾ GIỚI MỚI',
                },
                status: 'pending',
            },
        ];

        const score = calculateViralScore(mockScenes);

        expect(score).toBeDefined();
        expect(score.overall).toBeGreaterThanOrEqual(0);
        expect(score.overall).toBeLessThanOrEqual(10);
        expect(score.dimensions.hookQuality).toBeGreaterThan(0); // Should detect good hook
        expect(score.suggestions).toBeDefined();
    });

test('detects low hook quality', () => {
    const badHookScenes: SceneFull[] = [
        {
            id: 1,
            type: 'HOOK',
            summary: 'Ông lão triết gia đi trong rừng suy ngẫm',
            estimated_duration: 5, // Too slow
            voiceover_text: 'Trong im lặng, ông suy tư về cuộc đời...',
            storyboard: {
                shot: 'Wide',
                angle: 'Eye-level',
                movement: 'Static',
                characters: [],
                background: 'Forest',
                lighting: 'Soft',
                action: 'Walking slowly',
                on_screen_text: '',
            },
            status: 'pending',
        },
    ];

    const score = calculateViralScore(badHookScenes);
    expect(score.dimensions.hookQuality).toBeLessThan(6);
    expect(score.warnings.length).toBeGreaterThan(0);
});
});

describe('Pacing Heatmap', () => {
    test('calculates segments for scenes', () => {
        const mockScenes: SceneFull[] = [
            {
                id: 1,
                type: 'HOOK',
                summary: 'Hook scene',
                estimated_duration: 2,
                voiceover_text: 'Hook',
                storyboard: {} as any,
                status: 'pending',
            },
            {
                id: 2,
                type: 'BUILD',
                summary: 'Build scene',
                estimated_duration: 3,
                voiceover_text: 'Build',
                storyboard: {} as any,
                status: 'pending',
            },
        ];

        const segments = calculatePacingHeatmap(mockScenes);
        expect(segments.length).toBeGreaterThan(0);
        expect(segments[0].startTime).toBe(0);
        expect(segments[0].speedRating).toBeDefined();
    });
});

describe('Preset Configuration', () => {
    test('loads all presets', () => {
        expect(ALL_PRESETS.length).toBeGreaterThan(0);
    });

    test('gets default TikTok preset', () => {
        const preset = getDefaultTikTokPreset();
        expect(preset).toBeDefined();
        expect(preset.category).toBe('tiktok');
    });

    test('gets preset by ID', () => {
        const preset = getPresetById('tiktok_explorer');
        expect(preset).toBeDefined();
        expect(preset?.name).toBe('Young Explorer');
    });

    test('returns undefined for invalid ID', () => {
        const preset = getPresetById('nonexistent');
        expect(preset).toBeUndefined();
    });
});

describe('Core Flow Integration', () => {
    test('full scoring and preset flow', () => {
        const preset = getDefaultTikTokPreset();
        expect(preset.viralPotential).toBe('high');

        const mockScenes: SceneFull[] = [
            {
                id: 1,
                type: 'HOOK',
                summary: 'Khám phá kho báu!',
                estimated_duration: 2,
                voiceover_text: 'Kho báu xuất hiện!',
                storyboard: {
                    shot: 'Close-up',
                    angle: 'Low',
                    movement: 'Zoom',
                    characters: [],
                    background: '',
                    lighting: '',
                    action: 'Discovery',
                    on_screen_text: 'KHO BÁU!',
                },
                status: 'pending',
            },
        ];

        const score = calculateViralScore(mockScenes);
        expect(score).toBeDefined();

        const segments = calculatePacingHeatmap(mockScenes);
        expect(segments).toBeDefined();
    });
});

describe('Scene asset binding', () => {
    const pyramidScene: SceneFull = {
        id: 1,
        type: 'HOOK',
        summary: 'Một nhà khảo cổ phát hiện căn phòng bí mật bên dưới kim tự tháp Ai Cập.',
        estimated_duration: 3,
        voiceover_text: 'Hai cô gái bước vào quán cà phê hiện đại.',
        storyboard: {
            shot: 'Wide shot',
            angle: 'Low angle',
            movement: 'Slow push-in',
            characters: [],
            background: 'Bên trong kim tự tháp cổ, đá sa thạch và chữ tượng hình',
            lighting: 'Ánh đuốc vàng, bóng tối sâu',
            action: 'Nhà khảo cổ soi đuốc vào cánh cửa đá bí mật',
            on_screen_text: 'Bí mật dưới kim tự tháp',
            visual_prompt: 'Ancient Egyptian pyramid chamber, hidden stone door, torchlight, hieroglyphs'
        },
        status: 'pending'
    };

    test('binds image prompt to exact scene content before style text', () => {
        const bound = buildBoundSceneImagePrompt(pyramidScene);
        expect(bound).toContain('kim tự tháp');
        expect(bound).toContain('căn phòng bí mật');
        expect(bound).toContain('Forbidden');

        const pollinationsPrompt = buildPollinationsPrompt(
            bound,
            [],
            'comic_manhua',
            'Chủ đề: bí mật kim tự tháp',
            {
                name: 'Comic',
                positive: 'cinematic comic illustration',
                negative: 'text, watermark'
            }
        );

        expect(pollinationsPrompt.indexOf('EXACT SCENE')).toBeLessThan(pollinationsPrompt.indexOf('Art style'));
        expect(pollinationsPrompt).toContain('kim tự tháp');
        expect(pollinationsPrompt).toContain('unrelated young women');
        expect(pollinationsPrompt.length).toBeLessThanOrEqual(1800);
    });

    test('falls back to scene summary when TTS voiceover is unrelated', () => {
        expect(getGroundedTtsText(pyramidScene)).toBe(pyramidScene.summary);
    });
});
