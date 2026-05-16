import React from 'react';
import { SceneFull } from '../types';
import { Palette, User, MessageSquare, Zap, Eye, Wind, Target, Film, Type, Music } from 'lucide-react';

interface Props {
  scenes: SceneFull[];
  onGenerate: () => void;
  onOpenStoryboard?: () => void;
  isProcessing: boolean;
}

export const StoryboardModule: React.FC<Props> = ({ scenes, onGenerate, onOpenStoryboard, isProcessing }) => {
  
  const getTypeColor = (type?: string) => {
      switch(type) {
          case 'HOOK': return 'bg-red-600 text-white';
          case 'REVEAL': return 'bg-purple-600 text-white';
          case 'ENDING': return 'bg-blue-600 text-white';
          default: return 'bg-slate-700 text-slate-300';
      }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-white font-sans">Viral TikTok Storyboard</h2>
           <p className="text-slate-400 text-sm mt-1">High retention structure - Fast pacing - Cinematic</p>
        </div>
        <div className="flex items-center gap-2">
          {onOpenStoryboard && (
            <button
              onClick={onOpenStoryboard}
              className="bg-slate-800 px-4 py-2 rounded-full text-sm text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
              type="button"
            >
              Edit Script
            </button>
          )}
          <div className="bg-slate-800 px-4 py-2 rounded-full text-sm text-slate-200 border border-slate-700">
            {scenes.length} Shots
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {scenes.map((scene) => (
          <div key={scene.id} className="bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex flex-col h-full shadow-lg hover:border-blue-500/50 transition-all relative">
            
            {/* Header: Structure Tag */}
            <div className="bg-slate-950 p-3 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${getTypeColor(scene.type)}`}>
                        {scene.type || 'BUILD'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                        {scene.storyboard?.shot?.toUpperCase?.() || 'SHOT'}
                    </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                    ~{scene.estimated_duration}s
                </div>
            </div>
            
            <div className="p-4 flex-grow space-y-4">
               
               {/* Visual Description */}
               <div>
                   <h4 className="text-slate-400 font-bold text-[10px] uppercase mb-1 flex items-center">
                       <Film className="w-3 h-3 mr-1" /> Visual Action
                   </h4>
                   <p className="text-slate-200 text-sm font-medium leading-relaxed">
                       {scene.storyboard?.action}
                   </p>
               </div>

               {/* ON SCREEN TEXT (Headline) */}
               <div className="bg-slate-800/50 p-3 rounded border-l-4 border-yellow-500">
                   <h5 className="text-yellow-500 text-[10px] uppercase font-bold mb-1 flex items-center">
                        <Type className="w-3 h-3 mr-1" /> On-Screen Text
                   </h5>
                   <p className="text-white text-lg font-black uppercase tracking-tight leading-none">
                       "{scene.storyboard?.on_screen_text}"
                   </p>
               </div>

               {/* Sound Effect */}
               {scene.storyboard?.sound_effect && (
                    <div className="flex items-center text-xs text-pink-400">
                        <Music className="w-3 h-3 mr-2" />
                        <span className="uppercase font-bold">{scene.storyboard.sound_effect}</span>
                    </div>
               )}

               {/* Voiceover Script */}
               <div className="pt-3 border-t border-slate-800">
                    <div className="flex items-start">
                        <MessageSquare className="w-4 h-4 text-blue-500 mr-2 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-100 italic leading-relaxed">"{scene.voiceover_text}"</p>
                    </div>
               </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onGenerate}
        disabled={isProcessing}
        className="sticky bottom-6 w-full max-w-md mx-auto py-4 rounded-full font-bold text-lg flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-900/50 transform hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed z-50"
      >
        {isProcessing ? (
           <>
             <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
             Generating Viral Video...
           </>
        ) : (
            'Generate Video Assets'
        )}
      </button>
    </div>
  );
};
