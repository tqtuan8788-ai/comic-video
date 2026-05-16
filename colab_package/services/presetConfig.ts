import { ArtStyle } from '../types';

/**
 * Preset configuration per PRD
 * Maps to style, TTS voice, color grading, pacing, tone
 */
export interface PresetConfig {
    id: string;
    name: string;
    description: string;
    category: 'tiktok' | 'legacy';

    // Visual
    artStyle: ArtStyle;
    colorGrading: 'vibrant' | 'dark' | 'cinematic' | 'dreamy' | 'horror' | 'comedy';

    // Audio
    ttsVoice: string; // Voice ID/profile
    ttsSpeed: number; // 0.8-1.2

    // Pacing & Tone
    pacingDefault: 'fast' | 'medium' | 'slow';
    tonePreset: 'action' | 'shock' | 'horror' | 'comedy' | 'poetic' | 'thriller' | 'dreamy';

    // Content hints
    hookStyle: 'action' | 'question' | 'shock' | 'mystery' | 'poetic';
    characterArchetype: string; // "Young Explorer", "Philosopher", etc.

    // Metadata
    useCase: string;
    targetAudience: string;
    viralPotential: 'high' | 'medium' | 'low';
}

/**
 * TikTok Presets - Optimized for viral content (target score 7+/10)
 */
export const TIKTOK_PRESETS: PresetConfig[] = [
    {
        id: 'tiktok_explorer',
        name: 'Young Explorer',
        description: 'Phiêu lưu khám phá, Gen Z relatable. Mystery + Action.',
        category: 'tiktok',
        artStyle: ArtStyle.COMIC_MANHUA,
        colorGrading: 'vibrant',
        ttsVoice: 'young_male_energetic',
        ttsSpeed: 1.1,
        pacingDefault: 'fast',
        tonePreset: 'action',
        hookStyle: 'mystery',
        characterArchetype: 'Young Explorer',
        useCase: 'Adventure, treasure hunt, discovery stories',
        targetAudience: 'Gen Z (13-25)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_urban',
        name: 'Urban Mystery',
        description: 'Bí ẩn đô thị, creepy, relatable. Modern settings.',
        category: 'tiktok',
        artStyle: ArtStyle.DIGITAL_PAINTING,
        colorGrading: 'dark',
        ttsVoice: 'narrator_suspense',
        ttsSpeed: 1.0,
        pacingDefault: 'fast',
        tonePreset: 'thriller',
        hookStyle: 'shock',
        characterArchetype: 'Urban Explorer',
        useCase: 'Creepy places, urban legends, mysteries',
        targetAudience: 'Gen Z + Millennials (18-35)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_horror',
        name: 'Horror Glitch',
        description: 'Kinh dị, jumpscare, shock value cao. Dark aesthetic.',
        category: 'tiktok',
        artStyle: ArtStyle.HORROR_GLITCH,
        colorGrading: 'horror',
        ttsVoice: 'whisper_horror',
        ttsSpeed: 0.9,
        pacingDefault: 'fast',
        tonePreset: 'horror',
        hookStyle: 'shock',
        characterArchetype: 'Cursed Explorer',
        useCase: 'Horror stories, scary content, creepypasta',
        targetAudience: 'Horror fans (16-30)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_comedy',
        name: 'Comedy Meme',
        description: 'Hài hước, meme potential, light-hearted. Bright colors.',
        category: 'tiktok',
        artStyle: ArtStyle.DIGITAL_PAINTING,
        colorGrading: 'comedy',
        ttsVoice: 'narrator_funny',
        ttsSpeed: 1.15,
        pacingDefault: 'fast',
        tonePreset: 'comedy',
        hookStyle: 'question',
        characterArchetype: 'Accidental Hero',
        useCase: 'Funny stories, memes, light content',
        targetAudience: 'Gen Z (13-25)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_action',
        name: 'Action Trailer',
        description: 'Action-packed, fast cuts, epic moments. Cinematic.',
        category: 'tiktok',
        artStyle: ArtStyle.CINEMATIC,
        colorGrading: 'cinematic',
        ttsVoice: 'narrator_epic',
        ttsSpeed: 1.0,
        pacingDefault: 'fast',
        tonePreset: 'action',
        hookStyle: 'action',
        characterArchetype: 'Action Hero',
        useCase: 'Epic adventures, action sequences',
        targetAudience: 'Action fans (15-35)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_anime',
        name: 'Anime/Manhua',
        description: 'Anime style, emotional, dramatic. Asian aesthetics.',
        category: 'tiktok',
        artStyle: ArtStyle.COMIC_MANHUA,
        colorGrading: 'vibrant',
        ttsVoice: 'narrator_dramatic',
        ttsSpeed: 1.0,
        pacingDefault: 'fast',
        tonePreset: 'action',
        hookStyle: 'mystery',
        characterArchetype: 'Anime Protagonist',
        useCase: 'Anime-style stories, dramatic narratives',
        targetAudience: 'Anime fans (13-30)',
        viralPotential: 'high',
    },
    {
        id: 'tiktok_vlog',
        name: 'Vlog IRL',
        description: 'Realistic, first-person, relatable. Documentary style.',
        category: 'tiktok',
        artStyle: ArtStyle.DIGITAL_PAINTING,
        colorGrading: 'cinematic',
        ttsVoice: 'narrator_casual',
        ttsSpeed: 1.05,
        pacingDefault: 'medium',
        tonePreset: 'action',
        hookStyle: 'question',
        characterArchetype: 'Vlogger',
        useCase: 'Story-time, real experiences, vlogs',
        targetAudience: 'Gen Z (15-30)',
        viralPotential: 'medium',
    },
];

/**
 * Legacy Presets - Original cinematic/poetic style (target YouTube/Film)
 */
export const LEGACY_PRESETS: PresetConfig[] = [
    {
        id: 'legacy_poetic',
        name: 'Poetic/Dreamy',
        description: 'Philosophical, artistic, slow-paced. YouTube/Film quality.',
        category: 'legacy',
        artStyle: ArtStyle.INK_WASH,
        colorGrading: 'dreamy',
        ttsVoice: 'narrator_poetic',
        ttsSpeed: 0.95,
        pacingDefault: 'slow',
        tonePreset: 'poetic',
        hookStyle: 'poetic',
        characterArchetype: 'Philosopher',
        useCase: 'Artistic content, philosophical narratives',
        targetAudience: 'Film/literature lovers (25+)',
        viralPotential: 'low',
    },
    {
        id: 'legacy_cinematic',
        name: 'Cinematic Epic',
        description: 'High-quality cinematic, YouTube-grade. Slow build.',
        category: 'legacy',
        artStyle: ArtStyle.CINEMATIC,
        colorGrading: 'cinematic',
        ttsVoice: 'narrator_epic',
        ttsSpeed: 0.95,
        pacingDefault: 'medium',
        tonePreset: 'action',
        hookStyle: 'mystery',
        characterArchetype: 'Epic Hero',
        useCase: 'YouTube videos, high-production content',
        targetAudience: 'Film enthusiasts (20+)',
        viralPotential: 'medium',
    },
];

/**
 * All presets combined
 */
export const ALL_PRESETS: PresetConfig[] = [...TIKTOK_PRESETS, ...LEGACY_PRESETS];

/**
 * Get preset by ID
 */
export function getPresetById(id: string): PresetConfig | undefined {
    return ALL_PRESETS.find(p => p.id === id);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: 'tiktok' | 'legacy'): PresetConfig[] {
    return ALL_PRESETS.filter(p => p.category === category);
}

/**
 * Get default TikTok preset
 */
export function getDefaultTikTokPreset(): PresetConfig {
    return TIKTOK_PRESETS[0]; // Young Explorer
}

/**
 * Apply preset to generation config
 * Returns configuration object for pipeline
 */
export function applyPreset(preset: PresetConfig) {
    return {
        artStyle: preset.artStyle,
        colorGrading: preset.colorGrading,
        ttsVoice: preset.ttsVoice,
        ttsSpeed: preset.ttsSpeed,
        pacingTarget: preset.pacingDefault,
        toneHint: preset.tonePreset,
        hookStyleHint: preset.hookStyle,
        characterArchetype: preset.characterArchetype,
    };
}
