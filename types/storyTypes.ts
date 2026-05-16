// Story Generation Types
export interface StoryPrompt {
    genre: 'philosophy' | 'history' | 'fiction' | 'biography' | 'educational' | 'custom';
    theme: string;
    targetDuration: number; // seconds
    intellectualDepth: 'fact' | 'insight' | 'reflection' | 'all';
    tone: 'dramatic' | 'philosophical' | 'inspirational' | 'dark' | 'humorous';
    targetAudience: 'general' | 'intellectual' | 'young_adult';
}

export interface GeneratedStory {
    title: string;
    content: string;
    wordCount: number;
    estimatedDuration: number;
    critique: StoryCritique;
    metadata: {
        genre: string;
        theme: string;
        generatedAt: string;
    };
}

export interface StoryCritique {
    hasCentralConflict: boolean;
    hasCharacterArc: boolean;
    has3TierDepth: boolean;
    hasAhaMoment: boolean;
    hasMemorableEnding: boolean;
    isCinematicLanguage: boolean;
    overallScore: number; // 0-6
    feedback: string;
    suggestions?: string[];
}

// Art Style Types
export enum ArtStyle {
    // Illustration
    COMIC_MANHUA = 'comic_manhua',
    COMIC_WESTERN = 'comic_western',
    ANIME_MODERN = 'anime_modern',
    ANIME_VINTAGE = 'anime_vintage',
    WEBTOON = 'webtoon',

    // Painting
    OIL_PAINTING = 'oil_painting',
    WATERCOLOR = 'watercolor',
    INK_WASH = 'ink_wash',
    DIGITAL_PAINTING = 'digital_painting', // NEW
    HORROR_GLITCH = 'horror_glitch',

    // Photo/Cinematic
    CINEMATIC_PHOTO = 'cinematic_photo',
    CINEMATIC = 'cinematic', // NEW: Full cinematic style
    NOIR = 'noir',

    // Mixed
    MIXED_MEDIA = 'mixed_media',
    ABSTRACT = 'abstract'
}

export interface StyleConfig {
    name: string;
    positive: string;
    negative: string;
    examples?: string[];
}

// Image Critique Types
export interface ImageCritiqueResult {
    characterConsistency: boolean;
    composition: boolean;
    lighting: boolean;
    technicalQuality: boolean;
    styleConsistency: boolean;
    narrativeClarity: boolean;
    passed: number; // Number of checks passed (0-6)
    issues: string[];
    suggestions: string[];
}
