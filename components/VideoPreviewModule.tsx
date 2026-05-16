import React, { useState, useEffect, useRef } from 'react';
import { SceneFull } from '../types';
import { Play, Pause, RefreshCw, Volume2, VolumeX, Download, Loader2, Video } from 'lucide-react';

interface Props {
    scenes: SceneFull[];
    onReset?: () => void;
    isGenerating?: boolean;
    onGenerate?: (scenes?: SceneFull[]) => void;
    skipTTS?: boolean;
    generationProgress?: number;
}

export const VideoPreviewModule: React.FC<Props> = ({ scenes, onReset }) => {
    const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
    const [hideEndingCtaSubtitles, setHideEndingCtaSubtitles] = useState(true);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const silentAudioCleanupRef = useRef<(() => void) | null>(null);
    const previousMuteStateRef = useRef(false);

    // Validate scene index to prevent out-of-bounds errors
    const safeIndex = Math.min(Math.max(0, currentSceneIndex), scenes.length - 1);
    const currentScene = scenes[safeIndex];

    const normalizeSubtitleText = (input: string) =>
        (input || '')
            // Fix common non-breaking spaces that break tokenization (shows only a few characters on canvas)
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    // Helper: Split text into CapCut-style short chunks (Max 6 words or punctuation split)
    const getKaraokeLines = (text: string) => {
        const normalized = normalizeSubtitleText(text);
        if (!normalized) return [];
        const words = normalized.split(' ').filter(Boolean);
        const chunks: string[] = [];
        let currentChunk: string[] = [];

        for (let i = 0; i < words.length; i++) {
            currentChunk.push(words[i]);

            // Check for punctuation at the end of the word
            const hasPunctuation = /[.,?!:;]$/.test(words[i]);

            // Break chunk if:
            // 1. It hits 6 words (CapCut style limit)
            // 2. It hits punctuation (Natural pause), unless it's too short (1-2 words)
            if (currentChunk.length >= 6 || (hasPunctuation && currentChunk.length > 2)) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [];
            }
        }
        // Push remaining words
        if (currentChunk.length > 0) chunks.push(currentChunk.join(' '));

        return chunks;
    };

    const karaokeLines = currentScene ? getKaraokeLines(currentScene.voiceover_text) : [];

    // Animation Loop
    const animate = () => {
        if (audioRef.current && !audioRef.current.paused) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration);
            drawCanvas();
        }
        requestRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        if (isPlaying) {
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
    }, [isPlaying, currentSceneIndex]);

    // Helper: Wrap Text for Canvas (Safety net for overflow)
    const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, stroke: boolean = false) => {
        const normalized = normalizeSubtitleText(text);
        if (!normalized) return;

        const breakLongToken = (token: string) => {
            const parts: string[] = [];
            let acc = '';
            for (const ch of token) {
                const next = acc + ch;
                if (ctx.measureText(next).width > maxWidth && acc) {
                    parts.push(acc);
                    acc = ch;
                } else {
                    acc = next;
                }
            }
            if (acc) parts.push(acc);
            return parts;
        };

        const rawWords = normalized.split(' ').filter(Boolean);
        const words: string[] = [];
        for (const w of rawWords) {
            if (ctx.measureText(w).width > maxWidth) {
                words.push(...breakLongToken(w));
            } else {
                words.push(w);
            }
        }

        let currentY = y;

        // Calculate total height to center vertically if it wraps
        const testLines = [];
        let testLine = '';
        for (let w of words) {
            const metrics = ctx.measureText(testLine + w + ' ');
            if (metrics.width > maxWidth && testLine !== '') {
                testLines.push(testLine);
                testLine = w + ' ';
            } else {
                testLine += w + ' ';
            }
        }
        testLines.push(testLine);

        // Adjust Start Y based on number of lines to keep it centered in its zone
        currentY = y - ((testLines.length - 1) * lineHeight) / 2;

        for (let i = 0; i < testLines.length; i++) {
            if (stroke) ctx.strokeText(testLines[i], x, currentY);
            ctx.fillText(testLines[i], x, currentY);
            currentY += lineHeight;
        }
    };

    // Canvas Drawing
    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas || !currentScene) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Draw Image (auto-rotate if model returns landscape)
        const img = new Image();
        img.src = currentScene.generated_image_url || '';

        if (img.complete && img.naturalHeight !== 0) {
          const targetW = 1080;
          const targetH = 1920;

          ctx.save();
          if (img.naturalWidth > img.naturalHeight) {
            // Rotate to portrait if landscape
            ctx.translate(targetW, 0);
            ctx.rotate(Math.PI / 2);
            const rotatedTargetW = targetH; // 1920
            const rotatedTargetH = targetW; // 1080
            const scale = Math.max(rotatedTargetW / img.naturalWidth, rotatedTargetH / img.naturalHeight);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            const dx = (rotatedTargetW - drawW) / 2;
            const dy = (rotatedTargetH - drawH) / 2;
            ctx.drawImage(img, dx, dy, drawW, drawH);
          } else {
            const scale = Math.max(targetW / img.naturalWidth, targetH / img.naturalHeight);
            const drawW = img.naturalWidth * scale;
            const drawH = img.naturalHeight * scale;
            const dx = (targetW - drawW) / 2;
            const dy = (targetH - drawH) / 2;
            ctx.drawImage(img, dx, dy, drawW, drawH);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, 1080, 1920);

          if (currentScene.status === 'error') {
              ctx.fillStyle = 'red';
              ctx.font = '40px Inter';
              ctx.textAlign = 'center';
              ctx.fillText("Generation Failed", 540, 960);
          } else if (currentScene.status === 'generating') {
              ctx.fillStyle = '#3b82f6';
              ctx.font = '40px Inter';
              ctx.textAlign = 'center';
              ctx.fillText("Generating...", 540, 960);
          }
        }

        // Safe zones
        const safeTop = 0.12 * 1920;  // ~10-12% from top
        const safeBottom = 0.22 * 1920; // leave ~20-22% from bottom

        // 2. Draw "On-Screen Text" (Headline / Hook) - TOP SAFE ZONE
        if (currentScene.storyboard?.on_screen_text && currentScene.type === 'HOOK') {
            ctx.save();
            const headlineText = currentScene.storyboard.on_screen_text;

            // Style for Headline
            ctx.font = '900 75px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const x = 540;
            const y = safeTop;
            const maxWidth = 900; // 1080 - padding

            // Shadow/Glow
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 20;

            // Thick Outline
            ctx.lineWidth = 15;
            ctx.strokeStyle = 'black';

            // Use wrapper helper
            wrapText(ctx, headlineText, x, y, maxWidth, 90, true);

            // Fill (Yellow or White)
            ctx.fillStyle = currentScene.type === 'HOOK' ? '#fbbf24' : 'white';
            // Re-draw fill over stroke
            wrapText(ctx, headlineText, x, y, maxWidth, 90, false);

            ctx.restore();
        }

        // 3. Draw Karaoke Subtitles (Voiceover) - BOTTOM SAFE ZONE (~20-22% above bottom)
        const shouldRenderSubtitles = subtitlesEnabled && !(hideEndingCtaSubtitles && currentScene.type === 'ENDING');

        const sceneDuration =
            Number.isFinite(duration) && duration > 0.05
                ? duration
                : Math.max(currentScene.estimated_duration || 0, 0.5);

        if (shouldRenderSubtitles && sceneDuration > 0 && currentScene.voiceover_text) {
            // Heuristic per-chunk timing with minimum hold to avoid cutting too fast
            const weights = karaokeLines.map((line) => Math.max(line.length, 12));
            const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;
            const leadIn = 0.15;
            const leadOut = 0.35;
            const minHold = 0.8; // seconds per chunk minimum

            let cumulative = 0;
            let activeLine = "";

            karaokeLines.forEach((line, idx) => {
                const weight = weights[idx];
                const start = (cumulative / totalWeight) * sceneDuration;
                const rawEnd = ((cumulative + weight) / totalWeight) * sceneDuration;
                const end = Math.max(rawEnd, start + minHold);

                if (currentTime >= start - leadIn && currentTime <= end + leadOut) {
                    activeLine = normalizeSubtitleText(line);
                }
                cumulative += weight;
            });

            // Fallback: pin last line near the end to avoid drop-off
            if (!activeLine && karaokeLines.length > 0 && currentTime >= sceneDuration - 0.3) {
                activeLine = normalizeSubtitleText(karaokeLines[karaokeLines.length - 1]);
            }

            if (activeLine) {
                ctx.save();
                ctx.font = 'bold 55px "Inter", sans-serif'; // Reduced size slightly for cleaner look
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                const x = 540;
                const y = 1920 - safeBottom;
                const maxWidth = 950; // Padding

                // Outline
                ctx.lineWidth = 10;
                ctx.lineJoin = 'round';
                ctx.strokeStyle = 'black';

                // Draw Wrapped Text
                wrapText(ctx, activeLine, x, y, maxWidth, 75, true);

                // Fill
                ctx.fillStyle = 'white';
                wrapText(ctx, activeLine, x, y, maxWidth, 75, false);

                ctx.restore();
            }
        }
    };

    useEffect(() => {
        if (!currentScene) return;

        const img = new Image();
        img.src = currentScene.generated_image_url || '';
        img.onload = () => drawCanvas();
    }, [currentSceneIndex, currentScene?.generated_image_url]);

    // Redraw immediately when subtitle visibility toggles change
    useEffect(() => {
        drawCanvas();
    }, [subtitlesEnabled, hideEndingCtaSubtitles]);

    // Pause previous audio when scene changes
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, [currentSceneIndex]);

    // Play audio for current scene with error handling
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleAudioEnd = () => {
            // Auto-advance when audio ends
            if (isPlaying && currentSceneIndex < scenes.length - 1) {
                setCurrentSceneIndex(prev => prev + 1);
                setCurrentTime(0);
            } else {
                setIsPlaying(false);
                if (isRendering) stopRendering(); // Stop rendering if video ends
            }
        };

        const handleAudioError = () => {
            console.warn(`[AUDIO] Failed to load for scene ${currentSceneIndex}, continuing without audio`);
            // Don't crash - just continue playing without audio
            // This allows the video to work even if TTS fails
            // If there's an error, we should still advance the scene after a delay
            if (isPlaying && currentSceneIndex < scenes.length - 1) {
                const timer = setTimeout(() => {
                    setCurrentSceneIndex(prev => prev + 1);
                    setCurrentTime(0);
                }, 3000); // 3s default for silent/errored scenes
                return () => clearTimeout(timer);
            } else {
                setIsPlaying(false);
                if (isRendering) stopRendering();
            }
        };

        // Clear previous audio source and listeners
        audio.removeAttribute('src');
        audio.removeEventListener('ended', handleAudioEnd);
        audio.removeEventListener('error', handleAudioError);

        // Load and play if valid audio
        if (currentScene?.generated_audio_url) {
            // Validate audio URL before setting
            if (currentScene.generated_audio_url.startsWith('data:audio/')) {
                audio.src = currentScene.generated_audio_url;
                audio.load(); // Ensure audio is loaded
                if (isPlaying) {
                    audio.play().catch(err => {
                        console.warn('[AUDIO] Playback failed:', err.message);
                        // If playback fails, treat it like an error and try to advance
                        handleAudioError();
                    });
                }
            } else {
                console.warn(`[AUDIO] Invalid audio URL for scene ${currentSceneIndex}, skipping`);
                // If invalid URL, treat as silent scene
                handleAudioError();
            }
        } else {
            // If no audio URL, treat as silent scene
            console.log(`[AUDIO] No audio URL for scene ${currentSceneIndex}, treating as silent.`);
            handleAudioError();
        }

        audio.addEventListener('ended', handleAudioEnd);
        audio.addEventListener('error', handleAudioError);
        return () => {
            audio.removeEventListener('ended', handleAudioEnd);
            audio.removeEventListener('error', handleAudioError);
        };
    }, [currentSceneIndex, isPlaying, scenes.length, currentScene?.generated_audio_url, isRendering]);

    const startRendering = () => {
        if (!canvasRef.current || scenes.length === 0 || isRendering) return;
        const AudioCtx = typeof window !== "undefined"
            ? (window.AudioContext || (window as any).webkitAudioContext)
            : null;
        if (!AudioCtx) {
            console.warn("This browser does not support AudioContext API required for recording.");
            return;
        }
        setIsRendering(true);
        setCurrentSceneIndex(0);
        setIsPlaying(true);

        recordedChunksRef.current = [];
        const stream = canvasRef.current.captureStream(30);

        if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();

        const dest = audioContextRef.current!.createMediaStreamDestination();
        destRef.current = dest;

        const audioElement = audioRef.current;
        if (audioElement) {
            previousMuteStateRef.current = audioElement.muted;
            audioElement.muted = false;
        }

        if (audioElement && audioElement.src) {
            silentAudioCleanupRef.current?.();
            silentAudioCleanupRef.current = null;
            if (!sourceNodeRef.current) {
                sourceNodeRef.current = audioContextRef.current!.createMediaElementSource(audioElement);
            } else {
                sourceNodeRef.current.disconnect();
            }
            sourceNodeRef.current.connect(dest);
        } else {
            sourceNodeRef.current?.disconnect();
            silentAudioCleanupRef.current?.();
            const osc = audioContextRef.current!.createOscillator();
            const gain = audioContextRef.current!.createGain();
            gain.gain.value = 0;
            osc.connect(gain).connect(dest);
            osc.start();
            silentAudioCleanupRef.current = () => {
                osc.stop();
                osc.disconnect();
                gain.disconnect();
            };
        }

        const tracks = dest.stream.getAudioTracks();
        if (tracks.length > 0) stream.addTrack(tracks[0]);

        if (isMuted) setIsMuted(false);

        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `viral_short_${Date.now()}.webm`;
            a.click();
            setIsRendering(false);
            setIsPlaying(false);
            if (audioElement) {
                audioElement.muted = previousMuteStateRef.current;
            }
            setIsMuted(previousMuteStateRef.current);
            previousMuteStateRef.current = false;
            silentAudioCleanupRef.current?.();
            silentAudioCleanupRef.current = null;
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
            }
            destRef.current = null;
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        if (audioElement && audioElement.src) {
            audioElement.play().catch(() => setIsPlaying(false));
        }
    };

    const stopRendering = () => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
    };

    if (scenes.length === 0) return <div className="text-white">No scenes to preview</div>;

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-140px)] gap-8 p-4">
            {/* Sidebar */}
            <div className="hidden lg:flex flex-col w-1/3 h-full bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 bg-slate-900 border-b border-slate-700">
                    <h3 className="text-white font-bold flex items-center"><Video className="w-4 h-4 mr-2" /> Scene List</h3>
                </div>
                <div className="overflow-y-auto p-2 space-y-2">
                    {scenes.map((s, i) => (
                        <div key={s.id ?? i} onClick={() => !isRendering && setCurrentSceneIndex(i)} className={`p-3 rounded flex gap-3 cursor-pointer ${currentSceneIndex === i ? 'bg-blue-900/40 border border-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                            <img src={s.generated_image_url} className="w-10 h-16 object-cover rounded bg-black" />
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-yellow-500 uppercase truncate mb-1">{s.storyboard?.on_screen_text}</div>
                                <div className="text-xs text-slate-300 line-clamp-2">{s.voiceover_text}</div>
                                {s.status === 'error' && <div className="text-[10px] text-red-500 font-bold">Generation Failed</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-grow flex items-center justify-center bg-black/50 rounded-xl relative">
                <div className="relative w-full max-w-[400px] aspect-[9/16] bg-black rounded-2xl shadow-2xl overflow-hidden border-4 border-slate-800">
                    <canvas ref={canvasRef} width={1080} height={1920} className="w-full h-full object-cover" />

                    {/* Subtitle Toggles */}
                    <div className="absolute left-3 top-3 z-20 space-y-2 bg-black/60 backdrop-blur rounded-xl p-3 border border-white/10">
                        <label className="flex items-center gap-3 text-white text-sm">
                            <input
                                type="checkbox"
                                checked={subtitlesEnabled}
                                onChange={(e) => setSubtitlesEnabled(e.target.checked)}
                                className="w-4 h-4 accent-blue-500"
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="font-semibold">Hiện subtitles</span>
                                <span className="text-[11px] text-slate-300">Bật/tắt toàn bộ phụ đề</span>
                            </div>
                        </label>
                        <label className="flex items-center gap-3 text-white text-sm">
                            <input
                                type="checkbox"
                                checked={hideEndingCtaSubtitles}
                                disabled={!subtitlesEnabled}
                                onChange={(e) => setHideEndingCtaSubtitles(e.target.checked)}
                                className="w-4 h-4 accent-blue-500 disabled:opacity-50"
                            />
                            <div className="flex flex-col leading-tight">
                                <span className="font-semibold">Ẩn sub ở ENDING CTA</span>
                                <span className="text-[11px] text-slate-300">Giấu sub cho cảnh comment/follow cuối</span>
                            </div>
                        </label>
                    </div>

                    {/* UI Controls Overlay */}
                    <div className={`absolute inset-0 z-10 flex flex-col justify-end p-6 transition-opacity ${isRendering ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="bg-black/60 backdrop-blur rounded-full p-2 flex items-center justify-between">
                            <button onClick={() => {
                                const hasAudio = !!(audioRef.current && audioRef.current.src);
                                if (!hasAudio) { setIsPlaying(false); return; }
                                setIsPlaying(!isPlaying);
                                if (audioRef.current && audioRef.current.src) isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => setIsPlaying(false));
                            }} className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform">
                                {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                            </button>
                            <span className="text-white text-xs font-mono">SCENE {currentSceneIndex + 1}/{scenes.length}</span>
                            <button onClick={() => setIsMuted(!isMuted)} className="p-3 text-white">
                                {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                            </button>
                        </div>
                    </div>

                    {/* Render Overlay */}
                    {isRendering && (
                        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center text-center p-6">
                            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                            <h3 className="text-xl text-white font-bold">Rendering Viral Video...</h3>
                            <p className="text-sm text-slate-400 mt-2">Recording Scene {currentSceneIndex + 1}</p>
                        </div>
                    )}

                    <audio
                        ref={audioRef}
                        muted={isMuted}
                        crossOrigin="anonymous"
                        onError={(e) => console.warn("[AUDIO] Load failed -  continuing without audio")}
                    />
                </div>

                {/* Action Buttons */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                    {onReset && (
                        <button onClick={onReset} disabled={isRendering} className="p-4 bg-slate-800 rounded-full text-white shadow-lg border border-slate-700 hover:bg-slate-700"><RefreshCw /></button>
                    )}
                    <button onClick={startRendering} disabled={isRendering} className={`p-4 rounded-full text-white shadow-lg border border-blue-500/50 ${isRendering ? 'bg-red-900' : 'bg-blue-600 hover:bg-blue-500'}`}><Download /></button>
                </div>
            </div>
        </div>
    );
};
