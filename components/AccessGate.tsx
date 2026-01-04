
import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, Cpu } from 'lucide-react';
import { useLanguage } from '../App';

interface AccessGateProps {
  onUnlock: () => void;
}

const AccessGate: React.FC<AccessGateProps> = ({ onUnlock }) => {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [isError, setIsError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // CODICE MASTER PER L'ACCESSO ALL'APP
  const MASTER_CODE = '1984'; 

  const handleInput = (value: string) => {
    setIsError(false);
    const newCode = value.replace(/\D/g, '').slice(0, 4);
    setCode(newCode);

    if (newCode.length === 4) {
      setIsVerifying(true);
      setTimeout(() => {
        if (newCode === MASTER_CODE) {
          localStorage.setItem('runset_master_unlocked', 'true');
          onUnlock();
        } else {
          setIsError(true);
          setIsVerifying(false);
          setCode('');
        }
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-zinc-950 flex flex-col items-center justify-center p-8 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/20 via-transparent to-transparent"></div>
        <div className="grid grid-cols-8 gap-4 p-4">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="h-20 border border-zinc-800/30 rounded-lg"></div>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-12">
          <div className="inline-flex p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-yellow-500 mb-6 shadow-2xl">
            {isError ? <ShieldAlert size={40} className="animate-pulse text-red-500" /> : <Lock size={40} />}
          </div>
          <h1 className="text-2xl font-black tracking-[0.2em] text-white mb-2">{t('system_lock')}</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{t('authorized_only')}</p>
        </div>

        <div className="space-y-8">
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div 
                key={i}
                className={`w-14 h-20 border-2 rounded-2xl flex items-center justify-center text-3xl font-black transition-all duration-300 ${
                  isError ? 'border-red-500 text-red-500 animate-shake' : 
                  code[i] ? 'border-yellow-500 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'border-zinc-800 text-zinc-800'
                }`}
              >
                {code[i] ? '●' : ''}
              </div>
            ))}
          </div>

          <div className="text-center h-4">
            {isVerifying && (
              <p className="text-yellow-500 text-[10px] font-bold uppercase tracking-widest animate-pulse flex items-center justify-center gap-2">
                <Cpu size={12} className="animate-spin" />
                {t('verifying')}
              </p>
            )}
            {isError && (
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
                {t('access_denied')}
              </p>
            )}
            {!isVerifying && !isError && (
              <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                {t('enter_master_code')}
              </p>
            )}
          </div>

          <input
            autoFocus
            type="tel"
            pattern="[0-9]*"
            inputMode="numeric"
            value={code}
            onChange={(e) => handleInput(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-default"
          />
        </div>

        <div className="mt-20 flex justify-center opacity-20">
          <div className="text-[8px] text-zinc-500 font-mono space-y-1">
            <p>ENCRYPTED_STREAM_ACTIVE</p>
            <p>LOCAL_STORAGE_ONLY_MODE</p>
            <p>SECURE_SHELL_V2.4</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.15s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default AccessGate;
