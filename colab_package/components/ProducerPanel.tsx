import React, { useState } from 'react';
import { SceneFull } from '../types';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getGeminiTtsVoice } from '../services/ttsSettings';

interface Props {
  scenes: SceneFull[];
  skipTTS: boolean;
  onFixImages: (scenes: SceneFull[]) => void;
  onFixAudio: (scenes: SceneFull[]) => void;
}

export const ProducerPanel: React.FC<Props> = ({ scenes, skipTTS, onFixImages, onFixAudio }) => {
  const [open, setOpen] = useState(true);
  const issues: string[] = [];
  const missingImages = scenes.filter(s => !s.generated_image_url);
  const missingAudio = skipTTS ? [] : scenes.filter(s => !s.generated_audio_url);
  const activeTtsVoiceName = getGeminiTtsVoice().trim();
  const activeTtsLanguageCode = 'vi-VN';
  const mismatchedAudio = skipTTS
    ? []
    : scenes.filter((s) => {
      if (!s.generated_audio_url) return false;
      const voice = (s.generated_audio_voiceName || '').trim();
      const lang = (s.generated_audio_languageCode || '').trim();
      // If metadata is missing, treat as "needs normalization" to avoid mixed voices.
      if (!voice || !lang) return true;
      return voice !== activeTtsVoiceName || lang !== activeTtsLanguageCode;
    });
  const badHooks = scenes.filter(s => !s.storyboard?.on_screen_text || s.storyboard.on_screen_text.split(/\s+/).length > 8);
  const badVoice = scenes.filter(s => !s.voiceover_text || s.voiceover_text.split(/\s+/).length > 24);
  const slowScenes = scenes.filter(s => s.estimated_duration > 3);
  const hasCTA = (s: SceneFull) => /(comment|bình luận|follow|theo dõi|chia sẻ|share|lưu|save)/i.test(
    `${s.voiceover_text} ${s.storyboard?.on_screen_text || ''}`
  );
  const missingCTA = scenes.filter(s => s.type === 'ENDING' && !hasCTA(s));
  const sceneErrors = scenes.filter(s => s.status === 'error');

  if (missingImages.length) issues.push(`Thiếu hình: ${missingImages.length} cảnh.`);
  if (missingAudio.length) issues.push(`Thiếu audio: ${missingAudio.length} cảnh.`);
  if (mismatchedAudio.length) issues.push(`Audio không đồng giọng (voice/lang mismatch): ${mismatchedAudio.length} cảnh.`);
  if (badHooks.length) issues.push(`Hook > 8 từ hoặc trống: ${badHooks.length} cảnh.`);
  if (badVoice.length) issues.push(`Voiceover trống hoặc >24 từ: ${badVoice.length} cảnh.`);
  if (slowScenes.length) issues.push(`Có ${slowScenes.length} cảnh dài >3s (pacing chậm).`);
  if (missingCTA.length) issues.push(`CTA yếu/thiếu ở cảnh kết: ${missingCTA.length} cảnh.`);
  if (sceneErrors.length) issues.push(`Trạng thái lỗi: ${sceneErrors.length} cảnh.`);

  const hasIssues = issues.length > 0;
  const suggestions = [];
  if (missingImages.length) suggestions.push('Nhấn "Sửa hình" để regenerate hình các cảnh thiếu.');
  if (missingAudio.length) suggestions.push('Nhấn "Sửa audio" để regenerate TTS cho cảnh thiếu.');
  if (mismatchedAudio.length) suggestions.push('Nhấn "Sửa audio" để normalize lại voice/lang cho các cảnh bị lệch.');
  if (badHooks.length) suggestions.push('Rút gọn hook <= 8 từ, dạng câu hỏi/drama, không spoil.');
  if (badVoice.length) suggestions.push('Điền voiceover sát nội dung gốc, tối đa ~20-24 từ.');
  if (slowScenes.length) suggestions.push('Cắt ngắn cảnh >3s hoặc split thành 2 beat để giữ watch time.');
  if (missingCTA.length) suggestions.push('Thêm CTA kép ở cảnh ENDING: comment lựa chọn + follow/save.');
  if (sceneErrors.length) suggestions.push('Chạy lại cảnh lỗi hoặc chỉnh storyboard trước khi generate.');

  const audioFixTargets = (() => {
    if (skipTTS) return [];
    const byId = new Map<number, SceneFull>();
    for (const s of missingAudio) byId.set(s.id, s);
    for (const s of mismatchedAudio) byId.set(s.id, s);
    return byId.size ? Array.from(byId.values()) : scenes;
  })();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-750"
      >
        <div className="flex items-center gap-2">
          {hasIssues ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <CheckCircle2 className="w-4 h-4 text-green-400" />}
          <span className="font-semibold">Producer review</span>
          {hasIssues && <span className="text-amber-300">({issues.length} cảnh cần chú ý)</span>}
        </div>
        <span className="text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="p-3 space-y-2 border-t border-slate-700">
          {hasIssues ? (
            <div className="space-y-1">
              {issues.map((i, idx) => (
                <div key={idx} className="text-slate-300">
                  • {i}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400">Không phát hiện vấn đề lớn.</div>
          )}
          {suggestions.length > 0 && (
            <div className="space-y-1 text-amber-200">
              {suggestions.map((s, idx) => (
                <div key={idx}>→ {s}</div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onFixImages(missingImages.length ? missingImages : scenes)}
              className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:border-slate-500"
            >
              Sửa hình
            </button>
            {!skipTTS && (
              <button
                onClick={() => onFixAudio(audioFixTargets)}
                className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs hover:border-slate-500"
              >
                Sửa audio
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
