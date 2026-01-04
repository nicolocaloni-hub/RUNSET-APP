
import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, SetPoint, Person, Location } from '../types';
import Sidebar from './Sidebar';
import MapLayer from './MapLayer';
import SetBanner from './SetBanner';
import InfoOverlay from './InfoOverlay';
import PersonBanner from './PersonBanner';
import RapidAlertMenu from './RapidAlertMenu';
import { Menu, Plus, Bell } from 'lucide-react';

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

const MainLayout: React.FC<MainLayoutProps> = ({ 
  role, activeRunnerId, sets, people, producerInfo, onUpdateProducerInfo, onAddSet, onDeleteSet, onAddPerson, onDeletePerson, onLogout, autoSelectedSet 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddingSet, setIsAddingSet] = useState(false);
  const [isAddingPerson, setIsAddingPerson] = useState<'RUNNER' | 'ACTOR' | 'TROUPE' | null>(null);
  const [pendingCoords, setPendingCoords] = useState<Location | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<SetPoint | Person | null>(null);

  const visiblePeople = useMemo(() => {
    if (role === UserRole.PRODUCER) return people;
    return people.filter(p => 
      p.id === activeRunnerId || p.assignedRunnerId === activeRunnerId
    );
  }, [role, activeRunnerId, people]);

  useEffect(() => {
    if (autoSelectedSet) {
      setSelectedEntity(autoSelectedSet);
    }
  }, [autoSelectedSet]);

  const handleMapLongPress = (lat: number, lng: number) => {
    if (role === UserRole.PRODUCER) {
      setPendingCoords({ lat, lng });
      setIsAddingSet(true);
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
  };

  const currentRunnerName = useMemo(() => {
    if (role !== UserRole.RUNNER) return null;
    return people.find(p => p.id === activeRunnerId)?.name;
  }, [role, activeRunnerId, people]);

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
        people={visiblePeople}
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
          onMapClick={() => {}}
          onMapLongPress={handleMapLongPress}
          forceCenter={selectedEntity && 'address' in selectedEntity ? selectedEntity.location : undefined}
        />

        {/* Header Controls */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pt-[env(safe-area-inset-top)]">
          <div className="flex gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-3 bg-zinc-900/90 text-white rounded-xl shadow-lg border border-zinc-800 active:scale-95 transition-all"
            >
              <Menu size={24} />
            </button>
            
            <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900/90 border border-zinc-800 rounded-xl shadow-lg">
              <Bell size={16} className={Notification.permission === 'granted' ? 'text-green-500' : 'text-zinc-500'} />
              <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                {Notification.permission === 'granted' ? 'Sync Live' : 'Notifiche Off'}
              </span>
            </div>
          </div>

          {currentRunnerName && (
            <div className="px-3 py-1 bg-blue-600 text-white rounded-lg shadow-lg text-[10px] font-bold uppercase tracking-widest border border-blue-400/50 self-start animate-in fade-in slide-in-from-left-4">
              Profilo: {currentRunnerName}
            </div>
          )}
        </div>

        {/* Alert Menu for Runner */}
        {role === UserRole.RUNNER && currentRunnerName && (
          <RapidAlertMenu 
            runnerName={currentRunnerName} 
            producerPhone={producerInfo?.phone}
          />
        )}

        {role === UserRole.PRODUCER && !isAddingSet && !isAddingPerson && !selectedEntity && (
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
            runners={people.filter(p => p.category === 'RUNNER')}
            onSave={(p) => {
              onAddPerson(p);
              setIsAddingPerson(null);
            }}
            onCancel={() => setIsAddingPerson(null)}
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
