
import React, { useState } from 'react';
import { SetPoint, Location } from '../types';
import { X, Save, MapPin, Phone, User, FileText, Crosshair } from 'lucide-react';
import { useLanguage } from '../App';

interface SetBannerProps {
  onSave: (set: SetPoint) => void;
  onCancel: () => void;
  initialLocation?: Location;
}

const SetBanner: React.FC<SetBannerProps> = ({ onSave, onCancel, initialLocation }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    manager: '',
    phone: '',
    note: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address) return;

    const newSet: SetPoint = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.name,
      address: formData.address,
      managerName: formData.manager,
      phone: formData.phone,
      note: formData.note,
      location: initialLocation || {
        lat: 41.8 + Math.random() * 0.2,
        lng: 12.4 + Math.random() * 0.2
      }
    };

    onSave(newSet);
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              {initialLocation ? t('map_pin') : t('new_set')}
            </h3>
            {initialLocation && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[10px] font-bold rounded-full border border-yellow-500/20">
                <Crosshair size={10} />
                {t('map_pin')}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="p-2 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto scrollbar-hide flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('set_name')}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Piazza del Popolo"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('address')}</label>
              <input 
                required
                type="text" 
                value={formData.address}
                onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Via del Corso, 1"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 px-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('set_manager')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="text" 
                  value={formData.manager}
                  onChange={e => setFormData(prev => ({ ...prev, manager: e.target.value }))}
                  placeholder="Manager Name"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('phone')}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+39..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('internal_notes')}</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-zinc-600" size={16} />
              <textarea 
                rows={2}
                value={formData.note}
                onChange={e => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Access codes, parking info..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/10"
            >
              <Save size={20} />
              {t('save_set')}
            </button>
          </div>
        </form>
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
    </div>
  );
};

export default SetBanner;
