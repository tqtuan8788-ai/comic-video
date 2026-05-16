import React from 'react';

interface Props {
  logs: string[];
}

export const SupervisorLog: React.FC<Props> = ({ logs }) => {
  if (!logs.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 max-h-48 overflow-y-auto space-y-1">
      {logs.map((log, idx) => (
        <div key={idx} className="text-slate-300">
          • {log}
        </div>
      ))}
    </div>
  );
};
