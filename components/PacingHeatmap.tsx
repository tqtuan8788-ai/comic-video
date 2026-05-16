import React from 'react';
import { PacingSegment } from '../services/viralScoring';
import { Clock, Zap, TrendingDown, AlertCircle } from 'lucide-react';

interface PacingHeatmapProps {
    segments: PacingSegment[];
    scenes: Array<{ id: number; type: 'HOOK' | 'BUILD' | 'REVEAL' | 'ENDING'; estimated_duration: number }>;
    compact?: boolean;
}

export const PacingHeatmap: React.FC<PacingHeatmapProps> = ({ segments, scenes, compact = false }) => {
    const totalDuration = segments.length > 0 ? segments[segments.length - 1].endTime : 0;

    const getSegmentColor = (speedRating: 'fast' | 'good' | 'slow'): string => {
        switch (speedRating) {
            case 'fast':
                return 'bg-green-500';
            case 'good':
                return 'bg-blue-500';
            case 'slow':
                return 'bg-red-500';
        }
    };

    const getSegmentBorderColor = (speedRating: 'fast' | 'good' | 'slow'): string => {
        switch (speedRating) {
            case 'fast':
                return 'border-green-400';
            case 'good':
                return 'border-blue-400';
            case 'slow':
                return 'border-red-400';
        }
    };

    const getSegmentTextColor = (speedRating: 'fast' | 'good' | 'slow'): string => {
        switch (speedRating) {
            case 'fast':
                return 'text-green-200';
            case 'good':
                return 'text-blue-200';
            case 'slow':
                return 'text-red-200';
        }
    };

    const getSegmentIcon = (speedRating: 'fast' | 'good' | 'slow') => {
        switch (speedRating) {
            case 'fast':
                return <Zap className="w-3 h-3" />;
            case 'good':
                return <Clock className="w-3 h-3" />;
            case 'slow':
                return <TrendingDown className="w-3 h-3" />;
        }
    };

    // Find key moments
    const hookScene = scenes.find(s => s.type === 'HOOK');
    const revealScene = scenes.find(s => s.type === 'REVEAL');
    const endingScene = scenes.find(s => s.type === 'ENDING');

    let hookTime = 0;
    let revealTime = 0;
    let endingTime = 0;
    let currentTime = 0;

    for (const scene of scenes) {
        if (scene.id === hookScene?.id) hookTime = currentTime;
        if (scene.id === revealScene?.id) revealTime = currentTime;
        if (scene.id === endingScene?.id) endingTime = currentTime;
        currentTime += scene.estimated_duration;
    }

    // Calculate optimal reveal window
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

    const revealInOptimalWindow = revealTime >= optimalRevealStart && revealTime <= optimalRevealEnd;

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                {segments.map((segment, idx) => (
                    <div
                        key={idx}
                        className={`flex-1 h-2 rounded ${getSegmentColor(segment.speedRating)}`}
                        title={`${segment.startTime}-${segment.endTime}s: ${segment.label}`}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">Pacing Heatmap</h3>
                    <p className="text-sm text-slate-400">Phân tích tốc độ timeline 0-{totalDuration}s</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span>Nhanh</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-blue-500" />
                        <span>Ổn</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-500" />
                        <span>Chậm</span>
                    </div>
                </div>
            </div>

            {/* Timeline visualization */}
            <div className="relative">
                {/* Timeline bar */}
                <div className="flex items-stretch h-16 rounded-lg overflow-hidden border border-slate-700">
                    {segments.map((segment, idx) => {
                        const widthPercent = ((segment.endTime - segment.startTime) / totalDuration) * 100;
                        return (
                            <div
                                key={idx}
                                className={`relative ${getSegmentColor(segment.speedRating)}/30 border-r ${getSegmentBorderColor(segment.speedRating)} flex items-center justify-center`}
                                style={{ width: `${widthPercent}%` }}
                            >
                                <div className={`text-xs font-semibold ${getSegmentTextColor(segment.speedRating)} flex flex-col items-center gap-1`}>
                                    {getSegmentIcon(segment.speedRating)}
                                    <span>{segment.label}</span>
                                    <span className="text-[10px] opacity-70">{segment.startTime}-{segment.endTime}s</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Key moment markers */}
                <div className="absolute -bottom-8 left-0 right-0 h-6 flex items-center">
                    {/* Hook marker */}
                    {hookScene && (
                        <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${(hookTime / totalDuration) * 100}%` }}
                        >
                            <div className="w-0.5 h-6 bg-purple-400" />
                            <div className="absolute top-6 -translate-x-1/2 text-xs text-purple-300 font-semibold whitespace-nowrap">
                                Hook
                            </div>
                        </div>
                    )}

                    {/* Reveal marker */}
                    {revealScene && (
                        <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${(revealTime / totalDuration) * 100}%` }}
                        >
                            <div className={`w-0.5 h-6 ${revealInOptimalWindow ? 'bg-yellow-400' : 'bg-orange-500'}`} />
                            <div className={`absolute top-6 -translate-x-1/2 text-xs font-semibold whitespace-nowrap ${revealInOptimalWindow ? 'text-yellow-300' : 'text-orange-400'}`}>
                                Reveal
                            </div>
                        </div>
                    )}

                    {/* Payoff marker */}
                    {endingScene && (
                        <div
                            className="absolute flex flex-col items-center"
                            style={{ left: `${(endingTime / totalDuration) * 100}%` }}
                        >
                            <div className="w-0.5 h-6 bg-pink-400" />
                            <div className="absolute top-6 -translate-x-1/2 text-xs text-pink-300 font-semibold whitespace-nowrap">
                                Payoff
                            </div>
                        </div>
                    )}
                </div>

                {/* Optimal reveal window indicator */}
                <div
                    className="absolute top-0 h-16 bg-yellow-500/10 border-l border-r border-yellow-500/40 pointer-events-none"
                    style={{
                        left: `${(optimalRevealStart / totalDuration) * 100}%`,
                        width: `${((optimalRevealEnd - optimalRevealStart) / totalDuration) * 100}%`,
                    }}
                >
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-yellow-400 font-semibold whitespace-nowrap">
                        Optimal Reveal Window
                    </div>
                </div>
            </div>

            {/* Spacing for markers */}
            <div className="h-8" />

            {/* Analysis */}
            <div className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-300">Phân tích</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {segments.map((segment, idx) => (
                        <div key={idx} className={`px-3 py-2 rounded-lg border ${segment.speedRating === 'slow' ? 'bg-red-500/10 border-red-500/30' : segment.speedRating === 'fast' ? 'bg-green-500/10 border-green-500/30' : 'bg-blue-500/10 border-blue-500/30'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-slate-300">{segment.startTime}-{segment.endTime}s</span>
                                <div className={`flex items-center gap-1 text-sm font-semibold ${getSegmentTextColor(segment.speedRating)}`}>
                                    {getSegmentIcon(segment.speedRating)}
                                    <span>{segment.label.toUpperCase()}</span>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                {segment.scenes.length} scene{segment.scenes.length > 1 ? 's' : ''}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reveal window check */}
            {revealScene && (
                <div className={`px-4 py-3 rounded-lg flex items-start gap-2 ${revealInOptimalWindow ? 'bg-green-500/10 border border-green-500/30 text-green-200' : 'bg-orange-500/10 border border-orange-500/30 text-orange-200'}`}>
                    {revealInOptimalWindow ? (
                        <>
                            <Zap className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold">✅ Reveal timing tối ưu!</div>
                                <div className="text-sm opacity-90">
                                    Reveal tại {revealTime}s nằm trong cửa sổ {optimalRevealStart}-{optimalRevealEnd}s. Phù hợp cho TikTok retention.
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold">⚠️ Reveal timing cần điều chỉnh</div>
                                <div className="text-sm opacity-90">
                                    Reveal tại {revealTime}s, nên di chuyển về {optimalRevealStart}-{optimalRevealEnd}s để tối ưu retention. Gen Z sẽ swipe nếu quá muộn.
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">
                    Pacing tối ưu: Hook 0-3s, Build nhanh, Reveal {optimalRevealStart}-{optimalRevealEnd}s, Payoff cuối video
                </p>
            </div>
        </div>
    );
};
