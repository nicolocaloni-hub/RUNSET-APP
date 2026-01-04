
import React from 'react';
import { Person } from '../types';
import { User, ChevronRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../App';

interface RunnerSelectionProps {
  runners: Person[];
  onSelect: (id: string) => void;
  onBack: () => void;
}

const RunnerSelection: React.FC<RunnerSelectionProps> = ({ runners, onSelect, onBack }) => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-6">
      <div className="w-full max-w-md">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white mb-8 transition-colors text-sm font-bold uppercase tracking-widest"
        >
          <ArrowLeft size={16} />
          {t('back')}
        </button>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-white mb-2">{t('who_are_you')}</h2>
          <p className="text-zinc-500 text-sm">{t('select_from_list')}</p>
        </div>

        <div className="space-y-3">
          {runners.length === 0 ? (
            <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-3xl">
              <p className="text-zinc-500 italic">{t('no_runners_config')}</p>
            </div>
          ) : (
            runners.map(runner => (
              <button
                key={runner.id}
                onClick={() => onSelect(runner.id)}
                className="w-full flex items-center justify-between p-5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center font-bold text-lg">
                    {runner.initials}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-zinc-200">{runner.name}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-widest">{runner.role}</div>
                  </div>
                </div>
                <ChevronRight size={20} className="text-zinc-700 group-hover:text-blue-500 transition-colors" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default RunnerSelection;
