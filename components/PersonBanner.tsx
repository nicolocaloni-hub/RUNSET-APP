
import React, { useState } from 'react';
import { Person, Location } from '../types';
import { X, Save, User, Phone, Briefcase, Link as LinkIcon, MapPin, Crosshair, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../App';

interface PersonBannerProps {
  type: 'RUNNER' | 'ACTOR' | 'TROUPE';
  runners?: Person[]; // Lista runner per l'assegnazione
  onSave: (person: Person) => void;
  onCancel: () => void;
  initialLocation?: Location;
}

const PersonBanner: React.FC<PersonBannerProps> = ({ type, runners = [], onSave, onCancel, initialLocation }) => {
  const { t } = useLanguage();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geoError, setGeoError] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    address: '',
    assignedRunnerId: ''
  });

  const geocodeAddress = async (address: string): Promise<Location | null> => {
    try {
      const query = `${address}, Italia`.trim();
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`);
      const data = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (error) {
      console.error("Geocoding error:", error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.name.trim().length === 0) return;
    setGeoError(false);

    setIsGeocoding(true);
    let finalLocation = initialLocation;

    if (!finalLocation && formData.address) {
      const coords = await geocodeAddress(formData.address);
      if (coords) {
        finalLocation = coords;
      } else {
        setGeoError(true);
        setIsGeocoding(false);
        return;
      }
    }

    if (!finalLocation) {
      setGeoError(true);
      setIsGeocoding(false);
      return;
    }

    // Calcolo iniziali ultra-sicuro per evitare crash
    const nameToProcess = formData.name.trim();
    const parts = nameToProcess.split(/\s+/).filter(Boolean);
    let initials = '??';
    if (parts.length > 0) {
      initials = parts.map(p => p[0].toUpperCase()).join('').slice(0, 2);
    }

    const newPerson: Person = {
      id: Math.random().toString(36).substr(2, 9),
      name: nameToProcess,
      role: formData.role.trim() || (type === 'RUNNER' ? 'Runner' : type === 'ACTOR' ? 'Attore' : 'Crew'),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      initials,
      category: type,
      assignedRunnerId: (type === 'TROUPE' || type === 'ACTOR') ? formData.assignedRunnerId : undefined,
      location: finalLocation,
      isRecovered: false
    };

    try {
      onSave(newPerson);
    } catch (err) {
      console.error("Critical Save Error:", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const getTitle = () => {
    switch(type) {
      case 'RUNNER': return t('add_runner');
      case 'ACTOR': return t('add_actor');
      default: return t('add_troupe');
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-[2000] flex items-end justify-center p-4 md:p-8 animate-in slide-in-from-bottom duration-300 pointer-events-none">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
              {getTitle()}
            </h3>
            {initialLocation && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[10px] font-bold rounded-full border border-blue-500/20">
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('full_name')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Mario Rossi"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('role_dept')}</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="text" 
                  value={formData.role}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value }))}
                  placeholder={type === 'RUNNER' ? 'Runner' : type === 'ACTOR' ? 'Protagonista' : 'Elettricista'}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('start_address')}</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
              <input 
                type="text" 
                value={formData.address}
                onChange={e => {
                  setFormData(prev => ({ ...prev, address: e.target.value }));
                  setGeoError(false);
                }}
                placeholder="Via Roma, 123, Roma"
                className={`w-full bg-zinc-900 border rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none transition-colors ${geoError ? 'border-red-500 animate-shake' : 'border-zinc-800 focus:border-yellow-500'}`}
              />
            </div>
            {geoError && (
              <p className="text-red-500 text-[10px] font-bold uppercase tracking-tighter ml-1 mt-1 flex items-center gap-1">
                <AlertCircle size={10} /> Indirizzo non trovato in Italia. Controlla o usa il pin.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('phone')}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                <input 
                  type="tel" 
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+39 333..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
                />
              </div>
            </div>

            {(type === 'TROUPE' || type === 'ACTOR') && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">{t('assign_runner')}</label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <select
                    value={formData.assignedRunnerId}
                    onChange={e => setFormData(prev => ({ ...prev, assignedRunnerId: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3.5 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors appearance-none"
                  >
                    <option value="">Nessun Runner</option>
                    {runners.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={isGeocoding}
              className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-500/10 disabled:opacity-50"
            >
              {isGeocoding ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
              {isGeocoding ? "Verifica indirizzo..." : t('save_contact')}
            </button>
          </div>
        </form>
        <div className="h-[env(safe-area-inset-bottom)] bg-zinc-950 shrink-0" />
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default PersonBanner;
