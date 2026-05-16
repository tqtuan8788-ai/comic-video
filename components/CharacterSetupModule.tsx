import React, { useRef, useEffect } from 'react';
import { StoryAnalysis, Character } from '../types';
import { User, ChevronRight, Camera, Save, Trash2 } from 'lucide-react';

interface Props {
  analysis: StoryAnalysis;
  onUpdateCharacters: (chars: Character[]) => void;
  onNext: () => void;
}

const STORAGE_KEY = 'comic_video_saved_faces';

export const CharacterSetupModule: React.FC<Props> = ({ analysis, onUpdateCharacters, onNext }) => {
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  // 1. Load saved faces on mount
  useEffect(() => {
    try {
      const savedFaces = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const updatedChars = analysis.characters.map(char => {
        // Simple name matching (fuzzy could be better, but exact match works for recurrent chars)
        if (savedFaces[char.name] && !char.reference_image) {
          return { ...char, reference_image: savedFaces[char.name] };
        }
        return char;
      });
      
      // Only update if changes detected
      const hasChanges = updatedChars.some((c, i) => c.reference_image !== analysis.characters[i].reference_image);
      if (hasChanges) {
        onUpdateCharacters(updatedChars);
      }
    } catch (e) {
      console.error("Failed to load saved faces", e);
    }
  }, []);

  useEffect(() => {
    if (!analysis.characters || analysis.characters.length === 0) {
      const fallbackChars: Character[] = [
        {
          name: 'Nhân vật chính',
          role: 'Protagonist',
          description: 'Thêm mô tả ngắn cho nhân vật chính.',
          reference_image: ''
        },
        {
          name: 'Nhân vật phụ',
          role: 'Supporting',
          description: 'Thêm mô tả ngắn cho nhân vật phụ.',
          reference_image: ''
        },
        {
          name: 'Phản diện / bí ẩn',
          role: 'Antagonist',
          description: 'Thêm mô tả cho nhân vật phản diện hoặc yếu tố bí ẩn.',
          reference_image: ''
        }
      ];
      onUpdateCharacters(fallbackChars);
    }
  }, [analysis.characters.length, onUpdateCharacters]);

  const handleButtonClick = (index: number) => {
    fileInputRefs.current[index]?.click();
  };
  
  const handleImageUpload = (index: number, file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const updatedChars = [...analysis.characters];
      const charName = updatedChars[index].name;
      
      updatedChars[index] = { ...updatedChars[index], reference_image: base64String };
      onUpdateCharacters(updatedChars);

      // Save to persistence
      try {
        const savedFaces = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        savedFaces[charName] = base64String;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savedFaces));
      } catch (e) {
        console.error("Failed to save face", e);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearCache = () => {
      localStorage.removeItem(STORAGE_KEY);
      alert("Saved faces cleared!");
  };

  const handleAddCharacter = () => {
    const newChar: Character = {
      name: `Nhân vật ${analysis.characters.length + 1}`,
      role: 'Supporting',
      description: 'Mô tả nhân vật bổ sung.',
      reference_image: ''
    };
    onUpdateCharacters([...(analysis.characters || []), newChar]);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 pb-20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 font-serif">Casting Call</h2>
        <p className="text-slate-400">Upload photos to assign real faces to your characters (Face ID).</p>
        <p className="text-xs text-slate-500 mt-2">Faces are automatically saved for your next video.</p>
      </div>

      <div className="flex justify-end px-4">
         <div className="flex items-center gap-4 text-xs">
           <button onClick={handleAddCharacter} className="text-slate-400 hover:text-white flex items-center gap-1">
             <Camera className="w-3 h-3" /> Thêm nhân vật
           </button>
           <button onClick={clearCache} className="text-slate-500 hover:text-red-400 flex items-center">
               <Trash2 className="w-3 h-3 mr-1"/> Clear Saved Faces
           </button>
         </div>
      </div>

      {(!analysis.characters || analysis.characters.length === 0) && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-300">
          Không phát hiện nhân vật từ bản phân tích. Bấm "Thêm nhân vật" để tạo slot mới hoặc quay lại bước trước để cập nhật phân tích.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(analysis.characters || []).map((char, idx) => (
          <div key={idx} className="bg-slate-800 rounded-xl p-6 border border-slate-700 flex flex-col items-center text-center shadow-lg relative">

            {/* Image Container */}
            <div className="w-32 h-32 rounded-full mb-4 overflow-hidden bg-slate-900 border-4 border-slate-600 relative shrink-0">
              {char.reference_image ? (
                <img src={char.reference_image} alt={char.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <User className="w-12 h-12" />
                </div>
              )}
            </div>

            {/* Hidden Input */}
            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={(el) => { fileInputRefs.current[idx] = el; }}
                onChange={(e) => {
                  if (e.target.files?.[0]) handleImageUpload(idx, e.target.files[0]);
                }}
            />

            {/* Explicit Button */}
            <button 
                onClick={() => handleButtonClick(idx)}
                className={`mb-4 px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center shadow-lg transform hover:scale-105 active:scale-95 ${
                    char.reference_image 
                    ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' 
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
            >
              <Camera className="w-4 h-4 mr-2" />
              {char.reference_image ? "Change Photo" : "Upload Photo"}
            </button>

            <h3 className="text-xl font-bold text-white">{char.name}</h3>
            <span className="text-xs text-amber-500 font-bold uppercase tracking-wider mb-2">{char.role}</span>
            <p className="text-sm text-slate-400 line-clamp-3 mb-4 italic">"{char.description}"</p>
            
            {char.reference_image ? (
               <div className="mt-auto pt-4 border-t border-slate-700/50 w-full">
                  <span className="text-green-400 text-xs flex items-center justify-center font-bold">
                    <Save className="w-3 h-3 mr-1" />
                    Face ID Saved
                  </span>
               </div>
            ) : (
               <div className="mt-auto pt-4 border-t border-slate-700/50 w-full">
                 <span className="text-slate-500 text-xs">AI generated face</span>
               </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 px-12 py-4 rounded-full font-bold text-lg flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-900/50 transition-all hover:scale-105 z-50"
      >
        Confirm Casting <ChevronRight className="ml-2" />
      </button>
    </div>
  );
};
