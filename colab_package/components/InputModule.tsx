import React, { useEffect, useState } from 'react';
import { FileText, Clipboard, Sparkles } from 'lucide-react';

interface Props {
  onNext: (text: string) => void;
  isLoading: boolean;
  desiredSceneCount: number;
  onSceneCountChange: (value: number) => void;
  autoSceneCount: boolean;
  onToggleAutoScene: (value: boolean) => void;
  allowRewriteForViral: boolean;
  onToggleRewrite: (value: boolean) => void;
  rawInput?: string;
}

export const InputModule: React.FC<Props> = ({
  onNext,
  isLoading,
  desiredSceneCount,
  onSceneCountChange,
  autoSceneCount,
  onToggleAutoScene,
  allowRewriteForViral,
  onToggleRewrite,
  rawInput
}) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (rawInput) {
      setText(rawInput);
    }
  }, [rawInput]);

  const handlePaste = async () => {
    try {
      const pasted = await navigator.clipboard.readText();
      setText(pasted);
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-slate-800 rounded-xl p-6 shadow-xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-4 flex items-center text-white">
        <FileText className="mr-2 text-blue-400" /> Input Content
      </h2>
      <p className="text-slate-400 mb-4">
        Paste your story, article, or draft below. We will normalize it and extract the narrative beats.
      </p>

      <div className="mb-6 bg-slate-900 border border-slate-700 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-sm text-slate-300">
          <span>Auto decide scene count (điều phối viên)</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSceneCount}
              onChange={(e) => onToggleAutoScene(e.target.checked)}
              className="accent-blue-500"
            />
            <span className="text-slate-200 font-medium">Auto</span>
          </label>
        </div>

        {/* DURATION CONTROL */}
        <div className="py-2 border-b border-slate-800 mb-2">
          <div className="text-sm text-slate-300 mb-2">Target Duration (ước lượng)</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => { onSceneCountChange(12); onToggleAutoScene(false); }}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${desiredSceneCount === 12 && !autoSceneCount ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
            >
              Short (~30s)
            </button>
            <button
              onClick={() => { onSceneCountChange(20); onToggleAutoScene(false); }}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${desiredSceneCount === 20 && !autoSceneCount ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
            >
              Medium (~60s)
            </button>
            <button
              onClick={() => { onSceneCountChange(40); onToggleAutoScene(false); }}
              className={`px-3 py-2 rounded text-sm font-medium transition-colors ${desiredSceneCount === 40 && !autoSceneCount ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'}`}
            >
              Long (~2m)
            </button>
          </div>
        </div>

        {!autoSceneCount && (
          <>
            <div className="flex items-center justify-between mb-2 text-sm text-slate-300">
              <span>Target scene count (Manual)</span>
              <span className="font-mono text-slate-200">{desiredSceneCount} scenes</span>
            </div>
            <input
              type="range"
              min={8}
              max={60}
              value={desiredSceneCount}
              onChange={(e) => onSceneCountChange(parseInt(e.target.value, 10))}
              className="w-full accent-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Range 8-60 cảnh; auto pacing 1.5-3s/cảnh.</p>
          </>
        )}
        <div className="flex items-center justify-between text-sm text-slate-300 pt-2 border-t border-slate-800">
          <span>Cho phép biên kịch lại để tối ưu viral</span>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allowRewriteForViral}
              onChange={(e) => onToggleRewrite(e.target.checked)}
              className="accent-purple-500"
            />
            <span className="text-slate-200 font-medium">Rewrite</span>
          </label>
        </div>
      </div>

      <div className="relative mb-6">
        <textarea
          className="w-full h-64 bg-slate-900 border border-slate-700 rounded-lg p-4 text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none transition-all"
          placeholder="Enter your content here (PDF content, article text, story draft)..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={handlePaste}
          className="absolute top-2 right-2 p-2 bg-slate-800 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
          title="Paste from clipboard"
        >
          <Clipboard className="w-4 h-4" />
        </button>
      </div>

      <button
        onClick={() => onNext(text)}
        disabled={!text.trim() || isLoading}
        className={`w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center transition-all ${!text.trim() || isLoading
            ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/50'
          }`}
      >
        {isLoading ? (
          <>Processing input...</>
        ) : (
          <>
            <Sparkles className="mr-2 w-5 h-5" /> Analyze & Normalize
          </>
        )}
      </button>
    </div>
  );
};
