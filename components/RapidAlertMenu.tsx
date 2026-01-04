
import React, { useState } from 'react';
import { TrafficCone, AlertCircle, Fuel, X, MessageCircle, Phone } from 'lucide-react';
import { NotificationService, AlertType } from '../services/NotificationService';
import { useLanguage } from '../App';

interface RapidAlertMenuProps {
  runnerName: string;
  producerPhone?: string;
}

const RapidAlertMenu: React.FC<RapidAlertMenuProps> = ({ runnerName, producerPhone }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showEmergencyChoice, setShowEmergencyChoice] = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  const alerts: { type: AlertType; icon: React.ReactNode; color: string; labelKey: any }[] = [
    { type: 'TRAFFICO', icon: <TrafficCone size={20} />, color: 'bg-red-500', labelKey: 'traffic' },
    { type: 'IMPREVISTO', icon: <AlertCircle size={20} />, color: 'bg-orange-500', labelKey: 'emergency' },
    { type: 'PAUSA BENZINA', icon: <Fuel size={20} />, color: 'bg-blue-500', labelKey: 'fuel' },
  ];

  const handleSendAlert = (type: AlertType) => {
    NotificationService.sendRunnerAlert(runnerName, type);
    setLastSent(t(alerts.find(a => a.type === type)?.labelKey || 'emergency'));
    setIsOpen(false);
    
    if (type === 'IMPREVISTO') {
      setShowEmergencyChoice(true);
    }

    setTimeout(() => setLastSent(null), 3000);
  };

  const handleWhatsApp = () => {
    if (!producerPhone) return;
    const message = encodeURIComponent(t('whatsapp_msg', { name: runnerName }));
    window.open(`https://wa.me/${producerPhone.replace(/\s+/g, '')}?text=${message}`, '_blank');
    setShowEmergencyChoice(false);
  };

  const handleCall = () => {
    if (!producerPhone) return;
    window.location.href = `tel:${producerPhone.replace(/\s+/g, '')}`;
    setShowEmergencyChoice(false);
  };

  return (
    <>
      <div className="fixed top-4 right-4 z-30 flex flex-col items-end gap-3">
        {/* Feedback "Inviato" */}
        {lastSent && (
          <div className="bg-white text-black px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-right-4">
            {t('alert_sent', { type: lastSent })}
          </div>
        )}

        {/* Tasto Master */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 border-2 ${
            isOpen 
              ? 'bg-zinc-900 border-zinc-700 text-white rotate-90' 
              : 'bg-yellow-500 border-yellow-400 text-black'
          }`}
        >
          {isOpen ? <X size={24} /> : <span className="text-2xl leading-none">⚠️</span>}
        </button>

        {/* Menu Espandibile */}
        {isOpen && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
            {alerts.map((alert, idx) => (
              <button
                key={alert.type}
                onClick={() => handleSendAlert(alert.type)}
                style={{ transitionDelay: `${idx * 50}ms` }}
                className="flex items-center gap-3 group animate-in slide-in-from-top-2"
              >
                <span className="bg-zinc-900/90 text-zinc-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-lg border border-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t(alert.labelKey)}
                </span>
                <div className={`w-12 h-12 ${alert.color} text-white rounded-full flex items-center justify-center shadow-xl border-2 border-white/20 active:scale-90 transition-transform`}>
                  {alert.icon}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Emergency Choice Modal */}
      {showEmergencyChoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-orange-500" />
            
            <button 
              onClick={() => setShowEmergencyChoice(false)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="inline-flex p-4 bg-orange-500/10 text-orange-500 rounded-full mb-4">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">{t('emergency_reported')}</h3>
              <p className="text-zinc-500 text-sm mt-2">{t('emergency_desc')}</p>
            </div>

            <div className="space-y-4">
              <button 
                onClick={handleWhatsApp}
                className="w-full flex items-center justify-between p-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl transition-all active:scale-95 group shadow-lg shadow-emerald-900/20"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <MessageCircle size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{t('send_whatsapp')}</div>
                    <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">{t('whatsapp_desc')}</div>
                  </div>
                </div>
              </button>

              <button 
                onClick={handleCall}
                className="w-full flex items-center justify-between p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl transition-all active:scale-95 group shadow-lg shadow-blue-900/20"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <Phone size={24} />
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{t('call_now')}</div>
                    <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">{t('call_desc')}</div>
                  </div>
                </div>
              </button>
            </div>

            {!producerPhone && (
              <p className="mt-6 text-center text-red-400 text-[10px] font-bold uppercase tracking-widest bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                {t('no_producer_phone')}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default RapidAlertMenu;
