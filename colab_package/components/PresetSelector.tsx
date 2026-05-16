import React, { useState } from 'react';
import { PresetConfig, ALL_PRESETS, TIKTOK_PRESETS, LEGACY_PRESETS, applyPreset } from '../services/presetConfig';
import { Zap, Film, TrendingUp, Sparkles, Check } from 'lucide-react';

interface PresetSelectorProps {
    selectedPresetId?: string;
    onSelect: (preset: PresetConfig) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({ selectedPresetId, onSelect }) => {
    const [category, setCategory] = useState<'tiktok' | 'legacy' | 'all'>('tiktok');

    const presetsToShow = category === 'all'
        ? ALL_PRESETS
        : category === 'tiktok'
            ? TIKTOK_PRESETS
            : LEGACY_PRESETS;

    const getViralPotentialBadge = (potential: 'high' | 'medium' | 'low') => {
        switch (potential) {
            case 'high':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/40">🔥 High Viral</span>;
            case 'medium':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">⚡ Medium</span>;
            case 'low':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/40">📺 YouTube</span>;
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Presets - Phong Cách Video
                </h3>
                <p className="text-sm text-slate-400">
                    Chọn preset để tự động tối ưu style, voice, pacing theo mục đích
                </p>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setCategory('tiktok')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${category === 'tiktok'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span>TikTok Mode</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">7 presets (Viral 7+/10)</div>
                </button>
                <button
                    onClick={() => setCategory('legacy')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${category === 'legacy'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Film className="w-4 h-4" />
                        <span>Legacy/YouTube</span>
                    </div>
                    <div className="text-xs opacity-70 mt-1">2 presets (Cinematic)</div>
                </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {presetsToShow.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                        <button
                            key={preset.id}
                            onClick={() => onSelect(preset)}
                            className={`text-left p-4 rounded-lg border-2 transition-all hover:scale-105 ${isSelected
                                    ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-900/50'
                                    : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                                }`}
                        >
                            {/* Header with selection indicator */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                                        {preset.name}
                                        {isSelected && <Check className="w-4 h-4 text-blue-400" />}
                                    </h4>
                                    <p className="text-xs text-slate-400 line-clamp-2">{preset.description}</p>
                                </div>
                            </div>

                            {/* Viral Potential Badge */}
                            <div className="mb-3">
                                {getViralPotentialBadge(preset.viralPotential)}
                            </div>

                            {/* Config Details */}
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Art Style:</span>
                                    <span className="text-slate-200 font-semibold">{preset.artStyle}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Pacing:</span>
                                    <span className={`font-semibold ${preset.pacingDefault === 'fast' ? 'text-green-400' : preset.pacingDefault === 'medium' ? 'text-yellow-400' : 'text-slate-400'}`}>
                                        {preset.pacingDefault.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-400">Tone:</span>
                                    <span className="text-purple-300 font-semibold">{preset.tonePreset}</span>
                                </div>
                            </div>

                            {/* Use Case */}
                            <div className="mt-3 pt-3 border-t border-slate-700">
                                <div className="text-xs text-slate-400">
                                    <div className="font-semibold text-slate-300 mb-1">Phù hợp:</div>
                                    <div className="line-clamp-2">{preset.useCase}</div>
                                </div>
                            </div>

                            {/* Target Audience */}
                            <div className="mt-2 text-xs">
                                <span className="text-slate-500">🎯 {preset.targetAudience}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Info Footer */}
            <div className="pt-4 border-t border-slate-700">
                <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex items-start gap-2">
                        <TrendingUp className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-400" />
                        <div>
                            <span className="font-semibold text-slate-300">TikTok Presets:</span> Tối ưu cho viral (hook 0-3s, reveal 20-25s, Gen Z relatable)
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Film className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
                        <div>
                            <span className="font-semibold text-slate-300">Legacy Presets:</span> Chất lượng cao cho YouTube/Film (artistic, slow-paced)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
