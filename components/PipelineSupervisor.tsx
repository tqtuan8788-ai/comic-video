import React from 'react';
import { PipelineState, AppStep } from '../types';
import { ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface Props {
  state: PipelineState;
  supervisorEnabled: boolean;
  autoRun: boolean;
}

const stepLabels: Record<AppStep, string> = {
  [AppStep.INPUT]: 'Input',
  [AppStep.ANALYSIS]: 'Analysis',
  [AppStep.CHARACTERS]: 'Characters',
  [AppStep.SCENES]: 'Scenes',
  [AppStep.STORYBOARD]: 'Storyboard',
  [AppStep.GENERATION]: 'Assets',
  [AppStep.PREVIEW]: 'Preview'
};

export const PipelineSupervisor: React.FC<Props> = ({ state, supervisorEnabled, autoRun }) => {
  const getStatus = (step: AppStep) => {
    if (state.currentStep === step && state.isProcessing) return 'running';
    if (state.currentStep > step) return 'done';
    if (state.currentStep === step && state.error) return 'error';
    return 'pending';
  };

  return (
    <div className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-4 text-xs text-slate-200">
      <div className="flex items-center gap-2">
        <ShieldCheck className={`w-4 h-4 ${supervisorEnabled ? 'text-green-400' : 'text-slate-400'}`} />
        <span className="font-semibold">Supervisor</span>
        <span className="text-slate-400">| Auto-run: {autoRun ? 'on' : 'off'}</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.keys(stepLabels) as unknown as AppStep[]).map((step) => {
          const status = getStatus(step);
          return (
            <div key={step} className="flex items-center gap-1">
              {status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
              {status === 'done' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
              {status === 'pending' && <AlertTriangle className="w-3 h-3 text-slate-500" />}
              {status === 'error' && <AlertTriangle className="w-3 h-3 text-red-400" />}
              <span className={`${status === 'running' ? 'text-blue-300' : status === 'done' ? 'text-green-300' : status === 'error' ? 'text-red-300' : 'text-slate-400'}`}>
                {stepLabels[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
