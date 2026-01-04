
import React, { useState } from 'react';
import { UserRole } from '../types';
import { ClipboardList, Truck, X, Lock, Globe } from 'lucide-react';
import { useLanguage } from '../App';

interface RoleSelectionProps {
  onSelect: (role: UserRole) => void;
}

const RoleSelection: React.FC<RoleSelectionProps> = ({ onSelect }) => {
  const { t, language, setLanguage } = useLanguage();
  const [showPasscode, setShowPasscode] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  const CORRECT_PASSCODE = '0508';

  const handlePasscodeChange = (value: string) => {
    setError(false);
    const newPasscode = value.replace(/\D/g, '').slice(0, 4);
    setPasscode(newPasscode);

    if (newPasscode.length === 4) {
      if (newPasscode === CORRECT_PASSCODE) {
        onSelect(UserRole.PRODUCER);
      } else {
        setError(true);
        setTimeout(() => setPasscode(''), 500);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 p-6 relative">
      {/* Language Switcher */}
      <div className="absolute top-8 right-8 flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-800 rounded-full shadow-xl">
        <button 
          onClick={() => setLanguage('it')}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${language === 'it' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          IT
        </button>
        <button 
          onClick={() => setLanguage('en')}
          className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${language === 'en' ? 'bg-yellow-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          EN
        </button>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-5xl font-extrabold tracking-tighter text-yellow-500 mb-2">{t('app_name')}</h1>
        <p className="text-zinc-400 font-medium uppercase tracking-widest text-[10px]">{t('app_subtitle')}</p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-center text-zinc-500 mb-8">{t('select_role')}</h2>
        
        <button 
          onClick={() => setShowPasscode(true)}
          className="w-full flex items-center justify-between p-6 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-xl group-hover:scale-110 transition-transform">
              <ClipboardList size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg text-zinc-200">{t('role_producer')}</div>
              <div className="text-xs text-zinc-500">{t('role_producer_desc')}</div>
            </div>
          </div>
          <Lock size={16} className="text-zinc-700" />
        </button>

        <button 
          onClick={() => onSelect(UserRole.RUNNER)}
          className="w-full flex items-center justify-between p-6 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl group-hover:scale-110 transition-transform">
              <Truck size={24} />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg text-zinc-200">{t('role_runner')}</div>
              <div className="text-xs text-zinc-500">{t('role_runner_desc')}</div>
            </div>
          </div>
        </button>
      </div>
      
      <p className="mt-12 text-zinc-700 text-[10px] font-bold uppercase tracking-widest">{t('version')}</p>

      {/* Passcode Modal Overlay */}
      {showPasscode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl relative">
            <button 
              onClick={() => { setShowPasscode(false); setPasscode(''); setError(false); }}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-yellow-500/10 text-yellow-500 rounded-full mb-4">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">{t('producer_access')}</h3>
              <p className="text-zinc-500 text-sm mt-1">{t('enter_passcode')}</p>
            </div>

            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <div 
                  key={i}
                  className={`w-12 h-16 border-2 rounded-xl flex items-center justify-center text-2xl font-bold transition-all ${
                    error ? 'border-red-500 animate-shake' : 
                    passcode[i] ? 'border-yellow-500 text-yellow-500 bg-yellow-500/5' : 'border-zinc-800 text-zinc-600'
                  }`}
                >
                  {passcode[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <input
              autoFocus
              type="tel"
              pattern="[0-9]*"
              inputMode="numeric"
              value={passcode}
              onChange={(e) => handlePasscodeChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-default"
            />

            {error && (
              <p className="text-center text-red-500 text-xs font-bold uppercase tracking-widest animate-in slide-in-from-top-1">
                {t('access_denied')}
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default RoleSelection;
