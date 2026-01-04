
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../App';

interface IntroSplashProps {
  onFinish: () => void;
}

const IntroSplash: React.FC<IntroSplashProps> = ({ onFinish }) => {
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Fallback timer se il video non dovesse caricare o terminare
    const timeout = setTimeout(onFinish, 7500);
    return () => clearTimeout(timeout);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[999] bg-white flex flex-col items-center justify-center animate-out fade-out duration-1000 delay-[6500ms]">
      <div className="relative w-full max-w-lg aspect-video md:aspect-[9/16] overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onEnded={onFinish}
          className="w-full h-full object-contain"
        >
          <source src="https://streamable.com/e/98j56q?autoplay=1&muted=1" type="video/mp4" />
          {/* Nota: Sostituire l'URL sopra con il percorso effettivo del file video intro.mp4 */}
          <source src="intro.mp4" type="video/mp4" />
        </video>
      </div>

      <button
        onClick={onFinish}
        className="absolute bottom-12 px-6 py-2 bg-zinc-900/5 text-zinc-400 hover:bg-zinc-900/10 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all"
      >
        {t('skip')}
      </button>

      {/* Animazione del logo finale se il video è statico o come placeholder */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-0 animate-in fade-in duration-500 delay-[5500ms]">
         <h1 className="text-6xl font-black tracking-tighter text-black">RUNSET</h1>
      </div>
    </div>
  );
};

export default IntroSplash;
