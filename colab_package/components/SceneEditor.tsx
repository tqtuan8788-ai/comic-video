import React, { useState } from 'react';
import { SceneFull, Character, ArtStyle } from '../types';
import { regenerateSceneImage, regenerateSceneAudio, replaceSceneImage, replaceSceneAudio } from '../services/manualEdit';
import { RefreshCw, Upload, Edit2, Check, X } from 'lucide-react';

interface Props {
    scene: SceneFull;
    characters: Character[];
    artStyle: ArtStyle;
    onUpdate: (updatedScene: SceneFull) => void;
}

export const SceneEditor: React.FC<Props> = ({ scene, characters, artStyle, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(scene.summary);
    const [isRegenerating, setIsRegenerating] = useState<'image' | 'audio' | null>(null);

    const handleRegenerateImage = async () => {
        setIsRegenerating('image');
        try {
            const newImage = await regenerateSceneImage(scene, characters, artStyle);
            onUpdate({ ...scene, generated_image_url: newImage });
        } catch (error) {
            console.error('Failed to regenerate image:', error);
            alert('Failed to regenerate image');
        } finally {
            setIsRegenerating(null);
        }
    };

    const handleRegenerateAudio = async () => {
        setIsRegenerating('audio');
        try {
            const newAudio = await regenerateSceneAudio(scene);
            onUpdate({ ...scene, generated_audio_url: newAudio });
        } catch (error) {
            console.error('Failed to regenerate audio:', error);
            alert('Failed to regenerate audio');
        } finally {
            setIsRegenerating(null);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const newImage = await replaceSceneImage(file);
            onUpdate({ ...scene, generated_image_url: newImage });
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Failed to upload image');
        }
    };

    const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const newAudio = await replaceSceneAudio(file);
            onUpdate({ ...scene, generated_audio_url: newAudio });
        } catch (error) {
            console.error('Failed to upload audio:', error);
            alert('Failed to upload audio');
        }
    };

    const handleSaveContent = () => {
        onUpdate({ ...scene, summary: editedContent });
        setIsEditing(false);
    };

    return (
        <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/50">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">Scene {scene.id}</h3>
                <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-300">{scene.type}</span>
            </div>

            {/* Content Editor */}
            <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-2">Content</label>
                {isEditing ? (
                    <div>
                        <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                            rows={3}
                        />
                        <div className="flex gap-2 mt-2">
                            <button
                                onClick={handleSaveContent}
                                className="px-3 py-1 bg-green-600 rounded text-white text-xs flex items-center gap-1 hover:bg-green-500"
                            >
                                <Check className="w-3 h-3" /> Save
                            </button>
                            <button
                                onClick={() => {
                                    setEditedContent(scene.summary);
                                    setIsEditing(false);
                                }}
                                className="px-3 py-1 bg-slate-700 rounded text-white text-xs flex items-center gap-1 hover:bg-slate-600"
                            >
                                <X className="w-3 h-3" /> Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start gap-2">
                        <p className="text-sm text-slate-300 flex-1">{scene.summary}</p>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="p-1 hover:bg-slate-700 rounded text-slate-400"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Image Controls */}
            <div className="mb-4">
                <label className="text-xs text-slate-400 block mb-2">Image</label>
                <div className="flex gap-2">
                    <button
                        onClick={handleRegenerateImage}
                        disabled={isRegenerating === 'image'}
                        className="flex-1 px-3 py-2 bg-blue-600 rounded text-white text-xs flex items-center justify-center gap-1 hover:bg-blue-500 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRegenerating === 'image' ? 'animate-spin' : ''}`} />
                        {isRegenerating === 'image' ? 'Regenerating...' : 'Regenerate AI'}
                    </button>
                    <label className="flex-1 px-3 py-2 bg-slate-700 rounded text-white text-xs flex items-center justify-center gap-1 hover:bg-slate-600 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        Upload New
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                </div>
            </div>

            {/* Audio Controls */}
            <div>
                <label className="text-xs text-slate-400 block mb-2">Audio</label>
                <div className="flex gap-2">
                    <button
                        onClick={handleRegenerateAudio}
                        disabled={isRegenerating === 'audio'}
                        className="flex-1 px-3 py-2 bg-purple-600 rounded text-white text-xs flex items-center justify-center gap-1 hover:bg-purple-500 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3 h-3 ${isRegenerating === 'audio' ? 'animate-spin' : ''}`} />
                        {isRegenerating === 'audio' ? 'Regenerating...' : 'Regenerate TTS'}
                    </button>
                    <label className="flex-1 px-3 py-2 bg-slate-700 rounded text-white text-xs flex items-center justify-center gap-1 hover:bg-slate-600 cursor-pointer">
                        <Upload className="w-3 h-3" />
                        Upload New
                        <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
                    </label>
                </div>
            </div>

            {/* Duration Slider */}
            <div className="mt-4">
                <label className="text-xs text-slate-400 block mb-2">
                    Duration: {scene.estimated_duration}s
                </label>
                <input
                    type="range"
                    min={1.5}
                    max={8}
                    step={0.5}
                    value={scene.estimated_duration}
                    onChange={(e) => onUpdate({ ...scene, estimated_duration: parseFloat(e.target.value) })}
                    className="w-full"
                />
            </div>
        </div>
    );
};
