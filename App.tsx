
import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { UserRole, SetPoint, Person, Location } from './types';
import RoleSelection from './components/RoleSelection';
import RunnerSelection from './components/RunnerSelection';
import MainLayout from './components/MainLayout';
import IntroSplash from './components/IntroSplash';
import AccessGate from './components/AccessGate';
import { NotificationService } from './services/NotificationService';
import { translations, Language, TranslationKey } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};

const App: React.FC = () => {
  const [language, setLanguageState] = useState<Language>(() => {
    return (localStorage.getItem('runset_lang') as Language) || 'it';
  });

  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('runset_intro_seen');
  });

  const [isUnlocked, setIsUnlocked] = useState(() => {
    return localStorage.getItem('runset_master_unlocked') === 'true';
  });

  const handleFinishIntro = () => {
    setShowIntro(false);
    sessionStorage.setItem('runset_intro_seen', 'true');
  };

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('runset_lang', lang);
  };

  const t = (key: TranslationKey, params?: Record<string, string>): string => {
    let str = translations[language][key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v);
      });
    }
    return str;
  };

  const [role, setRole] = useState<UserRole | null>(null);
  const [activeRunnerId, setActiveRunnerId] = useState<string | null>(() => {
    return localStorage.getItem('runset_active_runner');
  });
  
  const [producerInfo, setProducerInfo] = useState(() => {
    const saved = localStorage.getItem('runset_producer_info');
    return saved ? JSON.parse(saved) : { name: '', phone: '' };
  });

  const [sets, setSets] = useState<SetPoint[]>(() => {
    const saved = localStorage.getItem('runset_sets');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [people, setPeople] = useState<Person[]>(() => {
    const saved = localStorage.getItem('runset_people');
    if (!saved) return [
      { id: 'r1', name: 'Luca Rossi', role: 'Runner Lead', phone: '+393331234567', initials: 'LR', location: { lat: 41.9028, lng: 12.4964 }, category: 'RUNNER' },
      { id: 'c1', name: 'Sofia Verdi', role: 'DoP', phone: '+393339988776', initials: 'SV', location: { lat: 41.8900, lng: 12.4922 }, category: 'TROUPE', assignedRunnerId: 'r1' },
    ];
    return JSON.parse(saved);
  });

  const [externalNewSet, setExternalNewSet] = useState<SetPoint | null>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem('runset_sets', JSON.stringify(sets));
  }, [sets]);

  useEffect(() => {
    localStorage.setItem('runset_people', JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem('runset_producer_info', JSON.stringify(producerInfo));
  }, [producerInfo]);

  useEffect(() => {
    if (activeRunnerId) {
      localStorage.setItem('runset_active_runner', activeRunnerId);
    } else {
      localStorage.removeItem('runset_active_runner');
    }
  }, [activeRunnerId]);

  useEffect(() => {
    if (role === UserRole.RUNNER && activeRunnerId) {
      if ('geolocation' in navigator) {
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const newLoc: Location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
            NotificationService.sendLocationUpdate(activeRunnerId, newLoc);
            updatePersonLocation(activeRunnerId, newLoc, true);
          },
          (error) => console.error("Geolocation error:", error),
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
      }
    }
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [role, activeRunnerId]);

  const updatePersonLocation = useCallback((id: string, location: Location, isLive: boolean) => {
    setPeople(prev => prev.map(p => 
      p.id === id ? { ...p, location, isLive } : p
    ));
  }, []);

  useEffect(() => {
    NotificationService.listenForMessages(
      (newSet) => {
        setSets(prev => {
          if (prev.find(s => s.id === newSet.id)) return prev;
          return [...prev, newSet];
        });
        setExternalNewSet(newSet);
      },
      (alert) => {
        console.log('Runner Alert Received:', alert);
      },
      (update) => {
        updatePersonLocation(update.runnerId, update.location, true);
      }
    );
  }, [updatePersonLocation]);

  const handleAddSet = useCallback((newSet: SetPoint) => {
    setSets(prev => [...prev, newSet]);
    NotificationService.sendSetNotification(newSet);
  }, []);

  const handleDeleteSet = (id: string) => {
    setSets(prev => prev.filter(s => s.id !== id));
  };

  const handleAddPerson = (person: Person) => {
    setPeople(prev => [...prev, person]);
  };

  const handleDeletePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
  };

  const handleSelectRole = async (selectedRole: UserRole) => {
    await NotificationService.requestPermission();
    setRole(selectedRole);
  };

  const handleLogout = () => {
    setRole(null);
    setActiveRunnerId(null);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {showIntro && <IntroSplash onFinish={handleFinishIntro} />}
      {!showIntro && !isUnlocked && <AccessGate onUnlock={handleUnlock} />}
      
      {isUnlocked && (
        <>
          {!role ? (
            <RoleSelection onSelect={handleSelectRole} />
          ) : role === UserRole.RUNNER && !activeRunnerId ? (
            <RunnerSelection 
              runners={people.filter(p => p.category === 'RUNNER')} 
              onSelect={setActiveRunnerId}
              onBack={() => setRole(null)}
            />
          ) : (
            <MainLayout 
              role={role} 
              activeRunnerId={activeRunnerId}
              sets={sets} 
              people={people}
              producerInfo={producerInfo}
              onUpdateProducerInfo={setProducerInfo}
              onAddSet={handleAddSet}
              onDeleteSet={handleDeleteSet}
              onAddPerson={handleAddPerson}
              onDeletePerson={handleDeletePerson}
              onLogout={handleLogout}
              autoSelectedSet={externalNewSet}
            />
          )}
        </>
      )}
    </LanguageContext.Provider>
  );
};

export default App;
