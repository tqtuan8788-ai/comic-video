import React, { useState } from 'react';
import { SceneFull } from '../types';
import { Clipboard, Download } from 'lucide-react';

interface Props {
  scenes: SceneFull[];
}

export const ExportAssets: React.FC<Props> = ({ scenes }) => {
  const [downloading, setDownloading] = useState(false);
  const safeScenes = [...scenes].sort((a, b) => a.id - b.id);
  const script = safeScenes
    .map((s) => `Scene ${s.id}\nOn-screen: ${s.storyboard?.on_screen_text || ''}\nVoiceover: ${s.voiceover_text || s.summary}`)
    .join('\n\n');

  const jsonPayload = JSON.stringify(
    safeScenes.map((s) => ({
      id: s.id,
      on_screen_text: s.storyboard?.on_screen_text || '',
      voiceover_text: s.voiceover_text || s.summary,
      image_url: s.generated_image_url || '',
    })),
    null,
    2
  );

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('Copied to clipboard');
    } catch (e) {
      console.error('Copy failed', e);
      alert('Copy failed. Please copy manually.');
    }
  };

  const triggerDownload = (href: string, filename: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadUrlAsFile = async (url: string, filename: string) => {
    if (!url) return;
    if (url.startsWith('data:')) {
      triggerDownload(url, filename);
      return;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      triggerDownload(objectUrl, filename);
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    }
  };

  const downloadAllImages = async () => {
    const targets = safeScenes.filter((s) => !!s.generated_image_url);
    if (targets.length === 0) {
      alert('No images generated yet.');
      return;
    }
    setDownloading(true);
    try {
      for (const scene of targets) {
        const url = scene.generated_image_url as string;
        await downloadUrlAsFile(url, `scene-${scene.id}.png`);
        await new Promise((r) => setTimeout(r, 200));
      }
      alert(`Downloaded ${targets.length} images.`);
    } catch (e) {
      console.error('Download all images failed', e);
      alert('Download failed. Your browser may block multiple downloads; allow downloads and try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-900 text-slate-100 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Export scripts</h3>
            <p className="text-sm text-slate-400">Use this text in Canva or your NLE.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(script)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <Clipboard className="w-4 h-4" /> Copy script
            </button>
            <button
              onClick={() => copyToClipboard(jsonPayload)}
              className="px-3 py-2 bg-slate-700 text-slate-100 rounded-lg text-sm flex items-center gap-2"
            >
              <Clipboard className="w-4 h-4" /> Copy JSON
            </button>
            <button
              onClick={downloadAllImages}
              disabled={downloading}
              className="px-3 py-2 bg-slate-700 text-slate-100 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download all generated scene images"
            >
              <Download className="w-4 h-4" /> {downloading ? 'Downloading...' : 'Download all images'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {safeScenes.map((scene) => (
          <div key={scene.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-bold text-white">Scene {scene.id}</div>
              {scene.generated_image_url ? (
                <a
                  href={scene.generated_image_url}
                  download={`scene-${scene.id}.png`}
                  className="text-xs text-blue-300 flex items-center gap-1"
                >
                  <Download className="w-4 h-4" /> Download image
                </a>
              ) : (
                <span className="text-xs text-slate-500">No image generated</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mb-1">On-screen text</p>
            <p className="text-sm text-white font-semibold mb-2">{scene.storyboard?.on_screen_text || '—'}</p>
            <p className="text-xs text-slate-400 mb-1">Voiceover</p>
            <div className="flex items-start gap-2">
              <p className="text-sm text-slate-200 flex-1">{scene.voiceover_text || scene.summary}</p>
              <button
                onClick={() => copyToClipboard(scene.voiceover_text || scene.summary)}
                className="px-2 py-1 text-xs bg-slate-700 text-slate-100 rounded"
              >
                Copy
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
