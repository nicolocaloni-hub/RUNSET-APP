
import React from 'react';
import { UserRole, SetPoint, Person } from '../types';
import { X, Truck, Users, LogOut, Trash2, ChevronRight, PlusCircle, User, Phone, Star, Clapperboard } from 'lucide-react';
import { useLanguage } from '../App';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  activeRunnerId: string | null;
  producerInfo?: { name: string; phone: string };
  onUpdateProducerInfo?: (info: { name: string; phone: string }) => void;
  sets: SetPoint[];
  people: Person[];
  onSelectSet: (set: SetPoint) => void;
  onDeleteSet: (id: string) => void;
  onDeletePerson: (id: string) => void;
  onTriggerAddPerson: (type: 'RUNNER' | 'ACTOR' | 'TROUPE') => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, role, activeRunnerId, producerInfo, onUpdateProducerInfo, sets, people, onSelectSet, onDeleteSet, onDeletePerson, onTriggerAddPerson, onLogout 
}) => {
  const { t } = useLanguage();
  const isProducer = role === UserRole.PRODUCER;

  const runners = people.filter(p => p.category === 'RUNNER');
  const actors = people.filter(p => p.category === 'ACTOR');
  const troupe = people.filter(p => p.category === 'TROUPE');

  const handleProducerInfoChange = (key: 'name' | 'phone', value: string) => {
    if (onUpdateProducerInfo && producerInfo) {
      onUpdateProducerInfo({ ...producerInfo, [key]: value });
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`fixed top-0 left-0 h-full w-80 bg-zinc-950 border-r border-zinc-800 z-50 transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-yellow-500 tracking-tighter">{t('app_name')}</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{role} {t('dashboard')}</p>
            </div>
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Producer Info Inputs */}
          {isProducer && onUpdateProducerInfo && producerInfo && (
            <div className="space-y-2 mt-4 animate-in fade-in duration-500">
              <div className="relative group">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" />
                <input 
                  type="text" 
                  value={producerInfo.name}
                  onChange={(e) => handleProducerInfoChange('name', e.target.value)}
                  placeholder={t('producer_name_placeholder')}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-yellow-500/50 transition-all placeholder:text-zinc-700"
                />
              </div>
              <div className="relative group">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-yellow-500 transition-colors" />
                <input 
                  type="tel" 
                  value={producerInfo.phone}
                  onChange={(e) => handleProducerInfoChange('phone', e.target.value)}
                  placeholder={t('producer_phone_placeholder')}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-yellow-500/50 transition-all placeholder:text-zinc-700"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-8 scrollbar-hide">
          {/* Sets Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Clapperboard size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">{t('sets')}</span>
              </div>
            </div>
            {sets.length === 0 ? (
              <p className="px-2 text-xs text-zinc-600 italic">{t('no_sets')}</p>
            ) : (
              <div className="space-y-1">
                {sets.map(set => (
                  <div key={set.id} className="group flex items-center justify-between p-3 rounded-xl hover:bg-zinc-900 transition-colors cursor-pointer" onClick={() => onSelectSet(set)}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-200 truncate">{set.name}</div>
                      <div className="text-[10px] text-zinc-500 truncate">{set.address}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                      {isProducer && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeleteSet(set.id); }}
                          className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <ChevronRight size={14} className="text-zinc-700" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Runners Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Truck size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">{t('runners')}</span>
              </div>
              {isProducer && (
                <button onClick={() => onTriggerAddPerson('RUNNER')} className="text-yellow-500 hover:text-yellow-400 transition-colors">
                  <PlusCircle size={18} />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {runners.map(runner => (
                <div key={runner.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900 group">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${runner.id === activeRunnerId ? 'bg-blue-500 text-white' : 'bg-blue-500/20 text-blue-500'} flex items-center justify-center text-[10px] font-bold`}>
                      {runner.initials}
                    </div>
                    <div>
                      <div className={`text-xs font-bold ${runner.id === activeRunnerId ? 'text-blue-400' : 'text-zinc-200'}`}>{runner.name}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-tighter">{runner.role}</div>
                    </div>
                  </div>
                  {isProducer && (
                    <button onClick={() => onDeletePerson(runner.id)} className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Actors Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Star size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">{t('actors')}</span>
              </div>
              {isProducer && (
                <button onClick={() => onTriggerAddPerson('ACTOR')} className="text-violet-500 hover:text-violet-400 transition-colors">
                  <PlusCircle size={18} />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {actors.map(actor => (
                <div key={actor.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 text-violet-500 flex items-center justify-center text-[10px] font-bold">
                      {actor.initials}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{actor.name}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-tighter">{actor.role}</div>
                    </div>
                  </div>
                  {isProducer && (
                    <button onClick={() => onDeletePerson(actor.id)} className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Troupe Section */}
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Users size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">{t('troupe')}</span>
              </div>
              {isProducer && (
                <button onClick={() => onTriggerAddPerson('TROUPE')} className="text-emerald-500 hover:text-emerald-400 transition-colors">
                  <PlusCircle size={18} />
                </button>
              )}
            </div>
            <div className="space-y-1">
              {troupe.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-zinc-900 group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                      {member.initials}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{member.name}</div>
                      <div className="text-[9px] text-zinc-500 uppercase tracking-tighter">{member.role}</div>
                    </div>
                  </div>
                  {isProducer && (
                    <button onClick={() => onDeletePerson(member.id)} className="p-2 text-zinc-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950/50">
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 hover:bg-red-950/20 text-zinc-500 hover:text-red-400 border border-zinc-800 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
          >
            <LogOut size={16} />
            {t('logout')}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
