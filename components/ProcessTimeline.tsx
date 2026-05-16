import React from 'react';
import { PipelineState, AppStep } from '../types';
import { CheckCircle2, Loader2, AlertTriangle, Clock3 } from 'lucide-react';

interface Props {
  state: PipelineState;
}

const steps: { step: AppStep; label: string }[] = [
  { step: AppStep.INPUT, label: 'Input' },
  { step: AppStep.ANALYSIS, label: 'Analysis' },
  { step: AppStep.CHARACTERS, label: 'Characters' },
  { step: AppStep.SCENES, label: 'Scenes' },
  { step: AppStep.STORYBOARD, label: 'Storyboard' },
  { step: AppStep.GENERATION, label: 'Assets' },
  { step: AppStep.PREVIEW, label: 'Preview' },
];

export const ProcessTimeline: React.FC<Props> = ({ state }) => {
  const sceneTotal = state.scenes.length;
  const sceneDone = state.scenes.filter(s => s.status === 'done').length;
  const sceneError = state.scenes.filter(s => s.status === 'error').length;

  const statusFor = (s: AppStep) => {
    if (state.currentStep === s && state.isProcessing) return 'running';
    if (state.currentStep > s) return 'done';
    if (state.currentStep === s && state.error) return 'error';
    return 'pending';
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-300">
        <Clock3 className="w-4 h-4 text-blue-400" />
        <span className="font-semibold">Process</span>
        <span className="text-slate-500">
          Scenes: {sceneDone}/{sceneTotal} {sceneError > 0 ? `| Error: ${sceneError}` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
        {steps.map(({ step, label }) => {
          const st = statusFor(step);
          return (
            <div
              key={step}
              className="flex items-center gap-2 px-3 py-2 rounded border border-slate-700 bg-slate-900"
            >
              {st === 'done' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
              {st === 'running' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
              {st === 'error' && <AlertTriangle className="w-4 h-4 text-red-400" />}
              {st === 'pending' && <AlertTriangle className="w-4 h-4 text-slate-500" />}
              <span className={st === 'running' ? 'text-blue-300' : st === 'done' ? 'text-green-300' : st === 'error' ? 'text-red-300' : 'text-slate-400'}>
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
