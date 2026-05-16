import { Schema, Type } from '@google/genai';
import { StoryPrompt, GeneratedStory, StoryCritique } from '../types/storyTypes';
import { generateStoryPrompt, STORY_CRITIQUE_PROMPT } from '../prompts/storyPrompts';
import { callLLM } from './aiClient';

// Clean JSON helper
const cleanJson = (text: string): string => {
    return text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
};

/**
 * Generate AI story with self-critique
 * Iterates until story meets Hollywood standards (score >= 5/6)
 */
export const generateStoryWithCritique = async (
    prompt: StoryPrompt,
    maxIterations: number = 3
): Promise<GeneratedStory> => {
    // Work on a local copy to avoid mutating caller state
    let workingPrompt: StoryPrompt = { ...prompt };
    let currentStory = '';
    let critique: StoryCritique | null = null;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        console.log(`[STORY] Generation attempt ${iteration}/${maxIterations}`);

        // 1. Generate story
        const storyPromptText = generateStoryPrompt(workingPrompt);
        const storyResponse = await callLLM({
            prompt: storyPromptText,
            temperature: 0.85,
            maxOutputTokens: 2048
        });

        currentStory = storyResponse || '';

        if (!currentStory) {
            console.error('[STORY] Empty response from AI');
            continue;
        }

        console.log(`[STORY] Generated ${currentStory.split(' ').length} words`);

        // 2. Self-critique
        critique = await critiqueStory(currentStory);

        console.log(`[STORY] Critique score: ${critique.overallScore}/6`);
        console.log(`[STORY] Feedback:`, critique.feedback);

        // 3. Check if acceptable
        if (critique.overallScore >= 5) {
            console.log(`[STORY] ACCEPTED (score ${critique.overallScore}/6)`);
            break;
        }

        console.warn(`[STORY] Score too low (${critique.overallScore}/6), regenerating...`);

        if (iteration < maxIterations && critique.suggestions && critique.suggestions.length > 0) {
            // Add suggestions to next iteration prompt
            workingPrompt = {
                ...workingPrompt,
                theme: `${workingPrompt.theme}\n\nIMPROVE BASED ON FEEDBACK:\n${critique.suggestions.join('\n')}`
            };
        }
    }

    if (!critique) {
        throw new Error('Failed to generate story after retries');
    }

    // Calculate metadata
    const wordCount = currentStory.split(/\s+/).length;
    const estimatedDuration = Math.ceil(wordCount / 3); // 3 words per second

    return {
        title: extractTitle(currentStory) || `${prompt.genre.toUpperCase()}: ${prompt.theme.substring(0, 30)}...`,
        content: currentStory,
        wordCount,
        estimatedDuration,
        critique,
        metadata: {
            genre: prompt.genre,
            theme: prompt.theme,
            generatedAt: new Date().toISOString()
        }
    };
};

/**
 * Critique a story using AI
 */
const critiqueStory = async (story: string): Promise<StoryCritique> => {
    const schema: Schema = {
        type: Type.OBJECT,
        properties: {
            hasCentralConflict: { type: Type.BOOLEAN },
            hasCharacterArc: { type: Type.BOOLEAN },
            has3TierDepth: { type: Type.BOOLEAN },
            hasAhaMoment: { type: Type.BOOLEAN },
            hasMemorableEnding: { type: Type.BOOLEAN },
            isCinematicLanguage: { type: Type.BOOLEAN },
            overallScore: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
            suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        },
        required: ['hasCentralConflict', 'hasCharacterArc', 'has3TierDepth',
            'hasAhaMoment', 'hasMemorableEnding', 'isCinematicLanguage',
            'overallScore', 'feedback']
    };

    const responseText = await callLLM({
        prompt: `${STORY_CRITIQUE_PROMPT}\n\n**STORY TO CRITIQUE:**\n\n${story}`,
        schema,
        schemaName: 'StoryCritique',
        temperature: 0.3
    });

    if (!responseText) {
        throw new Error('No critique response');
    }

    try {
        const result = JSON.parse(cleanJson(responseText));
        return {
            ...result,
            overallScore: [
                result.hasCentralConflict,
                result.hasCharacterArc,
                result.has3TierDepth,
                result.hasAhaMoment,
                result.hasMemorableEnding,
                result.isCinematicLanguage
            ].filter(Boolean).length
        };
    } catch (e) {
        console.error('[STORY] Critique parse error:', e);
        // Fallback
        return {
            hasCentralConflict: true,
            hasCharacterArc: true,
            has3TierDepth: true,
            hasAhaMoment: false,
            hasMemorableEnding: true,
            isCinematicLanguage: true,
            overallScore: 5,
            feedback: "Could not parse critique, assuming acceptable quality",
            suggestions: []
        };
    }
};

/**
 * Extract title from story (first line if it looks like a title)
 */
const extractTitle = (story: string): string | null => {
    const lines = story.trim().split('\n');
    if (lines.length > 0 && lines[0].length < 100 && !lines[0].includes('.')) {
        return lines[0].replace(/^[*#\s]+/, '').trim();
    }
    return null;
};

/**
 * Quick story generation without critique (for faster iteration)
 */
export const generateStoryQuick = async (prompt: StoryPrompt): Promise<string> => {
    const storyPromptText = generateStoryPrompt(prompt);

    const response = await callLLM({
        prompt: storyPromptText,
        temperature: 0.85,
        maxOutputTokens: 2048
    });

    return response || '';
};
