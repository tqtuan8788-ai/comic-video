import React, { useEffect, useRef, useState } from 'react';
import { StoryPrompt, GeneratedStory } from '../types';
import { generateStoryWithCritique } from '../services/storyGenerator';
import { Sparkles, CheckCircle, XCircle } from 'lucide-react';

interface Props {
    onStoryGenerated: (story: string) => void;
}

class StoryGenBoundary extends React.Component<{ children: React.ReactNode; onReset: () => void }, { hasError: boolean }> {
    constructor(props: { children: React.ReactNode; onReset: () => void }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: any, info: any) {
        console.error('[StoryGenerator] Render error captured', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-900/40 border border-red-700 rounded-lg text-sm text-red-100 space-y-3">
                    <div className="font-bold text-red-200">Đã xảy ra lỗi khi hiển thị trình tạo câu chuyện.</div>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false });
                            this.props.onReset();
                        }}
                        className="px-3 py-2 rounded bg-red-700 text-white font-semibold hover:bg-red-600 transition-colors"
                    >
                        Thử lại
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export const StoryGeneratorModule: React.FC<Props> = ({ onStoryGenerated }) => {
    const [prompt, setPrompt] = useState<StoryPrompt>({
        genre: 'philosophy',
        theme: '',
        targetDuration: 120,
        intellectualDepth: 'all',
        tone: 'philosophical',
        targetAudience: 'intellectual'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<GeneratedStory | null>(null);
    const isMountedRef = useRef(true);
    const [renderKey, setRenderKey] = useState(0);

    const updatePrompt = (changes: Partial<StoryPrompt>) => {
        setPrompt((prev) => ({ ...prev, ...changes }));
    };

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const handleGenerate = async () => {
        if (!prompt.theme.trim()) {
            alert('Please enter a theme');
            return;
        }

        setIsGenerating(true);
        setResult(null);

        try {
            // Clone prompt to avoid mutation inside generator
            const story = await generateStoryWithCritique({ ...prompt }, 3);
            if (isMountedRef.current) {
                setResult(story);
                console.log('[STORY] Generated successfully:', story);
            }
        } catch (error) {
            console.error('[STORY] Generation failed:', error);
            alert('Failed to generate story. Check console for details.');
        } finally {
            if (isMountedRef.current) {
                setIsGenerating(false);
            }
        }
    };

    const handleUseStory = () => {
        if (result) {
            onStoryGenerated(result.content);
        }
    };

    const content = (
        <div key={renderKey} className="max-w-4xl mx-auto p-6">
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="w-6 h-6 text-yellow-400" />
                    <h2 className="text-2xl font-bold text-white">AI Story Generator</h2>
                    <span className="text-xs bg-purple-900/30 text-purple-300 px-2 py-1 rounded">Hollywood Standard</span>
                </div>

                {/* Theme Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Theme / Topic *
                    </label>
                    <input
                        type="text"
                        value={prompt.theme}
                        onChange={(e) => updatePrompt({ theme: e.target.value })}
                        placeholder="e.g., Sacrifice of a mother, Friendship in war"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isGenerating}
                    />
                </div>

                {/* Config Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Genre</label>
                        <select
                            value={prompt.genre}
                            onChange={(e) => updatePrompt({ genre: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            disabled={isGenerating}
                        >
                            <option value="philosophy">Philosophy</option>
                            <option value="history">History</option>
                            <option value="fiction">Fiction</option>
                            <option value="biography">Biography</option>
                            <option value="educational">Educational</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Tone</label>
                        <select
                            value={prompt.tone}
                            onChange={(e) => updatePrompt({ tone: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            disabled={isGenerating}
                        >
                            <option value="dramatic">Dramatic</option>
                            <option value="philosophical">Philosophical</option>
                            <option value="inspirational">Inspirational</option>
                            <option value="dark">Dark</option>
                            <option value="humorous">Humorous</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Target Duration: {prompt.targetDuration}s
                        </label>
                        <input
                            type="range"
                            min={60}
                            max={180}
                            step={30}
                            value={prompt.targetDuration}
                            onChange={(e) => updatePrompt({ targetDuration: parseInt(e.target.value, 10) || 60 })}
                            className="w-full"
                            disabled={isGenerating}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Depth Level</label>
                        <select
                            value={prompt.intellectualDepth}
                            onChange={(e) => updatePrompt({ intellectualDepth: e.target.value as any })}
                            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                            disabled={isGenerating}
                        >
                            <option value="fact">Fact Only</option>
                            <option value="insight">Fact + Insight</option>
                            <option value="reflection">Fact + Reflection</option>
                            <option value="all">All 3 Tiers</option>
                        </select>
                    </div>
                </div>

                {/* Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.theme.trim()}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg text-white font-bold hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                >
                    {isGenerating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating Hollywood-Quality Story...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-5 h-5" />
                            Generate Story
                        </>
                    )}
                </button>

                {/* Result Display */}
                {result && (
                    <div key={result.metadata?.generatedAt || 'result-block'} className="mt-6 border-t border-slate-700 pt-6">
                        <h3 className="text-lg font-bold text-white mb-4">Generated Story</h3>

                        {/* Critique Score */}
                        <div className="bg-slate-900 p-4 rounded-lg mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-slate-300">Quality Score:</span>
                                <span className={`text-lg font-bold ${result.critique.overallScore >= 5 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {result.critique.overallScore}/6
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="flex items-center gap-1">
                                    {result.critique.hasCentralConflict ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Conflict</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {result.critique.hasCharacterArc ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Arc</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {result.critique.has3TierDepth ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Depth</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {result.critique.hasAhaMoment ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Aha</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {result.critique.hasMemorableEnding ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Ending</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {result.critique.isCinematicLanguage ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                                    <span className="text-slate-400">Cinematic</span>
                                </div>
                            </div>
                        </div>

                        {/* Story Content */}
                        <div className="bg-slate-900 p-4 rounded-lg mb-4 max-h-96 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans">
                                {result.content}
                            </pre>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleUseStory}
                                className="flex-1 px-6 py-3 bg-green-600 rounded-lg text-white font-bold hover:bg-green-500"
                            >
                                Use This Story
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="px-6 py-3 bg-slate-700 rounded-lg text-white hover:bg-slate-600"
                                disabled={isGenerating}
                            >
                                Generate Another
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <StoryGenBoundary onReset={() => setRenderKey((k) => k + 1)}>
            {content}
        </StoryGenBoundary>
    );
};
