import React, { useMemo, useState } from 'react';
import { SceneFull, StoryAnalysis, ArtStyle } from '../types';
import { buildVeoPromptPack, VeoPromptExportOptions, VeoAspectRatio, VeoClipDuration, VeoMotionIntensity } from '../services/veoPromptExport';
import { STYLE_PROMPTS } from '../prompts/artStyles';
import { Clipboard, Download, Sparkles, AlertTriangle } from 'lucide-react';

interface Props {
  scenes: SceneFull[];
  analysis: StoryAnalysis | null;
  artStyle: ArtStyle;
}

const downloadText = (filename: string, content: string, mime: string) => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const copyToClipboard = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const renderPromptPackAsText = (pack: ReturnType<typeof buildVeoPromptPack>) => {
  const lines: string[] = [];
  lines.push('VEO / FLOW PROMPT PACK');
  lines.push(`Version: ${pack.version}`);
  lines.push(`CreatedAt: ${pack.createdAt}`);
  lines.push('');
  lines.push('== GLOBAL DIRECTOR BIBLE ==');
  lines.push('');
  lines.push('[WORLD]');
  lines.push(pack.globalBible.world);
  lines.push('');
  lines.push('[CHARACTERS]');
  lines.push(pack.globalBible.characters);
  lines.push('');
  lines.push('[CINEMATOGRAPHY]');
  lines.push(pack.globalBible.cinematography);
  lines.push('');
  lines.push('[NEGATIVES]');
  lines.push(pack.globalBible.negatives);
  lines.push('');
  lines.push('== CLIPS ==');
  for (const clip of pack.clips) {
    lines.push('');
    lines.push(`--- ${clip.title} (${clip.clipId}) ---`);
    lines.push(`sceneIds: ${clip.sceneIds.join(', ')}`);
    lines.push('Inputs:');
    for (const input of clip.recommendedInputs) {
      if (input.kind === 'scene_image') lines.push(`- scene_image: Scene ${input.sceneId}`);
      if (input.kind === 'character_reference') lines.push(`- character_reference: ${input.name}`);
      if (input.kind === 'first_last_frames')
        lines.push(`- first_last_frames: first=Scene ${input.firstSceneId}, last=Scene ${input.lastSceneId}`);
    }
    lines.push('');
    lines.push('[PROMPT]');
    lines.push(clip.prompt);
    lines.push('');
    lines.push('[NEGATIVE PROMPT]');
    lines.push(clip.negativePrompt);
    if (clip.notes.length) {
      lines.push('');
      lines.push('[NOTES]');
      for (const n of clip.notes) lines.push(`- ${n}`);
    }
    if (clip.lint.length) {
      lines.push('');
      lines.push('[LINT]');
      for (const l of clip.lint) lines.push(`- ${l.level.toUpperCase()} ${l.code}: ${l.message}`);
    }
  }
  return lines.join('\n');
};

export const VeoPromptExportTab: React.FC<Props> = ({ scenes, analysis, artStyle }) => {
  const [aspectRatio, setAspectRatio] = useState<VeoAspectRatio>('9:16');
  const [clipDurationSec, setClipDurationSec] = useState<VeoClipDuration>(8);
  const [motionIntensity, setMotionIntensity] = useState<VeoMotionIntensity>('subtle');
  const [includeTimestampBeats, setIncludeTimestampBeats] = useState(true);
  const [includeTransitions, setIncludeTransitions] = useState(false);
  const [includeAudioNotes, setIncludeAudioNotes] = useState(false);
  const [useIngredients, setUseIngredients] = useState(true);
  const [strictDirectorMode, setStrictDirectorMode] = useState(true);
  const [safetyRewrite, setSafetyRewrite] = useState(true);
  const [anonymizeSubjects, setAnonymizeSubjects] = useState(true);
  const [subjectFromImageOnly, setSubjectFromImageOnly] = useState(true);
  const [useVisualPromptAnchor, setUseVisualPromptAnchor] = useState(true);
  const [busy, setBusy] = useState(false);
  const styleName = STYLE_PROMPTS[artStyle]?.name || String(artStyle);

  const options: VeoPromptExportOptions = {
    aspectRatio,
    clipDurationSec,
    motionIntensity,
    includeTimestampBeats,
    includeTransitions,
    includeAudioNotes,
    useIngredients,
    strictDirectorMode,
    safetyRewrite,
    anonymizeSubjects,
    subjectFromImageOnly,
    useVisualPromptAnchor
  };

  const pack = useMemo(() => {
    return buildVeoPromptPack({ scenes, analysis, artStyle, options });
  }, [scenes, analysis, artStyle, options]);

  const asText = useMemo(() => renderPromptPackAsText(pack), [pack]);
  const autoFlowText = useMemo(() => pack.clips.map((c) => c.prompt).join('\n\n'), [pack]);

  const hasScenes = scenes && scenes.length > 0;

  return (
    <div className="space-y-6">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              Veo / Flow Prompt Export
            </h2>
            <p className="text-sm text-slate-400 mt-2 max-w-3xl">
              Xuất prompt dạng “đạo diễn” để animate ảnh tĩnh thành clip Veo (thường 8s/clip), ưu tiên continuity (nhân vật/bối cảnh/đạo cụ) và
              camera grammar. Mặc định: không render chữ/subtitle trong khung hình.
            </p>
            <p className="text-xs text-slate-500 mt-1">Active style: {styleName}</p>
          </div>

          <div className="flex gap-2">
            <button
              disabled={!hasScenes || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await copyToClipboard(asText);
                  alert('Đã copy prompt pack');
                } finally {
                  setBusy(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Clipboard className="w-4 h-4" />
              Copy all
            </button>
            <button
              disabled={!hasScenes || busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await copyToClipboard(autoFlowText);
                  alert('Đã copy Auto Flow (.txt)');
                } finally {
                  setBusy(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Format: mỗi prompt cách nhau 1 dòng trắng (phù hợp Auto Flow extension)"
            >
              <Clipboard className="w-4 h-4" />
              Copy Auto Flow
            </button>
            <button
              disabled={!hasScenes}
              onClick={() => downloadText('veo_prompt_pack.json', JSON.stringify(pack, null, 2), 'application/json')}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 font-semibold hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
            <button
              disabled={!hasScenes}
              onClick={() => downloadText('veo_autoflow_prompts.txt', autoFlowText, 'text/plain')}
              className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 font-semibold hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              title="Import file .txt vào Auto Flow extension (mỗi prompt cách nhau 1 dòng trắng)"
            >
              <Download className="w-4 h-4" />
              Download Auto Flow
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-white">Cấu hình xuất</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
          <label className="space-y-1">
            <div className="text-slate-300 font-semibold">Aspect ratio</div>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="9:16">9:16 (Vertical)</option>
              <option value="16:9">16:9 (Horizontal)</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-slate-300 font-semibold">Clip duration</div>
            <select
              value={clipDurationSec}
              onChange={(e) => setClipDurationSec(Number(e.target.value) as any)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value={4}>4s</option>
              <option value={6}>6s</option>
              <option value={8}>8s</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-slate-300 font-semibold">Motion intensity</div>
            <select
              value={motionIntensity}
              onChange={(e) => setMotionIntensity(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100"
            >
              <option value="subtle">Subtle (ổn định, ít drift)</option>
              <option value="medium">Medium</option>
              <option value="strong">Strong (rủi ro drift cao hơn)</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeTimestampBeats}
              onChange={(e) => setIncludeTimestampBeats(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Timestamp beats</div>
              <div className="text-xs text-slate-400">Chia [00:00-..] để điều khiển nhịp kể chuyện trong 1 clip.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useIngredients}
              onChange={(e) => setUseIngredients(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Use ingredients (references)</div>
              <div className="text-xs text-slate-400">Gợi ý thêm ảnh tham chiếu nhân vật để giảm drift.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useVisualPromptAnchor}
              onChange={(e) => setUseVisualPromptAnchor(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Use image prompt anchor</div>
              <div className="text-xs text-slate-400">Dùng storyboard.visual_prompt để bám sát ảnh đã gen và chi tiết cảnh.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={subjectFromImageOnly}
              onChange={(e) => setSubjectFromImageOnly(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Subject from image only</div>
              <div className="text-xs text-slate-400">Do not name/identify characters inside the Veo prompt.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeTransitions}
              onChange={(e) => setIncludeTransitions(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Transition prompts</div>
              <div className="text-xs text-slate-400">Tạo prompt “first/last frame” giữa scene i→i+1.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={includeAudioNotes}
              onChange={(e) => setIncludeAudioNotes(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Audio notes (optional)</div>
              <div className="text-xs text-slate-400">Gợi ý ambience/SFX; khuyên dựng voiceover ngoài.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={strictDirectorMode}
              onChange={(e) => setStrictDirectorMode(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Director strict mode</div>
              <div className="text-xs text-slate-400">Ép micro-actions + continuity locks chặt hơn.</div>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-3">
        <h3 className="text-lg font-bold text-white">Safety / Compliance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={safetyRewrite}
              onChange={(e) => setSafetyRewrite(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Safety rewrite (recommended)</div>
              <div className="text-xs text-slate-400">Softens “world control” / conspiracy framing + adds fictional disclaimer.</div>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={anonymizeSubjects}
              onChange={(e) => setAnonymizeSubjects(e.target.checked)}
              className="w-4 h-4 accent-blue-500"
            />
            <div>
              <div className="text-slate-200 font-semibold">Anonymize subjects</div>
              <div className="text-xs text-slate-400">Use generic “fictional tycoon family” instead of real names in Subject.</div>
            </div>
          </label>
        </div>
      </div>

      {pack.lint.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            QC / Lint
          </h3>
          <div className="mt-3 space-y-2 text-sm">
            {pack.lint.slice(0, 12).map((i, idx) => (
              <div key={idx} className="text-amber-100">
                [{i.level.toUpperCase()}] {i.message}
              </div>
            ))}
            {pack.lint.length > 12 && <div className="text-xs text-amber-200/80">…và {pack.lint.length - 12} mục nữa (xem trong JSON).</div>}
          </div>
        </div>
      )}

      {!hasScenes ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center text-slate-300">
          Chưa có storyboard/scenes. Hãy tạo storyboard trước ở TikTok Mode.
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
          <h3 className="text-lg font-bold text-white">Prompt pack (preview)</h3>
          <pre className="whitespace-pre-wrap text-xs bg-slate-900 border border-slate-700 rounded-lg p-4 max-h-[520px] overflow-y-auto">
            {asText}
          </pre>
        </div>
      )}
    </div>
  );
};
