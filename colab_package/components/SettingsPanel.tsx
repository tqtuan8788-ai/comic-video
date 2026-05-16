import React, { useState, useEffect } from 'react';
import { Settings, Zap, TrendingUp, DollarSign, Activity, CheckCircle, AlertCircle, XCircle, Volume2, RefreshCw, UploadCloud, Trash2 } from 'lucide-react';
import { GEMINI_TTS_VOICE_DEFAULT, getGeminiTtsVoice, setGeminiTtsVoice } from '../services/ttsSettings';
import { ProviderConfig } from '../services/providerConfig';
import {
    checkOmniVoiceHealth,
    DEFAULT_OMNIVOICE_SETTINGS,
    fetchOmniVoiceOptions,
    fileToOmniVoiceReferenceSample,
    generateOmniVoiceAudio,
    getOmniVoiceSettings,
    OmniVoiceOption,
    OmniVoiceReferenceSample,
    OmniVoiceSettings,
    setOmniVoiceReferenceSample,
    setOmniVoiceSettings,
    splitTtsText,
    uploadOmniVoiceReferenceSample,
} from '../services/omniVoice';

/**
 * Provider configuration per PRD
 */
interface SettingsPanelProps {
    providers: ProviderConfig[];
    onUpdateProviders: (providers: ProviderConfig[]) => void;
    costPolicy: 'quality_first' | 'cost_saver' | 'speed_first';
    onSetCostPolicy: (policy: 'quality_first' | 'cost_saver' | 'speed_first') => void;
    useFreeOnly: boolean;
    onSetUseFreeOnly: (value: boolean) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    providers,
    onUpdateProviders,
    costPolicy,
    onSetCostPolicy,
    useFreeOnly,
    onSetUseFreeOnly,
}) => {
    const [editingProvider, setEditingProvider] = useState<string | null>(null);
    const [tempApiKey, setTempApiKey] = useState('');
    const [omniSettings, setOmniSettingsState] = useState<OmniVoiceSettings>(() => getOmniVoiceSettings());
    const [omniHealth, setOmniHealth] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
    const [omniVoices, setOmniVoices] = useState<OmniVoiceOption[]>([]);
    const [omniTestText, setOmniTestText] = useState('Cô gái đứng lặng trong con hẻm mưa... vì phía sau cô, có tiếng thở rất gần.');
    const [omniTestAudio, setOmniTestAudio] = useState<string>('');
    const [omniSample, setOmniSample] = useState<OmniVoiceReferenceSample | null>(null);
    const [omniCloneMessage, setOmniCloneMessage] = useState<string>('');
    const [omniBusy, setOmniBusy] = useState<'health' | 'voices' | 'sample' | 'clone' | 'test' | null>(null);
    const [omniError, setOmniError] = useState<string>('');

    const getHealthIcon = (status: 'healthy' | 'degraded' | 'down' | 'unknown' = 'unknown') => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'degraded':
                return <AlertCircle className="w-4 h-4 text-yellow-400" />;
            case 'down':
                return <XCircle className="w-4 h-4 text-red-400" />;
            default:
                return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const getHealthBadge = (status: 'healthy' | 'degraded' | 'down' | 'unknown' = 'unknown') => {
        switch (status) {
            case 'healthy':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/40">✓ Healthy</span>;
            case 'degraded':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">⚠ Degraded</span>;
            case 'down':
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">✗ Down</span>;
            default:
                return <span className="px-2 py-1 rounded text-xs font-semibold bg-slate-500/20 text-slate-400 border border-slate-500/40">? Unknown</span>;
        }
    };

    const handleToggleProvider = (id: string) => {
        const updated = providers.map((p) =>
            p.id === id ? { ...p, enabled: !p.enabled } : p
        );
        onUpdateProviders(updated);
    };

    const handleUpdateApiKey = (id: string, apiKey: string) => {
        const updated = providers.map((p) =>
            p.id === id ? { ...p, apiKey } : p
        );
        onUpdateProviders(updated);
        setEditingProvider(null);
        setTempApiKey('');
    };

    const handleUpdateProviderField = (id: string, changes: Partial<ProviderConfig>) => {
        const updated = providers.map((p) =>
            p.id === id || p.name === id ? { ...p, ...changes } : p
        );
        onUpdateProviders(updated);
    };

    const persistOmniSettings = (next: OmniVoiceSettings) => {
        setOmniSettingsState(next);
        setOmniVoiceSettings(next);
        handleUpdateProviderField('tts_free', {
            baseUrl: next.endpointUrl,
            ttsVoice: next.voiceProfileId,
            model: `omnivoice:${next.emotion}`,
        });
    };

    const patchOmniSettings = (patch: Partial<OmniVoiceSettings>) => {
        persistOmniSettings({ ...omniSettings, ...patch });
    };

    const handleChangePriority = (id: string, direction: 'up' | 'down') => {
        const index = providers.findIndex((p) => p.id === id);
        if (index === -1) return;

        const newProviders = [...providers];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newProviders.length) return;

        // Swap priorities
        const temp = newProviders[index].priority;
        newProviders[index].priority = newProviders[targetIndex].priority;
        newProviders[targetIndex].priority = temp;

        // Re-sort by priority
        newProviders.sort((a, b) => a.priority - b.priority);
        onUpdateProviders(newProviders);
    };

    // Group providers by type
    const textProviders = providers.filter((p) => p.type === 'llm' || p.type === 'text');
    const imageProviders = providers.filter((p) => p.type === 'image');
    const ttsProviders = providers.filter((p) => p.type === 'tts');

    const geminiVoiceOptions = [
        GEMINI_TTS_VOICE_DEFAULT,
        'Aoede',
        'Charon',
        'Kore',
        'Orus',
        'Puck',
        'Zephyr',
        '__custom__',
    ];

    const [geminiVoice, setGeminiVoice] = useState<string>(GEMINI_TTS_VOICE_DEFAULT);
    const [geminiVoiceCustom, setGeminiVoiceCustom] = useState<string>('');

    useEffect(() => {
        const current = getGeminiTtsVoice();
        if (geminiVoiceOptions.includes(current)) {
            setGeminiVoice(current);
            setGeminiVoiceCustom('');
        } else {
            setGeminiVoice('__custom__');
            setGeminiVoiceCustom(current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (geminiVoice === '__custom__') {
            setGeminiTtsVoice(geminiVoiceCustom);
        } else {
            setGeminiTtsVoice(geminiVoice);
        }
    }, [geminiVoice, geminiVoiceCustom]);

    const omniProvider = ttsProviders.find((p) => p.id === 'tts_free' || p.name === 'tts_free') || {
        id: 'tts_free',
        name: 'tts_free',
        type: 'tts' as const,
        baseUrl: omniSettings.endpointUrl,
        ttsVoice: omniSettings.voiceProfileId,
    };

    const runOmniHealth = async () => {
        setOmniBusy('health');
        setOmniError('');
        try {
            const result = await checkOmniVoiceHealth(omniSettings);
            setOmniHealth(result);
        } catch (error: any) {
            setOmniHealth({ ok: false, message: error?.message || 'Health check failed' });
        } finally {
            setOmniBusy(null);
        }
    };

    const loadOmniVoices = async () => {
        setOmniBusy('voices');
        setOmniError('');
        try {
            const voices = await fetchOmniVoiceOptions(omniSettings);
            setOmniVoices(voices);
            if (voices.length && !voices.some((v) => v.id === omniSettings.voiceProfileId)) {
                patchOmniSettings({ voiceProfileId: voices[0].id });
            }
        } catch (error: any) {
            setOmniError(error?.message || 'Không tải được danh sách voice.');
        } finally {
            setOmniBusy(null);
        }
    };

    const handleOmniSampleFile = async (file?: File | null) => {
        if (!file) return;
        setOmniBusy('sample');
        setOmniError('');
        setOmniCloneMessage('');
        try {
            if (!file.type.startsWith('audio/')) {
                throw new Error('Vui lòng chọn file audio mẫu (.wav, .mp3, .ogg, .m4a).');
            }
            if (file.size > 12 * 1024 * 1024) {
                throw new Error('Audio mẫu nên nhỏ hơn 12MB. Hãy cắt còn 10-30 giây giọng rõ, ít nhạc nền.');
            }
            const sample = await fileToOmniVoiceReferenceSample(file);
            setOmniSample(sample);
            setOmniVoiceReferenceSample(sample);
            setOmniCloneMessage('Đã nạp audio mẫu vào phiên hiện tại. Có thể Test OmniVoice ngay hoặc Upload/Learn để tạo voice profile nếu backend hỗ trợ clone.');
        } catch (error: any) {
            setOmniError(error?.message || 'Không nạp được audio mẫu.');
        } finally {
            setOmniBusy(null);
        }
    };

    const clearOmniSample = () => {
        setOmniSample(null);
        setOmniVoiceReferenceSample(null);
        setOmniCloneMessage('Đã xoá audio mẫu khỏi phiên hiện tại.');
    };

    const cloneOmniSample = async () => {
        if (!omniSample) {
            setOmniError('Chưa chọn audio mẫu để clone voice.');
            return;
        }
        setOmniBusy('clone');
        setOmniError('');
        setOmniCloneMessage('');
        try {
            const result = await uploadOmniVoiceReferenceSample(omniSample, omniSettings);
            if (result.voiceProfileId) {
                patchOmniSettings({ voiceProfileId: result.voiceProfileId });
            }
            setOmniCloneMessage(result.message);
        } catch (error: any) {
            setOmniError(error?.message || 'Upload/Learn voice thất bại.');
        } finally {
            setOmniBusy(null);
        }
    };

    const testOmniVoice = async () => {
        setOmniBusy('test');
        setOmniError('');
        setOmniTestAudio('');
        try {
            const audio = await generateOmniVoiceAudio(omniTestText, omniProvider, omniSettings);
            setOmniTestAudio(audio);
        } catch (error: any) {
            setOmniError(error?.message || 'Test voice thất bại.');
        } finally {
            setOmniBusy(null);
        }
    };

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-400" />
                    Multi-Provider Settings
                </h3>
                <p className="text-sm text-slate-400">
                    Cấu hình API providers, fallback order, và cost policy
                </p>
            </div>

            {/* Cost Policy */}
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-400" />
                    Cost Policy
                </h4>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => onSetCostPolicy('quality_first')}
                        className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${costPolicy === 'quality_first'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-1">
                            <Zap className="w-4 h-4" />
                            <span>Quality First</span>
                        </div>
                    </button>
                    <button
                        onClick={() => onSetCostPolicy('cost_saver')}
                        className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${costPolicy === 'cost_saver'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            <span>Cost Saver</span>
                        </div>
                    </button>
                    <button
                        onClick={() => onSetCostPolicy('speed_first')}
                        className={`px-4 py-3 rounded-lg text-sm font-semibold transition-all ${costPolicy === 'speed_first'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                    >
                        <div className="flex flex-col items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            <span>Speed First</span>
                        </div>
                    </button>
                </div>

                {/* Free Only Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={useFreeOnly}
                        onChange={(e) => onSetUseFreeOnly(e.target.checked)}
                        className="w-5 h-5 accent-blue-500"
                    />
                    <div>
                        <div className="text-sm font-semibold text-slate-200">Use Free Providers Only</div>
                        <div className="text-xs text-slate-400">Chỉ dùng Groq, OpenRouter free tiers, free TTS</div>
                    </div>
                </label>
            </div>

            {/* Text Providers */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Text Generation Providers</h4>
                {textProviders.map((provider, idx) => (
                    <div
                        key={provider.id || provider.name}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-3"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    checked={provider.enabled !== false}
                                    onChange={() => handleToggleProvider(provider.id || provider.name)}
                                    className="w-5 h-5 accent-blue-500"
                                />
                                <div>
                                    <div className="font-semibold text-white">{provider.name}</div>
                                    <div className="text-xs text-slate-400">
                                        Priority: #{provider.priority ?? '-'} • Model: {provider.model || provider.modelText || 'default'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {getHealthBadge(provider.healthStatus)}
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => handleChangePriority(provider.id || provider.name, 'up')}
                                        disabled={idx === 0}
                                        className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        onClick={() => handleChangePriority(provider.id || provider.name, 'down')}
                                        disabled={idx === textProviders.length - 1}
                                        className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* API Key */}
                        <div className="flex items-center gap-2">
                            {editingProvider === (provider.id || provider.name) ? (
                                <>
                                    <input
                                        type="password"
                                        value={tempApiKey}
                                        onChange={(e) => setTempApiKey(e.target.value)}
                                        placeholder="Enter API key"
                                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white"
                                    />
                                    <button
                                        onClick={() => handleUpdateApiKey(provider.id || provider.name, tempApiKey)}
                                        className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingProvider(null);
                                            setTempApiKey('');
                                        }}
                                        className="px-3 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-400">
                                        {provider.apiKey ? '••••••••••••' : 'No API key set'}
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingProvider(provider.id || provider.name);
                                            setTempApiKey(provider.apiKey || '');
                                        }}
                                        className="px-3 py-2 rounded bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
                                    >
                                        Edit
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Stats */}
                        {(provider as any).avgLatency !== undefined && (
                            <div className="flex items-center gap-4 text-xs text-slate-400">
                                <div className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    <span>Latency: {(provider as any).avgLatency}ms</span>
                                </div>
                                {(provider as any).avgCost !== undefined && (
                                    <div className="flex items-center gap-1">
                                        <DollarSign className="w-3 h-3" />
                                        <span>Cost: ${((provider as any).avgCost).toFixed(4)}/req</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Image Providers */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">Image Generation Providers</h4>
                {imageProviders.map((provider) => (
                    <div
                        key={provider.id || provider.name}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={provider.enabled !== false}
                                onChange={() => handleToggleProvider(provider.id || provider.name)}
                                className="w-5 h-5 accent-blue-500"
                            />
                            <div>
                                <div className="font-semibold text-white">{provider.name}</div>
                                <div className="text-xs text-slate-400">Model: {provider.model || provider.modelImage || 'default'}</div>
                            </div>
                        </div>
                        {getHealthBadge(provider.healthStatus)}
                    </div>
                ))}
            </div>

            {/* TTS Providers */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-300">TTS Providers</h4>

                <div className="bg-slate-900/60 border border-purple-700/40 rounded-lg p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                            <div className="font-semibold text-white flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-purple-300" />
                                OmniVoice / Voice Clone Studio
                            </div>
                            <div className="text-xs text-slate-400 max-w-2xl">
                                Tối ưu cho comic: clone voice một lần, TTS theo scene/chunk ngắn, tự sanitize tiếng Việt,
                                retry thông minh và cache audio để giảm lỗi.
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {omniHealth && (
                                <span className={`px-2 py-1 rounded text-xs font-semibold border ${omniHealth.ok ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-red-500/20 text-red-300 border-red-500/40'}`}>
                                    {omniHealth.ok ? 'Connected' : 'Down'}{omniHealth.latencyMs ? ` • ${omniHealth.latencyMs}ms` : ''}
                                </span>
                            )}
                            <button
                                onClick={runOmniHealth}
                                disabled={omniBusy !== null}
                                className="px-3 py-2 rounded bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50"
                            >
                                {omniBusy === 'health' ? 'Checking...' : 'Health'}
                            </button>
                        </div>
                    </div>

                    {omniHealth && (
                        <div className={`text-xs rounded px-3 py-2 border ${omniHealth.ok ? 'bg-green-500/10 text-green-200 border-green-500/30' : 'bg-red-500/10 text-red-200 border-red-500/30'}`}>
                            {omniHealth.message}
                        </div>
                    )}

                    <div className="grid md:grid-cols-4 gap-3">
                        <label className="space-y-1 md:col-span-2">
                            <span className="text-xs font-semibold text-slate-300">TTS Endpoint</span>
                            <input
                                value={omniSettings.endpointUrl}
                                onChange={(e) => patchOmniSettings({ endpointUrl: e.target.value })}
                                placeholder="http://localhost:7861/tts"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Voice Profile / Clone ID</span>
                            <input
                                value={omniSettings.voiceProfileId}
                                onChange={(e) => patchOmniSettings({ voiceProfileId: e.target.value })}
                                placeholder="narrator_female_01"
                                list="omnivoice-voices"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
                            />
                            <datalist id="omnivoice-voices">
                                {omniVoices.map((voice) => (
                                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                                ))}
                            </datalist>
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Health URL</span>
                            <input
                                value={omniSettings.healthUrl}
                                onChange={(e) => patchOmniSettings({ healthUrl: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Voices URL</span>
                            <div className="flex gap-2">
                                <input
                                    value={omniSettings.voicesUrl}
                                    onChange={(e) => patchOmniSettings({ voicesUrl: e.target.value })}
                                    className="min-w-0 flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                                />
                                <button
                                    onClick={loadOmniVoices}
                                    disabled={omniBusy !== null}
                                    className="px-3 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                                    title="Load voice clone profiles"
                                >
                                    <RefreshCw className={`w-4 h-4 ${omniBusy === 'voices' ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </label>
                        <label className="space-y-1 md:col-span-2">
                            <span className="text-xs font-semibold text-slate-300">Clone / Learn URL</span>
                            <input
                                value={omniSettings.cloneUrl}
                                onChange={(e) => patchOmniSettings({ cloneUrl: e.target.value })}
                                placeholder="/api/omnivoice/clone"
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Language</span>
                            <input
                                value={omniSettings.languageCode}
                                onChange={(e) => patchOmniSettings({ languageCode: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            />
                        </label>
                    </div>

                    <div className="grid md:grid-cols-4 gap-3">
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Emotion</span>
                            <select
                                value={omniSettings.emotion}
                                onChange={(e) => patchOmniSettings({ emotion: e.target.value as any })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            >
                                {['dramatic', 'suspense', 'warm', 'urgent', 'sad', 'neutral'].map((v) => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Speed: {omniSettings.speed.toFixed(2)}</span>
                            <input
                                type="range"
                                min="0.75"
                                max="1.35"
                                step="0.01"
                                value={omniSettings.speed}
                                onChange={(e) => patchOmniSettings({ speed: Number(e.target.value) })}
                                className="w-full"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Max chars/request</span>
                            <input
                                type="number"
                                value={omniSettings.maxCharsPerRequest}
                                onChange={(e) => patchOmniSettings({ maxCharsPerRequest: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            />
                        </label>
                        <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-300">Pause between chunks</span>
                            <input
                                type="number"
                                value={omniSettings.pauseMs}
                                onChange={(e) => patchOmniSettings({ pauseMs: Number(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                            />
                        </label>
                    </div>

                    <div className="grid sm:grid-cols-3 gap-3 text-xs text-slate-300">
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={omniSettings.cacheEnabled} onChange={(e) => patchOmniSettings({ cacheEnabled: e.target.checked })} className="accent-purple-500" />
                            Cache audio theo text/voice
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={omniSettings.trimSilence} onChange={(e) => patchOmniSettings({ trimSilence: e.target.checked })} className="accent-purple-500" />
                            Trim silence
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={omniSettings.normalizeVolume} onChange={(e) => patchOmniSettings({ normalizeVolume: e.target.checked })} className="accent-purple-500" />
                            Normalize volume
                        </label>
                    </div>

                    <div className="bg-purple-950/20 border border-purple-700/30 rounded-lg p-3 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                                <div className="text-sm font-semibold text-white">Audio mẫu cho voice clone</div>
                                <div className="text-xs text-slate-400">
                                    Chọn 10-30 giây giọng sạch, ít nhạc nền. File này được giữ trong phiên trình duyệt và gửi kèm request TTS; nút Upload/Learn dùng khi backend OmniVoice có endpoint clone.
                                </div>
                            </div>
                            <label className="inline-flex items-center gap-2 px-3 py-2 rounded bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 cursor-pointer">
                                <UploadCloud className="w-4 h-4" />
                                {omniBusy === 'sample' ? 'Loading...' : 'Chọn audio mẫu'}
                                <input
                                    type="file"
                                    accept="audio/*"
                                    className="hidden"
                                    onChange={(e) => handleOmniSampleFile(e.target.files?.[0])}
                                />
                            </label>
                        </div>
                        {omniSample && (
                            <div className="grid md:grid-cols-[1fr_auto] gap-3 items-center bg-slate-950/70 border border-slate-700 rounded-lg p-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="text-sm text-slate-100 truncate">{omniSample.name}</div>
                                    <div className="text-xs text-slate-400">{omniSample.mimeType} • {(omniSample.size / 1024 / 1024).toFixed(2)}MB</div>
                                    <audio controls src={omniSample.dataUri} className="h-9 w-full max-w-md" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={cloneOmniSample}
                                        disabled={omniBusy !== null}
                                        className="px-3 py-2 rounded bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
                                    >
                                        {omniBusy === 'clone' ? 'Uploading...' : 'Upload/Learn'}
                                    </button>
                                    <button
                                        onClick={clearOmniSample}
                                        disabled={omniBusy !== null}
                                        className="px-3 py-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                                        title="Xoá audio mẫu"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                        {omniCloneMessage && (
                            <div className="text-xs text-emerald-200 bg-emerald-500/10 border border-emerald-500/30 rounded px-3 py-2">
                                {omniCloneMessage}
                            </div>
                        )}
                    </div>

                    <div className="bg-slate-950/60 border border-slate-700 rounded-lg p-3 space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                                <div className="text-sm font-semibold text-white">Test voice clone</div>
                                <div className="text-xs text-slate-400">
                                    Pipeline sẽ tự chia thành {splitTtsText(omniTestText, omniSettings).length} request nhỏ; {omniSample ? 'đang gửi kèm audio mẫu.' : 'chưa có audio mẫu kèm theo.'}
                                </div>
                            </div>
                            <button
                                onClick={() => patchOmniSettings(DEFAULT_OMNIVOICE_SETTINGS)}
                                className="px-3 py-2 rounded bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                            >
                                Reset defaults
                            </button>
                        </div>
                        <textarea
                            value={omniTestText}
                            onChange={(e) => setOmniTestText(e.target.value)}
                            rows={2}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={testOmniVoice}
                                disabled={omniBusy !== null}
                                className="px-4 py-2 rounded bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 disabled:opacity-50"
                            >
                                {omniBusy === 'test' ? 'Generating...' : 'Test OmniVoice'}
                            </button>
                            {omniTestAudio && <audio controls src={omniTestAudio} className="h-9" />}
                        </div>
                        {omniError && (
                            <div className="text-xs text-red-200 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                                {omniError}
                            </div>
                        )}
                    </div>
                </div>

                <details className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 space-y-2">
                    <summary className="cursor-pointer font-semibold text-white">Legacy Gemini TTS voiceName</summary>
                    <div className="flex items-center justify-between gap-3 flex-wrap pt-3">
                        <div>
                            <div className="text-xs text-slate-400">Chỉ dùng khi provider TTS là Gemini.</div>
                        </div>
                        <select
                            value={geminiVoice}
                            onChange={(e) => setGeminiVoice(e.target.value)}
                            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                            {geminiVoiceOptions.map((v) => (
                                <option key={v} value={v}>
                                    {v === '__custom__' ? 'Custom…' : v}
                                </option>
                            ))}
                        </select>
                    </div>
                    {geminiVoice === '__custom__' && (
                        <input
                            value={geminiVoiceCustom}
                            onChange={(e) => setGeminiVoiceCustom(e.target.value)}
                            placeholder="Nhập voiceName (vd: Fenrir)"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                    )}
                </details>

                {ttsProviders.map((provider) => (
                    <div
                        key={provider.id || provider.name}
                        className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={provider.enabled !== false}
                                onChange={() => handleToggleProvider(provider.id || provider.name)}
                                className="w-5 h-5 accent-blue-500"
                            />
                            <div>
                                <div className="font-semibold text-white">{provider.name}</div>
                                <div className="text-xs text-slate-400">
                                    {provider.name.includes('Free') ? '🆓 Free tier' : '💰 Paid'}
                                </div>
                            </div>
                        </div>
                        {getHealthBadge(provider.healthStatus)}
                    </div>
                ))}
            </div>

            {/* Export config hint */}
            <div className="pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 text-center">
                    💡 Config tự động lưu vào .env.local. Fallback chains được áp dụng theo priority order.
                </p>
            </div>
        </div>
    );
};
