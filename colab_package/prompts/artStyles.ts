// Art Style Configuration
import { ArtStyle, StyleConfig } from '../types/storyTypes';

export const STYLE_PROMPTS: Record<ArtStyle, StyleConfig> = {
    [ArtStyle.COMIC_MANHUA]: {
        name: "Chinese Manhua Comic",
        positive: "Masterpiece Chinese Manhua style, hand-drawn comic illustration, clean sharp linework, dramatic cel-shading, cinematic composition, dynamic angles, professional comic art, detailed backgrounds, 9:16 vertical panel, vibrant colors, high contrast",
        negative: "photorealistic, photograph, 3D render, blurry, low quality, watermark, text bubbles, speech bubbles, ugly, deformed, amateur",
        examples: ["Historical figures in traditional attire", "Modern urban scenes", "Action sequences"]
    },

    [ArtStyle.COMIC_WESTERN]: {
        name: "Western Comic (Marvel/DC Style)",
        positive: "American comic book style, Marvel Comics aesthetic, bold linework, dramatic shadows, superhero comic art, dynamic composition, professional inking, vibrant comic colors, 9:16 panel, action-packed",
        negative: "realistic photo, 3D, anime, manga, blurry, sketch, unfinished, text",
        examples: ["Superhero poses", "Dramatic confrontations", "Urban settings"]
    },

    [ArtStyle.ANIME_MODERN]: {
        name: "Modern Anime",
        positive: "High-quality modern anime illustration, cel-shaded, vibrant saturated colors, clean linework, expressive large eyes, dramatic lighting, professional anime art, detailed character design, 9:16 aspect ratio, studio quality",
        negative: "realistic, photograph, western comic, 3D render, sketch, old anime style, low quality",
        examples: ["Slice of life scenes", "Emotional moments", "School settings"]
    },

    [ArtStyle.ANIME_VINTAGE]: {
        name: "Vintage 90s Anime",
        positive: "1990s anime aesthetic, retro anime style, cel animation look, soft colors, nostalgic anime art, hand-painted backgrounds, classic anime composition, film grain, 9:16 format, Cowboy Bebop style",
        negative: "modern anime, realistic, 3D, digital art, oversaturated, low quality",
        examples: ["Cyberpunk scenes", "Noir atmosphere", "Retro tech"]
    },

    [ArtStyle.WEBTOON]: {
        name: "Korean Webtoon",
        positive: "Korean webtoon style, clean digital illustration, soft shading, romantic lighting, modern webtoon art, vertical scrolling format optimized, pastel color palette, 9:16 portrait, manhwa aesthetic",
        negative: "realistic photo, western comic, rough sketch, traditional manga, low resolution",
        examples: ["Romance scenes", "School life", "Fantasy settings"]
    },

    [ArtStyle.OIL_PAINTING]: {
        name: "Classical Oil Painting",
        positive: "Classical oil painting style, rich impasto textures, painterly brushstrokes, Rembrandt lighting, museum quality, baroque composition, masterpiece oil on canvas, dramatic chiaroscuro, 9:16 portrait orientation, renaissance art",
        negative: "digital, flat colors, cartoon, photograph, modern, minimalist, comic, anime",
        examples: ["Historical portraits", "Dramatic scenes", "Still life"]
    },

    [ArtStyle.WATERCOLOR]: {
        name: "Watercolor Painting",
        positive: "Soft watercolor painting, delicate brushwork, translucent washes, organic edges, artistic watercolor illustration, gentle color blending, paper texture, 9:16 vertical format, ethereal atmosphere",
        negative: "digital art, hard edges, photorealistic, 3D, cartoon, comic book, oil painting",
        examples: ["Nature scenes", "Soft portraits", "Dreamlike atmospheres"]
    },

    [ArtStyle.INK_WASH]: {
        name: "Chinese Ink Wash (Sumi-e)",
        positive: "Traditional Chinese ink wash painting, sumi-e style, flowing brushwork, minimalist composition, black ink gradients, rice paper texture, zen aesthetic, artistic negative space, 9:16 scroll format, calligraphic elegance",
        negative: "colorful, western art, digital, photograph, detailed rendering, busy composition",
        examples: ["Mountains and water", "Bamboo forests", "Philosophical scenes"]
    },

    [ArtStyle.HORROR_GLITCH]: {
        name: "Horror Glitch",
        positive: "Horror glitch aesthetic, high contrast, cold desaturated palette, heavy shadows, eerie atmosphere, subtle chromatic aberration, VHS noise, scanlines, digital artifacts, distressed textures, cinematic framing, 9:16 portrait, unsettling mood",
        negative: "cute, pastel, cheerful, clean modern UI, soft lighting, low contrast, watercolor, cartoon, anime",
        examples: ["Haunted corridors", "Cursed artifacts", "Analog horror frames"]
    },

    [ArtStyle.DIGITAL_PAINTING]: {
        name: "High Fidelity Digital Painting",
        positive: "AAA digital painting, ultra-detailed concept art, precise brush strokes, volumetric fog, cinematic lighting, painterly textures, professional concept art aesthetics, 9:16 portrait canvas, artstation trending",
        negative: "pixelated, sketchy, unfinished, low resolution, photorealistic photo, harsh flash, fisheye, distorted anatomy",
        examples: ["Fantasy key art", "Heroic portraits", "Epic landscape establishing shots"]
    },

    [ArtStyle.CINEMATIC_PHOTO]: {
        name: "Cinematic Photography",
        positive: "Cinematic film photography, anamorphic lens flare, dramatic film lighting, professional color grading, film grain texture, shallow depth of field, 9:16 portrait orientation, movie still quality, ARRI Alexa aesthetic",
        negative: "cartoon, illustration, painting, anime, amateur photo, overexposed, blurry, low quality",
        examples: ["Portrait photography", "Atmospheric scenes", "Dramatic moments"]
    },

    [ArtStyle.CINEMATIC]: {
        name: "Epic Cinematic Concept Art",
        positive: "Epic cinematic concept art, sweeping camera movement, dramatic volumetric lighting, ultra high detail, depth of field, IMAX 9:16 framing, blockbuster key art, atmospheric perspective, professional film color grade",
        negative: "flat lighting, cartoon, minimal detail, washed colors, overexposed, fisheye lens, chaotic composition",
        examples: ["Hero reveal shots", "Final battle moments", "Emotional climaxes"]
    },

    [ArtStyle.NOIR]: {
        name: "Film Noir Black & White",
        positive: "Film noir style, high contrast black and white photography, dramatic shadows, venetian blind lighting, 1940s noir aesthetic, moody atmosphere, cinematic composition, 9:16 vertical, classic Hollywood",
        negative: "color, bright, cheerful, cartoon, modern, low contrast, flat lighting",
        examples: ["Detective scenes", "Urban nights", "Mysterious characters"]
    },

    [ArtStyle.MIXED_MEDIA]: {
        name: "Mixed Media Collage",
        positive: "Mixed media collage art, layered textures, combined techniques, paper cutouts, painted elements, photographic fragments, artistic assemblage, 9:16 vertical composition, contemporary art",
        negative: "single technique, uniform style, simplistic, low effort, messy, chaotic",
        examples: ["Abstract concepts", "Memory scenes", "Surreal narratives"]
    },

    [ArtStyle.ABSTRACT]: {
        name: "Abstract Expressionism",
        positive: "Abstract expressionism, bold gestural brushstrokes, vibrant color fields, emotional energy, non-representational art, dynamic composition, 9:16 vertical canvas, modern art masterpiece",
        negative: "realistic, figurative, representational, detailed, photographic, illustrative",
        examples: ["Emotional states", "Philosophical concepts", "Pure aesthetics"]
    }
};

/**
 * Get style configuration for a given art style
 */
export const getStyleConfig = (style: ArtStyle): StyleConfig => {
    const config = STYLE_PROMPTS[style];
    if (!config) {
        console.warn(`[artStyles] Unknown style "${style}", falling back to COMIC_MANHUA.`);
        return STYLE_PROMPTS[ArtStyle.COMIC_MANHUA];
    }
    return config;
};

/**
 * Build complete image generation prompt with style
 */
export const buildStyledPrompt = (
    basePrompt: string,
    style: ArtStyle,
    additionalInstructions?: string
): string => {
    const config = getStyleConfig(style);

    return `${basePrompt}

**ART STYLE: ${config.name}**

**POSITIVE PROMPTS (MUST INCLUDE):**
${config.positive}

**NEGATIVE PROMPTS (MUST AVOID):**
${config.negative}

${additionalInstructions || ''}

IMPORTANT: Output MUST be 100% in the "${config.name}" style. No mixing with other styles.`;
};
