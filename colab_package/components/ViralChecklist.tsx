import React, { useMemo } from 'react';
import { SceneFull } from '../types';
import { CheckCircle2, AlertTriangle, Timer, Flame, ListChecks, Sparkles } from 'lucide-react';

interface Props {
  scenes: SceneFull[];
}

const CTA_REGEX = /(comment|bình luận|follow|theo dõi|chia sẻ|share|lưu|save)/i;

export const ViralChecklist: React.FC<Props> = ({ scenes }) => {
  const stats = useMemo(() => {
    const total = scenes.length;
    const hooks = scenes.filter((s) => s.type === 'HOOK').length;
    const reveal = scenes.filter((s) => s.type === 'REVEAL').length;
    const endings = scenes.filter((s) => s.type === 'ENDING').length;
    const fastPacing = scenes.filter((s) => s.estimated_duration > 3).length;

    const longVoice = scenes.filter((s) => (s.voiceover_text || '').split(/\s+/).length > 24).length;
    const weakHooks = scenes.filter(
      (s) => !s.storyboard?.on_screen_text || s.storyboard.on_screen_text.split(/\s+/).length > 8
    ).length;
    const missingCTA = scenes.filter((s) => !CTA_REGEX.test(`${s.voiceover_text} ${s.storyboard?.on_screen_text || ''}`))
      .length;

    return {
      total,
      hooks,
      reveal,
      endings,
      fastPacing,
      longVoice,
      weakHooks,
      missingCTA,
    };
  }, [scenes]);

  const issues: string[] = [];
  if (stats.hooks === 0) issues.push('Chưa có cảnh HOOK (0-3s) để dừng cuộn.');
  if (stats.reveal === 0) issues.push('Thiếu cảnh REVEAL/Aha.');
  if (stats.endings === 0) issues.push('Thiếu cảnh ENDING/CTA.');
  if (stats.fastPacing > 0) issues.push(`Có ${stats.fastPacing} cảnh dài >3s (nguy cơ drop watch time).`);
  if (stats.longVoice > 0) issues.push(`Có ${stats.longVoice} voiceover >24 từ (giảm retention).`);
  if (stats.weakHooks > 0) issues.push(`Có ${stats.weakHooks} hook >8 từ hoặc trống (không đủ pattern interrupt).`);
  if (stats.missingCTA > 0) issues.push('Thiếu CTA rõ ràng (comment/follow/save/share).');

  const good = issues.length === 0;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 space-y-2">
      <div className="flex items-center gap-2">
        {good ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
        <span className="font-semibold">TikTok Viral Checklist</span>
        <span className="text-slate-400">| 3s hook • 1–3s/cảnh • CTA kép</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-1 text-slate-300">
          <Sparkles className="w-3 h-3 text-yellow-400" /> Hook: {stats.hooks}
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <Flame className="w-3 h-3 text-pink-400" /> Reveal: {stats.reveal}
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <ListChecks className="w-3 h-3 text-green-400" /> Ending/CTA: {stats.endings}
        </div>
        <div className="flex items-center gap-1 text-slate-300">
          <Timer className="w-3 h-3 text-blue-400" /> Cảnh &gt;3s: {stats.fastPacing}
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-1 text-amber-200">
          {issues.map((i, idx) => (
            <div key={idx}>→ {i}</div>
          ))}
        </div>
      ) : (
        <div className="text-green-300">Pass: Hook đủ mạnh, pacing nhanh, CTA hiện diện.</div>
      )}
    </div>
  );
};

