import React from 'react';
import { ViralScore } from '../services/viralScoring';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Clock, Heart, Users, Share2, Volume2, Sparkles, RotateCcw } from 'lucide-react';

interface ViralScoreDisplayProps {
    score: ViralScore;
    compact?: boolean;
}

export const ViralScoreDisplay: React.FC<ViralScoreDisplayProps> = ({ score, compact = false }) => {
    const getScoreColor = (value: number): string => {
        if (value >= 7) return 'text-green-400';
        if (value >= 5) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreBgColor = (value: number): string => {
        if (value >= 7) return 'bg-green-500/20 border-green-500/40';
        if (value >= 5) return 'bg-yellow-500/20 border-yellow-500/40';
        return 'bg-red-500/20 border-red-500/40';
    };

    const getScoreIcon = (value: number) => {
        if (value >= 7) return <TrendingUp className="w-5 h-5" />;
        if (value >= 5) return <Zap className="w-5 h-5" />;
        return <TrendingDown className="w-5 h-5" />;
    };

    const dimensions = [
        { key: 'hookQuality', label: 'Hook (0-3s)', icon: <Zap className="w-4 h-4" />, value: score.dimensions.hookQuality },
        { key: 'pacing', label: 'Pacing/Reveal', icon: <Clock className="w-4 h-4" />, value: score.dimensions.pacing },
        { key: 'emotionalImpact', label: 'Emotional', icon: <Heart className="w-4 h-4" />, value: score.dimensions.emotionalImpact },
        { key: 'relatability', label: 'Relatability', icon: <Users className="w-4 h-4" />, value: score.dimensions.relatability },
        { key: 'memePotential', label: 'Meme/Viral', icon: <Sparkles className="w-4 h-4" />, value: score.dimensions.memePotential },
        { key: 'shareability', label: 'Shareability', icon: <Share2 className="w-4 h-4" />, value: score.dimensions.shareability },
        { key: 'audioQuality', label: 'Audio', icon: <Volume2 className="w-4 h-4" />, value: score.dimensions.audioQuality },
        { key: 'trendFit', label: 'Trend Fit', icon: <TrendingUp className="w-4 h-4" />, value: score.dimensions.trendFit },
        { key: 'loopability', label: 'Loopability', icon: <RotateCcw className="w-4 h-4" />, value: score.dimensions.loopability },
    ];

    if (compact) {
        return (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${getScoreBgColor(score.overall)}`}>
                <div className={`flex items-center gap-2 ${getScoreColor(score.overall)}`}>
                    {getScoreIcon(score.overall)}
                    <span className="text-2xl font-bold">{score.overall.toFixed(1)}</span>
                    <span className="text-sm opacity-70">/10</span>
                </div>
                <div className="text-sm text-slate-300">
                    {score.overall >= 7 ? '🔥 Viral Ready!' : score.overall >= 5 ? '⚡ Good potential' : '⚠️ Needs work'}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
            {/* Overall Score Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white mb-1">TikTok Viral Score</h3>
                    <p className="text-sm text-slate-400">Mục tiêu: ≥7.0/10 cho viral success</p>
                </div>
                <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border-2 ${getScoreBgColor(score.overall)}`}>
                    <div className={`flex items-center gap-2 ${getScoreColor(score.overall)}`}>
                        {getScoreIcon(score.overall)}
                        <span className="text-4xl font-bold">{score.overall.toFixed(1)}</span>
                        <span className="text-lg opacity-70">/10</span>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            <div className={`px-4 py-3 rounded-lg ${score.overall >= 7
                    ? 'bg-green-500/10 border border-green-500/30 text-green-200'
                    : score.overall >= 5
                        ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-200'
                        : 'bg-red-500/10 border border-red-500/30 text-red-200'
                }`}>
                <div className="flex items-start gap-2">
                    {score.overall >= 7 ? (
                        <>
                            <TrendingUp className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold">🔥 Viral Ready!</div>
                                <div className="text-sm opacity-90">Content này có tiềm năng viral cao cho TikTok. Share/save rate dự kiến +15%.</div>
                            </div>
                        </>
                    ) : score.overall >= 5 ? (
                        <>
                            <Zap className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold">⚡ Tiềm năng tốt, cần cải thiện</div>
                                <div className="text-sm opacity-90">Content khá ổn nhưng vẫn chưa đạt viral threshold. Xem gợi ý bên dưới.</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="font-semibold">⚠️ Cần cải thiện nhiều</div>
                                <div className="text-sm opacity-90">Content này khó viral trên TikTok. Viewers sẽ swipe away. Cần sửa hook/pacing.</div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Warnings */}
            {score.warnings.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-red-300 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Critical Issues
                    </h4>
                    <div className="space-y-1">
                        {score.warnings.map((warning, idx) => (
                            <div key={idx} className="text-sm text-red-200 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded">
                                {warning}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dimension Scores */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Chi tiết từng tiêu chí</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dimensions.map((dim) => (
                        <div key={dim.key} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                    {dim.icon}
                                    <span>{dim.label}</span>
                                </div>
                                <span className={`text-lg font-bold ${getScoreColor(dim.value)}`}>
                                    {dim.value.toFixed(1)}
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-2 bg-slate-700/50 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all ${dim.value >= 7 ? 'bg-green-500' : dim.value >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                    style={{ width: `${(dim.value / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Suggestions */}
            {score.suggestions.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Gợi ý cải thiện
                    </h4>
                    <div className="space-y-2">
                        {score.suggestions.map((suggestion, idx) => (
                            <div key={idx} className="text-sm text-slate-200 bg-blue-500/10 border border-blue-500/30 px-4 py-3 rounded-lg">
                                {suggestion}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">
                    Scoring dựa trên TikTok best practices: Hook 0-3s, Reveal 20-25s, Visual payoff, Gen Z relatability
                </p>
            </div>
        </div>
    );
};
