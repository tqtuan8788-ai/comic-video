import React from 'react';
import { ArtStyle } from '../types';
import { STYLE_PROMPTS } from '../prompts/artStyles';

interface Props {
    selectedStyle: ArtStyle;
    onChange: (style: ArtStyle) => void;
}

export const ArtStyleSelector: React.FC<Props> = ({ selectedStyle, onChange }) => {
    const styles = Object.values(ArtStyle);

    return (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <label className="block text-sm font-medium text-slate-300 mb-3">
                Art Style (applies to all images)
            </label>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {styles.map((style) => {
                    const config = STYLE_PROMPTS[style];
                    const isSelected = selectedStyle === style;

                    return (
                        <button
                            key={style}
                            onClick={() => onChange(style)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                    ? 'border-purple-500 bg-purple-900/30'
                                    : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                                }`}
                        >
                            <div className="text-sm font-bold text-white mb-1">
                                {config.name}
                            </div>
                            <div className="text-xs text-slate-400 line-clamp-2">
                                {config.positive.split(',')[0]}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Selected Style Details */}
            <div className="mt-4 p-3 bg-slate-900 rounded-lg">
                <h4 className="text-xs font-bold text-purple-300 mb-2">Current Style:</h4>
                <p className="text-sm text-white font-medium mb-2">{STYLE_PROMPTS[selectedStyle].name}</p>
                <p className="text-xs text-slate-400">
                    {STYLE_PROMPTS[selectedStyle].positive.substring(0, 150)}...
                </p>
            </div>
        </div>
    );
};
