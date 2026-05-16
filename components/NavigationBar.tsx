import React from 'react';

interface NavItem {
  key: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'tiktok', label: 'TikTok Mode' },
  { key: 'presets', label: 'Presets' },
  { key: 'score', label: 'Score / Heatmap' },
  { key: 'storyboard', label: 'Storyboard' },
  { key: 'veo', label: 'Veo / Flow' },
  { key: 'voice', label: 'Voice Studio' },
  { key: 'settings', label: 'Settings / API' },
  { key: 'guide', label: 'Guide' },
];

interface Props {
  active?: string;
  onSelect?: (key: string) => void;
}

export const NavigationBar: React.FC<Props> = ({ active = 'tiktok', onSelect }) => {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onSelect?.(item.key)}
            className={`px-3 py-2 rounded-lg border transition-all ${isActive
                ? 'bg-blue-600 text-white border-blue-500 shadow-blue-900/40 shadow-sm'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-slate-500'
              }`}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};


