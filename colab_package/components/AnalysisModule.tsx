import React from 'react';
import { StoryAnalysis, NormalizedInput } from '../types';
import { Brain, Users, Lightbulb, ListChecks, ChevronRight, FileText } from 'lucide-react';

interface Props {
  analysis: StoryAnalysis;
  normalized?: NormalizedInput | null;
  isProcessing: boolean;
  onNext: () => void;
}

export const AnalysisModule: React.FC<Props> = ({ analysis, normalized, isProcessing, onNext }) => {
  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Lightbulb className="text-yellow-400" /> Theme & Idea
          </h3>
          <p className="text-lg font-medium text-slate-200 mb-4">{analysis.theme}</p>

          {normalized?.clean_text && (
            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                <FileText className="w-4 h-4" />
                Normalized input
              </div>
              <p className="text-slate-300 text-sm leading-relaxed line-clamp-4">{normalized.clean_text}</p>
            </div>
          )}
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Users className="text-pink-400" /> Characters
          </h3>
          <div className="space-y-4 overflow-y-auto max-h-[260px] pr-2">
            {analysis.characters?.map((char, idx) => (
              <div key={idx} className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-200">{char.name}</h4>
                  <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">{char.role}</span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{char.description}</p>
              </div>
            ))}
            {analysis.characters?.length === 0 && (
              <p className="text-sm text-slate-500">No characters detected from the input.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Brain className="text-green-400" /> Hooks & Plot Points
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <ListChecks className="w-4 h-4" /> Hooks
            </div>
            <ul className="list-disc list-inside text-slate-300 space-y-1">
              {(analysis.hooks?.length ? analysis.hooks : ['No hooks detected yet.']).map((hook, i) => (
                <li key={i}>{hook}</li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
              <ListChecks className="w-4 h-4" /> Plot points
            </div>
            <ul className="list-disc list-inside text-slate-300 space-y-1">
              {(analysis.plot_points?.length ? analysis.plot_points : ['No plot points extracted.']).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={isProcessing}
        className="w-full py-4 rounded-lg font-bold text-lg flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Preparing next step...' : (
          <>
            Continue to characters <ChevronRight className="ml-2" />
          </>
        )}
      </button>
    </div>
  );
};
