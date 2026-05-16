import React, { useState } from 'react';
import { SceneFull } from '../types';
import {
    Image,
    Trash2,
    RefreshCw,
    ArrowLeftRight,
    Clock,
    Zap,
    Eye,
    Heart,
    Sparkles,
    Type,
    Mic,
    Edit3
} from 'lucide-react';

interface StoryboardPreviewProps {
    scenes: SceneFull[];
    onSwap?: (index1: number, index2: number) => void;
    onDelete?: (index: number) => void;
    onRegenerate?: (index: number) => void;
    onEditScene?: (scene: SceneFull) => void;
    onUpdateText?: (index: number, changes: { on_screen_text?: string; voiceover_text?: string }) => void;
    onRegenerateWithPrompt?: (index: number, prompt: string) => void;
}

export const StoryboardPreview: React.FC<StoryboardPreviewProps> = ({
    scenes,
    onSwap,
    onDelete,
    onRegenerate,
    onEditScene,
    onUpdateText,
    onRegenerateWithPrompt,
}) => {
    const [selectedSceneIndex, setSelectedSceneIndex] = useState<number | null>(null);
    const [swapMode, setSwapMode] = useState(false);
    const [swapFirstIndex, setSwapFirstIndex] = useState<number | null>(null);
    const [promptModal, setPromptModal] = useState<{ index: number; prompt: string } | null>(null);

    const handleSwapClick = (index: number) => {
        if (!swapMode || swapFirstIndex === null) {
            setSwapMode(true);
            setSwapFirstIndex(index);
        } else {
            if (onSwap && swapFirstIndex !== index) {
                onSwap(swapFirstIndex, index);
            }
            setSwapMode(false);
            setSwapFirstIndex(null);
        }
    };

    const cancelSwap = () => {
        setSwapMode(false);
        setSwapFirstIndex(null);
    };

    const getSceneTypeBadge = (type: 'HOOK' | 'BUILD' | 'REVEAL' | 'ENDING') => {
        switch (type) {
            case 'HOOK':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-purple-500/30 text-purple-200 border border-purple-500/50">⚡ HOOK</span>;
            case 'BUILD':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-blue-500/30 text-blue-200 border border-blue-500/50">📈 BUILD</span>;
            case 'REVEAL':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-yellow-500/30 text-yellow-200 border border-yellow-500/50">💥 REVEAL</span>;
            case 'ENDING':
                return <span className="px-2 py-1 rounded text-xs font-bold bg-pink-500/30 text-pink-200 border border-pink-500/50">🎬 ENDING</span>;
        }
    };

    const getSceneTypeIcon = (type: 'HOOK' | 'BUILD' | 'REVEAL' | 'ENDING') => {
        switch (type) {
            case 'HOOK':
                return <Zap className="w-4 h-4 text-purple-400" />;
            case 'BUILD':
                return <Clock className="w-4 h-4 text-blue-400" />;
            case 'REVEAL':
                return <Sparkles className="w-4 h-4 text-yellow-400" />;
            case 'ENDING':
                return <Heart className="w-4 h-4 text-pink-400" />;
        }
    };

    // Calculate cumulative timing
    let cumulativeTime = 0;
    const scenesWithTiming = scenes.map((scene) => {
        const startTime = cumulativeTime;
        const endTime = cumulativeTime + scene.estimated_duration;
        cumulativeTime = endTime;
        return { scene, startTime, endTime };
    });

    const totalDuration = cumulativeTime;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                        <Eye className="w-5 h-5 text-blue-400" />
                        Storyboard Preview
                    </h3>
                    <p className="text-sm text-slate-400">
                        {scenes.length} scenes • {totalDuration}s total • Click để edit, swap, hoặc regen
                    </p>
                </div>
                {swapMode && (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-yellow-300">⚡ Swap mode: Chọn scene thứ 2</span>
                        <button
                            onClick={cancelSwap}
                            className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline Overview */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-slate-300">Beat Timing</span>
                </div>
                <div className="flex items-stretch h-8 rounded overflow-hidden border border-slate-600">
                    {scenesWithTiming.map(({ scene, startTime, endTime }, idx) => {
                        const widthPercent = ((endTime - startTime) / totalDuration) * 100;
                        const bgColor =
                            scene.type === 'HOOK'
                                ? 'bg-purple-500/40'
                                : scene.type === 'BUILD'
                                    ? 'bg-blue-500/40'
                                    : scene.type === 'REVEAL'
                                        ? 'bg-yellow-500/40'
                                        : 'bg-pink-500/40';
                        return (
                            <div
                                key={idx}
                                className={`${bgColor} border-r border-slate-700 flex items-center justify-center text-xs font-semibold text-white`}
                                style={{ width: `${widthPercent}%` }}
                                title={`${scene.type}: ${startTime}s - ${endTime}s`}
                            >
                                {scene.estimated_duration}s
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>0s</span>
                    <span>{totalDuration}s</span>
                </div>
            </div>

            {/* Scene Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {scenesWithTiming.map(({ scene, startTime, endTime }, index) => {
                    const isSelected = selectedSceneIndex === index;
                    const isSwapSelected = swapMode && swapFirstIndex === index;

                    return (
                        <div
                            key={scene.id}
                            className={`bg-slate-900/50 border-2 rounded-lg overflow-hidden transition-all ${isSelected
                                    ? 'border-blue-500 shadow-lg shadow-blue-900/50'
                                    : isSwapSelected
                                        ? 'border-yellow-500 shadow-lg shadow-yellow-900/50 scale-105'
                                        : 'border-slate-700 hover:border-slate-600'
                                }`}
                        >
                            {/* Thumbnail/Visual */}
                            <div
                                className="relative h-40 bg-slate-800 flex items-center justify-center cursor-pointer"
                                onClick={() => {
                                    setSelectedSceneIndex(index);
                                    if (onEditScene) onEditScene(scene);
                                }}
                            >
                                {scene.generated_image_url ? (
                                    <img
                                        src={scene.generated_image_url}
                                        alt={`Scene ${scene.id}`}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-slate-500">
                                        <Image className="w-12 h-12" />
                                        <span className="text-xs">No image</span>
                                    </div>
                                )}

                                {/* Scene Number Overlay */}
                                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold text-white">
                                    #{index + 1}
                                </div>

                                {/* Type Badge */}
                                <div className="absolute top-2 right-2">
                                    {getSceneTypeBadge(scene.type)}
                                </div>

                                {/* Beat Timing */}
                                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-blue-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {startTime}s - {endTime}s
                                </div>

                                {/* Status indicator */}
                                {scene.status === 'generating' && (
                                    <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center">
                                        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                                    </div>
                                )}
                                {scene.status === 'error' && (
                                    <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                                        <span className="text-red-300 font-semibold">Error</span>
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className="p-3 space-y-3">
                                <div className="space-y-3">
                                    <div>
                                        <label className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            <Type className="w-3 h-3" /> On-screen text
                                        </label>
                                        <textarea
                                            value={scene.storyboard?.on_screen_text || ''}
                                            onChange={(e) => onUpdateText?.(index, { on_screen_text: e.target.value })}
                                            rows={2}
                                            className="mt-1 w-full text-sm bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                            placeholder="Nhập hook hoặc caption..."
                                        />
                                    </div>

                                    <div>
                                        <label className="flex items-center gap-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            <Mic className="w-3 h-3" /> Voiceover
                                        </label>
                                        <textarea
                                            value={scene.voiceover_text || ''}
                                            onChange={(e) => onUpdateText?.(index, { voiceover_text: e.target.value })}
                                            rows={3}
                                            className="mt-1 w-full text-xs bg-slate-900 border border-slate-600 rounded px-3 py-2 text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                                            placeholder="Nhập nội dung voiceover..."
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                                    {onSwap && (
                                        <button
                                            onClick={() => handleSwapClick(index)}
                                            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${isSwapSelected
                                                    ? 'bg-yellow-600 text-white'
                                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                                }`}
                                            title="Swap scene position"
                                        >
                                            <ArrowLeftRight className="w-3 h-3" />
                                            Swap
                                        </button>
                                    )}

                                    {(onRegenerate || onRegenerateWithPrompt) && (
                                        <button
                                            onClick={() =>
                                                setPromptModal({
                                                    index,
                                                    prompt: scene.storyboard?.visual_prompt || scene.summary || '',
                                                })
                                            }
                                            disabled={scene.status === 'generating'}
                                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Regenerate this scene"
                                        >
                                                <RefreshCw className="w-3 h-3" />
                                            Regen
                                        </button>
                                    )}

                                    {onDelete && (
                                        <button
                                            onClick={() => {
                                                if (confirm(`Delete scene #${index + 1}?`)) {
                                                    onDelete(index);
                                                }
                                            }}
                                            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-red-600/20 text-red-300 text-xs font-semibold hover:bg-red-600/30 transition-colors border border-red-500/40"
                                            title="Delete this scene"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Key Moments Summary */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    Key Moments
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {scenesWithTiming
                        .filter(({ scene }) => ['HOOK', 'REVEAL', 'ENDING'].includes(scene.type))
                        .map(({ scene, startTime }, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                                {getSceneTypeIcon(scene.type)}
                                <div>
                                    <div className="font-semibold text-white">{scene.type}</div>
                                    <div className="text-xs text-slate-400">{startTime}s</div>
                                </div>
                            </div>
                        ))}
                </div>
            </div>

            {/* Performance Note */}
            <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-700">
                💡 UI operations optimized for &lt;300ms response time per PRD
            </div>
            {promptModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-blue-400" />
                                    Regen Scene #{promptModal.index + 1}
                                </h4>
                                <p className="text-xs text-slate-400">Chỉnh prompt trước khi tạo ảnh mới.</p>
                            </div>
                            <button
                                onClick={() => setPromptModal(null)}
                                className="text-slate-400 hover:text-white text-sm"
                            >
                                ✕
                            </button>
                        </div>
                        <textarea
                            value={promptModal.prompt}
                            onChange={(e) => setPromptModal({ ...promptModal, prompt: e.target.value })}
                            rows={6}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                            placeholder="Nhập mô tả chi tiết cho hình ảnh..."
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setPromptModal(null)}
                                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            {onRegenerate && (
                                <button
                                    onClick={() => {
                                        onRegenerate(promptModal.index);
                                        setPromptModal(null);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-slate-700 text-white text-sm hover:bg-slate-600"
                                >
                                    Giữ prompt gốc
                                </button>
                            )}
                            {onRegenerateWithPrompt && (
                                <button
                                    onClick={() => {
                                        onRegenerateWithPrompt(promptModal.index, promptModal.prompt.trim());
                                        setPromptModal(null);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500"
                                >
                                    Regen với prompt này
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
