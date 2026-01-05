
import React from 'react';
import { SetPoint, Person, UserRole } from '../types';
import { X, Phone, Navigation, Trash2, MapPin, User, Clipboard, ExternalLink } from 'lucide-react';
import { useLanguage } from '../App';

interface InfoOverlayProps {
  entity: SetPoint | Person;
  onClose: () => void;
  onDelete?: (id: string) => void;
  role: UserRole;
}

const InfoOverlay: React.FC<InfoOverlayProps> = ({ entity, onClose, onDelete, role }) => {
  const { t } = useLanguage();
  const isSet = (e: SetPoint | Person): e is SetPoint => 'address' in e;
  const isProducer = role === UserRole.PRODUCER;

  const handleDirections = () => {
    const coords = isSet(entity) ? entity.location : (entity as Person).location;
    const address = entity.address;

    // Se abbiamo l'indirizzo testuale scritto a mano, usiamo quello per Google Maps
    // perché è più preciso del reverse-geocoding via coordinate
    if (address && address.trim().length > 0) {
      const query = encodeURIComponent(`${address}, Italia`);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
    } else {
      // Fallback alle coordinate se l'indirizzo manca
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank');
    }
  };

  const handleCall = () => {
    if (!entity.phone) return;
    window.location.href = `tel:${entity.phone}`;
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <div className={`w-2 h-2 rounded-full ${isSet(entity) ? 'bg-yellow-500' : 'bg-blue-500'}`} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {isSet(entity) ? t('set_card') : t('contact_card')}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-hide flex-1">
          <div className="flex items-start justify-between mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-white tracking-tight">{entity.name}</h2>
              {isSet(entity) ? (
                <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
                  <MapPin size={12} className="text-yellow-500/50" />
                  <span>{entity.address}</span>
                </div>
              ) : (
                <div className="text-blue-500 text-xs font-bold uppercase tracking-widest">{(entity as Person).role}</div>
              )}
            </div>
            
            {isSet(entity) && isProducer && (
              <button 
                onClick={() => { onDelete?.(entity.id); onClose(); }}
                className="p-3 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500/20 transition-colors"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 mb-8">
            {isSet(entity) && entity.managerName && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800/50 rounded-xl text-zinc-500">
                    <User size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">{t('set_manager')}</div>
                    <div className="text-sm font-semibold">{entity.managerName}</div>
                  </div>
                </div>
              </div>
            )}

            {entity.phone && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                      <Phone size={14} />
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">{t('direct_contact')}</div>
                      <button 
                        onClick={handleCall}
                        className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        {entity.phone}
                      </button>
                    </div>
                  </div>
                  <button onClick={handleCall} className="p-2 bg-blue-500 text-white rounded-lg active:scale-90 transition-transform">
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}

            {isSet(entity) && entity.note && (
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-800/50 rounded-xl text-zinc-500">
                    <Clipboard size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">{t('operative_notes')}</div>
                    <div className="text-xs text-zinc-400 leading-snug">{entity.note}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pb-2">
            <button 
              onClick={handleCall}
              disabled={!entity.phone}
              className="flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-zinc-800 hover:bg-blue-500/10 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95 disabled:opacity-30"
            >
              <Phone size={16} className="text-blue-500" />
              {t('call')}
            </button>
            <button 
              onClick={handleDirections}
              className="flex items-center justify-center gap-2 py-4 bg-zinc-900 border border-zinc-800 hover:bg-yellow-500/10 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all active:scale-95"
            >
              <Navigation size={16} className="text-yellow-500" />
              {t('navigate')}
            </button>
          </div>
        </div>
        
        {/* Safe Area Spacer */}
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
    </div>
  );
};

export default InfoOverlay;
