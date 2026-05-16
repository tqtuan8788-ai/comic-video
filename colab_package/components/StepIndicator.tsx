import React from 'react';
import { AppStep } from '../types';
import { CheckCircle, Circle } from 'lucide-react';

interface Props {
  currentStep: AppStep;
}

const steps = [
  { id: AppStep.INPUT, label: 'Input' },
  { id: AppStep.ANALYSIS, label: 'Analyze' },
  { id: AppStep.CHARACTERS, label: 'Faces' }, // New Label
  { id: AppStep.SCENES, label: 'Breakdown' },
  { id: AppStep.STORYBOARD, label: 'Storyboard' },
  { id: AppStep.GENERATION, label: 'Generate' },
  { id: AppStep.PREVIEW, label: 'Preview' },
];

export const StepIndicator: React.FC<Props> = ({ currentStep }) => {
  return (
    <div className="flex items-center justify-between w-full max-w-5xl mx-auto mb-8 px-4 overflow-x-auto pb-4 sm:pb-0">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center min-w-fit">
          <div className={`flex items-center space-x-2 ${currentStep === step.id ? 'text-blue-400' : currentStep > step.id ? 'text-green-400' : 'text-slate-500'}`}>
            {currentStep > step.id ? (
              <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <Circle className={`w-5 h-5 sm:w-6 sm:h-6 ${currentStep === step.id ? 'fill-current opacity-20' : ''}`} />
            )}
            <span className="font-semibold text-sm sm:text-base hidden sm:inline">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className="mx-2 sm:mx-4 w-4 sm:w-8 h-[2px] bg-slate-700" />
          )}
        </div>
      ))}
    </div>
  );
};