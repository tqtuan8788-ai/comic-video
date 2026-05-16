import { SceneFull, StoryAnalysis } from '../types';

/**
 * Viral Score Dimensions per PRD
 */
export interface ViralScoreDimensions {
    hookQuality: number; // 0-10: Hook effectiveness (0-3s, action/shock, entity presence)
    pacing: number; // 0-10: Timing & reveal windows compliance
    emotionalImpact: number; // 0-10: Emotional resonance & intensity
    relatability: number; // 0-10: Gen Z appeal & universal themes
    memePotential: number; // 0-10: Shock, humor, viral markers
    shareability: number; // 0-10: OMG/WOW moments
    audioQuality: number; // 0-10: Voice match, sound effects, clarity
    trendFit: number; // 0-10: Alignment with current trends
    loopability: number; // 0-10: Ending encourages replay
}

export interface ViralScore {
    overall: number; // Aggregate 0-10
    dimensions: ViralScoreDimensions;
    suggestions: string[]; // Specific improvement recommendations
    warnings: string[]; // Critical issues (score <5)
}

export interface PacingSegment {
    startTime: number;
    endTime: number;
    label: string; // "nhanh" / "on" / "cham"
    speedRating: 'fast' | 'good' | 'slow';
    scenes: number[]; // Scene IDs in this segment
}

/**
 * Calculate viral score for scenes per baocaotongquan guidelines
 * Target: 7+/10 for TikTok viral success
 */
export function calculateViralScore(
    scenes: SceneFull[],
    analysis?: StoryAnalysis
): ViralScore {
    const dimensions: ViralScoreDimensions = {
        hookQuality: scoreHookQuality(scenes, analysis),
        pacing: scorePacing(scenes),
        emotionalImpact: scoreEmotionalImpact(scenes, analysis),
        relatability: scoreRelatability(scenes, analysis),
        memePotential: scoreMemePotential(scenes),
        shareability: scoreShareability(scenes),
        audioQuality: scoreAudioQuality(scenes),
        trendFit: scoreTrendFit(scenes, analysis),
        loopability: scoreLoopability(scenes),
    };

    // Weighted average (hook and pacing are most critical for TikTok)
    const overall =
        (dimensions.hookQuality * 0.20 +
            dimensions.pacing * 0.20 +
            dimensions.emotionalImpact * 0.15 +
            dimensions.relatability * 0.15 +
            dimensions.memePotential * 0.10 +
            dimensions.shareability * 0.10 +
            dimensions.audioQuality * 0.05 +
            dimensions.trendFit * 0.03 +
            dimensions.loopability * 0.02) /
        1.0;

    const suggestions = generateSuggestions(dimensions, scenes);
    const warnings = generateWarnings(dimensions);

    return {
        overall: Math.round(overall * 10) / 10,
        dimensions,
        suggestions,
        warnings,
    };
}

/**
 * Hook Quality: 0-3s impact, action verbs, entity presence
 * Target: 7+/10 (per baocaotongquan)
 */
function scoreHookQuality(scenes: SceneFull[], analysis?: StoryAnalysis): number {
    const hookScene = scenes.find((s) => s.type === 'HOOK');
    if (!hookScene) return 0;

    let score = 5; // Base

    // Check hook timing (should be 0-3s)
    if (hookScene.estimated_duration <= 3) {
        score += 2;
    } else {
        score -= 2; // Penalty for slow hook
    }

    // Action verbs (TikTok needs immediate action)
    const actionVerbs = /\b(phát hiện|khám phá|tìm thấy|xuất hiện|mở|shock|nguy hiểm|bí ẩn|discovered|found|revealed|appeared|danger|mysterious)\b/i;
    const hookText = `${hookScene.summary} ${hookScene.voiceover_text} ${hookScene.storyboard?.on_screen_text || ''}`;

    if (actionVerbs.test(hookText)) {
        score += 2;
    } else {
        score -= 1; // Penalty for no action
    }

    // Entity/subject presence (hook must reference main subject)
    const hasEntity = analysis?.characters?.some((char) =>
        hookText.toLowerCase().includes(char.name.toLowerCase())
    ) || /\b(kho báu|cổng|bí mật|treasure|portal|secret|mystery)\b/i.test(hookText);

    if (hasEntity) {
        score += 1;
    } else {
        score -= 1; // Hook not relevant to content
    }

    // On-screen text length (max 8 words per PRD)
    const onScreenWords = (hookScene.storyboard?.on_screen_text || '').split(/\s+/).filter(Boolean).length;
    if (onScreenWords > 0 && onScreenWords <= 8) {
        score += 1;
    }

    // Avoid philosophical/slow openings (per baocaotongquan: "Ông lão đi trong sương mù" = bad)
    const slowMarkers = /\b(triết gia|suy ngẫm|chiêm nghiệm|philosopher|meditation|reflection|contemplat)\b/i;
    if (slowMarkers.test(hookText)) {
        score -= 2; // Heavy penalty
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Pacing: Reveal window compliance, duration distribution
 */
function scorePacing(scenes: SceneFull[]): number {
    let score = 5;

    const totalDuration = scenes.reduce((sum, s) => sum + s.estimated_duration, 0);
    const revealScene = scenes.find((s) => s.type === 'REVEAL');

    if (!revealScene) return 3; // Missing reveal

    // Calculate reveal timing
    let timeToReveal = 0;
    for (const scene of scenes) {
        if (scene.id === revealScene.id) break;
        timeToReveal += scene.estimated_duration;
    }

    // Reveal windows per PRD: 60s→20-25s, 30s→12-18s, 20s→8-12s, 15s→6-9s
    let optimalRevealStart = 20;
    let optimalRevealEnd = 25;

    if (totalDuration <= 20) {
        optimalRevealStart = 6;
        optimalRevealEnd = 9;
    } else if (totalDuration <= 35) {
        optimalRevealStart = 8;
        optimalRevealEnd = 12;
    } else if (totalDuration <= 45) {
        optimalRevealStart = 12;
        optimalRevealEnd = 18;
    }

    // Check if reveal is in optimal window
    if (timeToReveal >= optimalRevealStart && timeToReveal <= optimalRevealEnd) {
        score += 3; // Perfect timing
    } else if (timeToReveal < optimalRevealStart) {
        score += 1; // A bit early, but acceptable
    } else {
        score -= 3; // Too late (like baocaotongquan: 30s reveal = bad)
    }

    // Check scene durations (cap at 3s per viral checklist)
    const longScenes = scenes.filter((s) => s.estimated_duration > 3).length;
    if (longScenes === 0) {
        score += 2; // All scenes fast-paced
    } else {
        score -= longScenes * 0.5; // Penalty for slow scenes
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Emotional Impact: Sentiment markers, intensity
 */
function scoreEmotionalImpact(scenes: SceneFull[], analysis?: StoryAnalysis): number {
    let score = 5;

    const allText = scenes.map((s) => `${s.summary} ${s.voiceover_text}`).join(' ');

    // High-intensity emotions (TikTok loves strong emotions)
    const intensityMarkers = /\b(shock|sợ hãi|kinh ngạc|ngạc nhiên|phấn khích|excited|terrified|amazed|thrilled|wow)\b/i;
    const intensityCount = (allText.match(intensityMarkers) || []).length;
    score += Math.min(3, intensityCount);

    // Avoid overly philosophical/subtle (per baocaotongquan)
    const subtleMarkers = /\b(suy tư|trầm lặng|tĩnh lặng|chiêm nghiệm|silent|quiet|contemplat|ponder)\b/i;
    const subtleCount = (allText.match(subtleMarkers) || []).length;
    score -= subtleCount * 0.5;

    // Visual shock/payoff in ending
    const endingScene = scenes.find((s) => s.type === 'ENDING');
    if (endingScene) {
        const payoffMarkers = /\b(xuất hiện|mở ra|phát hiện|biến mất|revealed|appeared|opened|discovered|vanished|transformation)\b/i;
        if (payoffMarkers.test(`${endingScene.summary} ${endingScene.voiceover_text}`)) {
            score += 2; // Visual payoff present
        } else {
            score -= 1; // Weak ending
        }
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Relatability: Gen Z appeal, universal themes (per baocaotongquan)
 */
function scoreRelatability(scenes: SceneFull[], analysis?: StoryAnalysis): number {
    let score = 5;

    const allText = scenes.map((s) => `${s.summary} ${s.voiceover_text}`).join(' ');

    // Gen Z relatable themes
    const relatableThemes = /\b(khám phá|phiêu lưu|bí ẩn|kho báu|explore|adventure|mystery|treasure|discover|secret)\b/i;
    if (relatableThemes.test(allText)) {
        score += 2;
    }

    // Avoid niche/intellectual content (per baocaotongquan: "Triết gia" = 1% audience)
    const nicheMarkers = /\b(triết gia|triết lý|văn chương|philosopher|philosophy|literary|intellectual)\b/i;
    if (nicheMarkers.test(allText)) {
        score -= 3; // Heavy penalty
    }

    // Young/relatable characters
    if (analysis?.characters) {
        const relatableChars = analysis.characters.filter((char) =>
            /\b(explorer|thanh niên|young|teen|student|người trẻ|adventurer)\b/i.test(`${char.name} ${char.role} ${char.description}`)
        );
        score += Math.min(2, relatableChars.length);

        const nicheChars = analysis.characters.filter((char) =>
            /\b(triết gia|philosopher|sage|scholar|ông lão)\b/i.test(`${char.name} ${char.role}`)
        );
        score -= nicheChars.length * 2;
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Meme Potential: Shock, humor, viral markers
 */
function scoreMemePotential(scenes: SceneFull[]): number {
    let score = 2; // Low base (current app = 1/10 per baocaotongquan)

    const allText = scenes.map((s) => `${s.summary} ${s.voiceover_text} ${s.storyboard?.on_screen_text || ''}`).join(' ');

    // Shock/surprise moments
    const shockMarkers = /\b(!|shocking|omg|wtf|what|wait|hold on|đợi đã|cái gì|khoan|chờ)\b/i;
    const shockCount = (allText.match(shockMarkers) || []).length;
    score += Math.min(3, shockCount);

    // Humor/comedy
    const humorMarkers = /\b(haha|lol|funny|hài|vui|buồn cười|comedy)\b/i;
    if (humorMarkers.test(allText)) {
        score += 2;
    }

    // Cliffhanger/question hooks
    const questionMarkers = /\b(\?|why|how|what if|tại sao|làm sao|điều gì|liệu)\b/i;
    if (questionMarkers.test(allText)) {
        score += 1;
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Shareability: OMG/WOW moments worth sharing
 */
function scoreShareability(scenes: SceneFull[]): number {
    let score = 3; // Current app = 2/10 per baocaotongquan

    const allText = scenes.map((s) => `${s.summary} ${s.voiceover_text}`).join(' ');

    // "Did you see that?!" moments
    const wowMarkers = /\b(incredible|unbelievable|amazing|epic|wow|không thể tin|tuyệt vời|kinh ngạc)\b/i;
    if (wowMarkers.test(allText)) {
        score += 2;
    }

    // Twist/reveal strength
    const revealScene = scenes.find((s) => s.type === 'REVEAL');
    if (revealScene) {
        const strongReveal = /\b(xuất hiện|mở ra|bí mật|chân tướng|revealed|truth|secret|appeared)\b/i;
        if (strongReveal.test(`${revealScene.summary} ${revealScene.voiceover_text}`)) {
            score += 2;
        }
    }

    // Visual spectacle in ending
    const endingScene = scenes.find((s) => s.type === 'ENDING');
    if (endingScene) {
        const spectacle = /\b(transformation|explosion|magic|portal|biến đổi|kỳ diệu|ma thuật)\b/i;
        if (spectacle.test(`${endingScene.summary} ${endingScene.voiceover_text}`)) {
            score += 2;
        }
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Audio Quality: Voice clarity, sound effects
 */
function scoreAudioQuality(scenes: SceneFull[]): number {
    let score = 6; // Base (current app = 8/10 per baocaotongquan, but conservative)

    // Check for sound effects presence
    const hasSFX = scenes.some((s) => s.storyboard?.sound_effect && s.storyboard.sound_effect.trim() !== '');
    if (hasSFX) {
        score += 2;
    }

    // Check voiceover text quality (not too long, not too short)
    const avgVoiceoverLength = scenes.reduce((sum, s) => sum + (s.voiceover_text?.split(/\s+/).length || 0), 0) / scenes.length;
    if (avgVoiceoverLength >= 8 && avgVoiceoverLength <= 24) {
        score += 2; // Optimal length per viral checklist (24 words max)
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Trend Fit: Alignment with TikTok trends (placeholder for future integration)
 */
function scoreTrendFit(scenes: SceneFull[], analysis?: StoryAnalysis): number {
    let score = 5; // Neutral base

    // Check for trending keywords (basic heuristic)
    const allText = scenes.map((s) => `${s.summary} ${s.voiceover_text}`).join(' ');
    const trendingKeywords = /\b(viral|trend|challenge|pov|storytime|mystery|horror|adventure)\b/i;

    if (trendingKeywords.test(allText)) {
        score += 2;
    }

    // Future: integrate with real-time trending data
    return Math.max(0, Math.min(10, score));
}

/**
 * Loopability: Ending encourages replay
 */
function scoreLoopability(scenes: SceneFull[]): number {
    let score = 4;

    const endingScene = scenes.find((s) => s.type === 'ENDING');
    if (!endingScene) return score;

    const endingText = `${endingScene.summary} ${endingScene.voiceover_text}`;

    // Cliffhanger/teaser for part 2
    const cliffhangerMarkers = /\b(part 2|phần 2|to be continued|tiếp theo|what happens next|điều gì xảy ra tiếp|follow|theo dõi|comment|bình luận)\b/i;
    if (cliffhangerMarkers.test(endingText)) {
        score += 3;
    }

    // Open-ended questions
    if (endingText.includes('?')) {
        score += 2;
    }

    // CTA (call to action)
    const ctaMarkers = /\b(follow|subscribe|like|share|comment|save|theo dõi|đăng ký|thích|chia sẻ|bình luận|lưu)\b/i;
    if (ctaMarkers.test(endingText)) {
        score += 1;
    }

    return Math.max(0, Math.min(10, score));
}

/**
 * Generate specific improvement suggestions
 */
function generateSuggestions(dimensions: ViralScoreDimensions, scenes: SceneFull[]): string[] {
    const suggestions: string[] = [];

    if (dimensions.hookQuality < 6) {
        suggestions.push('🎣 Hook: Thêm action/shock vào 0-3s đầu. VD: "Phát hiện cổng bí ẩn!" thay vì "Ông lão đi trong rừng"');
    }

    if (dimensions.pacing < 6) {
        const totalDuration = scenes.reduce((sum, s) => sum + s.estimated_duration, 0);
        if (totalDuration >= 60) {
            suggestions.push('⏱️ Pacing: Di chuyển reveal về 20-25s (hiện tại quá muộn). Gen Z sẽ swipe away.');
        } else {
            suggestions.push('⏱️ Pacing: Giảm duration mỗi scene xuống ≤3s để giữ tempo nhanh.');
        }
    }

    if (dimensions.relatability < 5) {
        suggestions.push('👥 Relatability: Đổi nhân vật từ "Triết gia" → "Young Explorer" để Gen Z relate hơn.');
    }

    if (dimensions.emotionalImpact < 6) {
        suggestions.push('💥 Emotional: Thêm visual payoff cuối video. VD: "Cổng mở ra, ánh sáng lóe" thay vì "Ông lão suy tư"');
    }

    if (dimensions.memePotential < 4) {
        suggestions.push('🔥 Meme: Thêm shocking moment hoặc câu hỏi kịch tính. VD: "Wait... what is that?!"');
    }

    if (dimensions.shareability < 5) {
        suggestions.push('📤 Shareability: Tạo 1-2 "OMG" moments để người xem muốn share. Twist phải mạnh hơn.');
    }

    if (dimensions.loopability < 5) {
        const endingScene = scenes.find((s) => s.type === 'ENDING');
        if (endingScene && !/\b(part 2|phần 2|theo dõi|follow|bình luận|comment)\b/i.test(endingScene.voiceover_text)) {
            suggestions.push('🔁 Loopability: Thêm CTA cuối: "Bình luận ý kiến, follow và save để xem phần 2"');
        }
    }

    return suggestions;
}

/**
 * Generate warnings for critical issues (score <5)
 */
function generateWarnings(dimensions: ViralScoreDimensions): string[] {
    const warnings: string[] = [];

    if (dimensions.hookQuality < 5) {
        warnings.push('⚠️ CRITICAL: Hook quá yếu (<5/10). Viewers sẽ swipe trong 3s đầu.');
    }

    if (dimensions.pacing < 5) {
        warnings.push('⚠️ CRITICAL: Pacing quá chậm (<5/10). Reveal/payoff đến quá muộn.');
    }

    if (dimensions.relatability < 4) {
        warnings.push('⚠️ WARNING: Nội dung quá niche. Chỉ 1-5% audience sẽ quan tâm.');
    }

    if (dimensions.emotionalImpact < 4) {
        warnings.push('⚠️ WARNING: Thiếu emotional impact. Video sẽ bị "boring" cho Gen Z.');
    }

    return warnings;
}

/**
 * Calculate pacing heatmap segments
 */
export function calculatePacingHeatmap(scenes: SceneFull[]): PacingSegment[] {
    const segments: PacingSegment[] = [];
    const totalDuration = scenes.reduce((sum, s) => sum + s.estimated_duration, 0);

    // Define segments based on total duration
    const segmentBoundaries = totalDuration >= 45
        ? [0, 10, 30, 50, totalDuration]
        : totalDuration >= 25
            ? [0, 8, 15, 22, totalDuration]
            : [0, 5, 10, 15, totalDuration];

    for (let i = 0; i < segmentBoundaries.length - 1; i++) {
        const start = segmentBoundaries[i];
        const end = segmentBoundaries[i + 1];

        // Find scenes in this segment
        let currentTime = 0;
        const sceneIdsInSegment: number[] = [];

        for (const scene of scenes) {
            const sceneEnd = currentTime + scene.estimated_duration;
            if ((currentTime >= start && currentTime < end) || (sceneEnd > start && sceneEnd <= end)) {
                sceneIdsInSegment.push(scene.id);
            }
            currentTime = sceneEnd;
        }

        // Calculate speed rating
        const avgSceneDuration = sceneIdsInSegment.length > 0
            ? sceneIdsInSegment.reduce((sum, id) => {
                const scene = scenes.find(s => s.id === id);
                return sum + (scene?.estimated_duration || 0);
            }, 0) / sceneIdsInSegment.length
            : 3;

        let speedRating: 'fast' | 'good' | 'slow' = 'good';
        let label = 'ổn';

        if (avgSceneDuration <= 2.5) {
            speedRating = 'fast';
            label = 'nhanh';
        } else if (avgSceneDuration > 3.5) {
            speedRating = 'slow';
            label = 'chậm';
        }

        segments.push({
            startTime: start,
            endTime: end,
            label,
            speedRating,
            scenes: sceneIdsInSegment,
        });
    }

    return segments;
}
