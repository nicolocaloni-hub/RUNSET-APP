
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { UserRole, SetPoint, Person, Location } from '../types';
import Sidebar from './Sidebar';
import MapLayer from './MapLayer';
import SetBanner from './SetBanner';
import InfoOverlay from './InfoOverlay';
import PersonBanner from './PersonBanner';
import RapidAlertMenu from './RapidAlertMenu';
import { Menu, Plus, Bell, Users, Check, Filter, Settings, Moon, Sun, X, RefreshCcw, MapPin, UserPlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../App';
import { NotificationService } from '../services/NotificationService';

interface MainLayoutProps {
  role: UserRole;
  activeRunnerId: string | null;
  sets: SetPoint[];
  people: Person[];
  producerInfo?: { name: string; phone: string };
  onUpdateProducerInfo?: (info: { name: string; phone: string }) => void;
  onAddSet: (set: SetPoint) => void;
  onDeleteSet: (id: string) => void;
  onAddPerson: (person: Person) => void;
  onDeletePerson: (id: string) => void;
  onLogout: () => void;
  autoSelectedSet?: SetPoint | null;
}

// Calcola distanza in metri
const getDistance = (l1: Location, l2: Location) => {
  const R = 6371e3; 
  const φ1 = l1.lat * Math.PI/180;
  const φ2 = l2.lat * Math.PI/180;
  const Δφ = (l2.lat-l1.lat) * Math.PI/180;
  const Δλ = (l2.lng-l1.lng) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const MainLayout: React.FC<MainLayoutProps> = ({ 
  role, activeRunnerId, sets, people, producerInfo, onUpdateProducerInfo, onAddSet, onDeleteSet, onAddPerson, onDeletePerson, onLogout, autoSelectedSet 
}) => {
  const { t, mapTheme, setMapTheme } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [isAddingPerson, setIsAddingPerson] = useState<'RUNNER' | 'ACTOR' | 'TROUPE' | null>(null);
  const [pendingCoords, setPendingCoords] = useState<Location | null>(null);
  const [showContextMenu, setShowContextMenu] = useState<Location | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SetPoint | Person | null>(null);
  
  const [filterRunnerId, setFilterRunnerId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Stato per il recupero prossimità
  const [pickupCandidate, setPickupCandidate] = useState<Person | null>(null);

  const visiblePeople = useMemo(() => {
    if (role === UserRole.RUNNER) {
      return people.filter(p => 
        p.id === activeRunnerId || p.assignedRunnerId === activeRunnerId
      );
    }
    if (!filterRunnerId) return people;
    return people.filter(p => 
      p.id === filterRunnerId || p.assignedRunnerId === filterRunnerId
    );
  }, [role, activeRunnerId, people, filterRunnerId]);

  const runners = useMemo(() => people.filter(p => p.category === 'RUNNER'), [people]);

  const activeRunner = useMemo(() => 
    people.find(p => p.id === activeRunnerId), 
  [people, activeRunnerId]);

  // Logic per il recupero automatico
  useEffect(() => {
    if (role === UserRole.RUNNER && activeRunner && activeRunner.location) {
      const assignedToMe = people.filter(p => 
        p.assignedRunnerId === activeRunnerId && !p.isRecovered
      );

      const candidate = assignedToMe.find(p => {
        const dist = getDistance(activeRunner.location, p.location);
        return dist < 15; // 15 metri (raggio di sovrapposizione)
      });

      if (candidate && (!pickupCandidate || pickupCandidate.id !== candidate.id)) {
        setPickupCandidate(candidate);
      } else if (!candidate && pickupCandidate) {
        setPickupCandidate(null);
      }
    }
  }, [people, activeRunner, activeRunnerId, role, pickupCandidate]);

  useEffect(() => {
    if (autoSelectedSet) {
      setSelectedEntity(autoSelectedSet);
    }
  }, [autoSelectedSet]);

  const handleMapLongPress = (lat: number, lng: number) => {
    if (role === UserRole.PRODUCER) {
      setShowContextMenu({ lat, lng });
      setSelectedEntity(null);
    }
  };

  const handleEntityClick = (entity: SetPoint | Person) => {
    setSelectedEntity(entity);
  };

  const closeOverlays = () => {
    setSelectedEntity(null);
    setIsAddingSet(false);
    setIsAddingPerson(null);
    setPendingCoords(null);
    setIsSettingsOpen(false);
    setShowContextMenu(null);
    setConfirmReset(false);
  };

  const handleCloseSession = () => {
    localStorage.clear();
    window.location.href = window.location.origin + window.location.pathname;
  };

  const confirmPickup = () => {
    if (!pickupCandidate || !activeRunner) return;
    
    const data = {
      runnerName: activeRunner.name,
      personName: pickupCandidate.name,
      personId: pickupCandidate.id
    };

    NotificationService.sendPickupUpdate(data);
    
    // Aggiornamento locale
    const updatedPerson = { ...pickupCandidate, isRecovered: true };
    onAddPerson(updatedPerson); // Questo agirà come aggiornamento grazie alla logica in App.tsx se modificata, 
                               // ma qui people è gestito esternamente. In App.tsx aggiungiamo logica update.
    setPickupCandidate(null);
  };

  return (
    <div className="relative h-[100dvh] w-full flex overflow-hidden bg-zinc-950">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        role={role}
        activeRunnerId={activeRunnerId}
        producerInfo={producerInfo}
        onUpdateProducerInfo={onUpdateProducerInfo}
        sets={sets}
        people={role === UserRole.PRODUCER ? people : visiblePeople}
        onSelectSet={(s) => {
          setSelectedEntity(s);
          setIsSidebarOpen(false);
        }}
        onDeleteSet={onDeleteSet}
        onDeletePerson={onDeletePerson}
        onTriggerAddPerson={(type) => {
          setIsAddingPerson(type);
          setIsSidebarOpen(false);
        }}
        onLogout={onLogout}
      />

      <main className="flex-1 relative z-0 h-full">
        <MapLayer 
          sets={sets} 
          runners={visiblePeople.filter(p => p.category === 'RUNNER')} 
          actors={visiblePeople.filter(p => p.category === 'ACTOR')}
          crew={visiblePeople.filter(p => p.category === 'TROUPE')} 
          onEntityClick={handleEntityClick}
          onMapClick={() => { if(showContextMenu) setShowContextMenu(null); }}
          onMapLongPress={handleMapLongPress}
          forceCenter={selectedEntity && 'address' in selectedEntity ? selectedEntity.location : undefined}
          theme={mapTheme}
        />

        {/* Proximity Pickup Banner */}
        {pickupCandidate && role === UserRole.RUNNER && (
          <div className="absolute top-24 left-4 right-4 z-[4000] animate-in slide-in-from-top duration-500">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-500/10 text-violet-500 rounded-full flex items-center justify-center font-bold">
                  {pickupCandidate.initials}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recupero Vicino</p>
                  <p className="text-sm font-bold text-white">Hai preso {pickupCandidate.name}?</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPickupCandidate(null)}
                  className="px-4 py-2 bg-zinc-800 text-zinc-400 text-xs font-bold rounded-xl active:scale-95 transition-all"
                >
                  NO
                </button>
                <button 
                  onClick={confirmPickup}
                  className="px-6 py-2 bg-green-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-green-600/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 size={14} />
                  SÌ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Menu contestuale Mappa */}
        {showContextMenu && (
          <div className="fixed inset-0 z-[2500] pointer-events-none">
             <div 
               className="absolute z-[2501] bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-2 animate-in zoom-in-95 duration-200 pointer-events-auto"
               style={{ 
                 left: `calc(50% - 110px)`, 
                 top: `calc(50% - 80px)` 
               }}
             >
               <div className="p-3 border-b border-zinc-800 mb-2 flex items-center justify-between gap-8">
                 <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('add_here')}</p>
                 <button onClick={() => setShowContextMenu(null)} className="text-zinc-600 hover:text-white"><X size={14}/></button>
               </div>
               <div className="space-y-1 w-52">
                 <button 
                   onClick={() => { setPendingCoords(showContextMenu); setIsAddingSet(true); setShowContextMenu(null); }}
                   className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                 >
                   <MapPin size={16} />
                   {t('add_set_option')}
                 </button>
                 <button 
                   onClick={() => { setPendingCoords(showContextMenu); setIsAddingPerson('RUNNER'); setShowContextMenu(null); }}
                   className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-bold text-blue-500 hover:bg-blue-500/10 transition-colors"
                 >
                   <UserPlus size={16} />
                   {t('add_person_option')}
                 </button>
               </div>
             </div>
          </div>
        )}

        {/* Header Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pt-[env(safe-area-inset-top)]">
          <div className="flex justify-between items-start">
            <div className="flex gap-2">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-3 bg-zinc-900/90 text-white rounded-xl shadow-lg border border-zinc-800 active:scale-95 transition-all"
              >
                <Menu size={24} />
              </button>
              
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-xl shadow-lg h-[48px]">
                <Bell size={16} className={Notification.permission === 'granted' ? 'text-green-500' : 'text-zinc-500'} />
                <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                  {Notification.permission === 'granted' ? 'Sync Live' : 'Notifiche Off'}
                </span>
              </div>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-3 bg-zinc-900/90 text-white rounded-xl shadow-lg border border-zinc-800 active:scale-95 transition-all"
              >
                <Settings size={24} />
              </button>
            </div>
          </div>
        </div>

        {role === UserRole.RUNNER && activeRunner && (
          <RapidAlertMenu 
            runnerName={activeRunner.name} 
            producerPhone={producerInfo?.phone}
          />
        )}

        {/* PRODUCER TOOLS */}
        {role === UserRole.PRODUCER && (
          <>
            <div className="absolute bottom-10 left-6 z-10 mb-[env(safe-area-inset-bottom)]">
              <div className="relative">
                <button 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className={`flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all active:scale-95 border-2 ${
                    filterRunnerId ? 'bg-yellow-500 border-yellow-400 text-black' : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Filter size={20} />
                </button>

                {isFilterOpen && (
                  <div className="absolute bottom-16 left-0 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 animate-in slide-in-from-bottom-4 duration-200">
                    <div className="p-3 border-b border-zinc-800 mb-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{t('filter_runners')}</p>
                    </div>
                    <div className="max-h-60 overflow-y-auto scrollbar-hide space-y-1">
                      <button 
                        onClick={() => { setFilterRunnerId(null); setIsFilterOpen(false); }}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${!filterRunnerId ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                      >
                        {t('show_all')}
                        {!filterRunnerId && <Check size={14} />}
                      </button>
                      {runners.map(runner => (
                        <button 
                          key={runner.id}
                          onClick={() => { setFilterRunnerId(runner.id); setIsFilterOpen(false); }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${filterRunnerId === runner.id ? 'bg-yellow-500 text-black' : 'text-zinc-400 hover:bg-zinc-800'}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] ${filterRunnerId === runner.id ? 'bg-black/20 text-black' : 'bg-blue-500/20 text-blue-500'}`}>
                              {runner.initials}
                            </div>
                            {runner.name}
                          </div>
                          {filterRunnerId === runner.id && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!isAddingSet && !isAddingPerson && !selectedEntity && (
              <div className="absolute bottom-10 right-6 z-10 mb-[env(safe-area-inset-bottom)]">
                <button 
                  onClick={() => setIsAddingSet(true)}
                  className="flex items-center gap-2 px-6 py-4 bg-yellow-500 text-black font-bold rounded-full shadow-2xl hover:bg-yellow-400 transition-all active:scale-95"
                >
                  <Plus size={20} />
                  Set
                </button>
              </div>
            )}
          </>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeOverlays}>
            <div className="w-full max-w-xs bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">{t('settings')}</h3>
                <button onClick={closeOverlays} className="p-2 text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-3">{t('map_theme')}</label>
                  <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                    <button 
                      onClick={() => setMapTheme('light')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${mapTheme === 'light' ? 'bg-white text-black shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Sun size={14} />
                      {t('theme_light')}
                    </button>
                    <button 
                      onClick={() => setMapTheme('dark')}
                      className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${mapTheme === 'dark' ? 'bg-zinc-800 text-white shadow-lg border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Moon size={14} />
                      {t('theme_dark')}
                    </button>
                  </div>
                </div>

                {role === UserRole.PRODUCER && (
                  <div className="pt-4 border-t border-zinc-800">
                    {!confirmReset ? (
                      <button 
                        onClick={() => setConfirmReset(true)}
                        className="w-full flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 text-red-500 rounded-2xl hover:bg-red-500/20 transition-all group"
                      >
                        <div className="text-left">
                          <div className="text-xs font-black uppercase tracking-widest">{t('close_session')}</div>
                          <div className="text-[8px] uppercase tracking-tighter opacity-60 font-bold">{t('close_session_desc')}</div>
                        </div>
                        <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                      </button>
                    ) : (
                      <div className="space-y-2 animate-in zoom-in-95 duration-200">
                        <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest text-center px-2">Vuoi davvero cancellare tutto?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => setConfirmReset(false)}
                            className="p-3 bg-zinc-800 text-zinc-400 rounded-xl text-xs font-bold uppercase tracking-widest"
                          >
                            Annulla
                          </button>
                          <button 
                            onClick={handleCloseSession}
                            className="p-3 bg-red-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                          >
                            <AlertTriangle size={14} />
                            RESET
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isAddingSet && (
          <SetBanner 
            initialLocation={pendingCoords || undefined}
            onSave={(newSet) => {
              onAddSet(newSet);
              setIsAddingSet(false);
              setPendingCoords(null);
            }} 
            onCancel={() => {
              setIsAddingSet(false);
              setPendingCoords(null);
            }} 
          />
        )}

        {isAddingPerson && (
          <PersonBanner 
            type={isAddingPerson}
            initialLocation={pendingCoords || undefined}
            runners={people.filter(p => p.category === 'RUNNER')}
            onSave={(p) => {
              onAddPerson(p);
              setIsAddingPerson(null);
              setPendingCoords(null);
            }}
            onCancel={() => {
              setIsAddingPerson(null);
              setPendingCoords(null);
            }}
          />
        )}

        {selectedEntity && (
          <InfoOverlay 
            entity={selectedEntity} 
            onClose={closeOverlays} 
            onDelete={onDeleteSet}
            role={role}
          />
        )}
      </main>
    </div>
  );
};

export default MainLayout;
