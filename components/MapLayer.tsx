
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { SetPoint, Person, Location } from '../types';
import { ChevronRight, Radio, CheckCircle2 } from 'lucide-react';
// Import useLanguage to access the translation function
import { useLanguage } from '../App';

interface MapLayerProps {
  sets: SetPoint[];
  runners: Person[];
  actors: Person[];
  crew: Person[];
  onEntityClick: (entity: SetPoint | Person) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapLongPress: (lat: number, lng: number) => void;
  forceCenter?: Location;
  theme?: 'light' | 'dark';
}

// Componente interno per forzare Leaflet a ricalcolare le dimensioni del contenitore.
// Risolve il bug delle "tiles grigie" che si verifica se la mappa viene renderizzata prima che il CSS sia pronto
// o se il contenitore cambia dimensioni (es. rotazione schermo o apertura sidebar).
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  return null;
};

const MapEvents = ({ 
  onClick, 
  onLongPress 
}: { 
  onClick: (lat: number, lng: number) => void;
  onLongPress: (lat: number, lng: number) => void;
}) => {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
    contextmenu: (e) => {
      onLongPress(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

const ChangeView = ({ center }: { center: Location }) => {
  const map = useMap();
  useEffect(() => {
    // Usiamo un piccolo timeout per assicurarci che la mappa sia pronta prima di spostare la vista
    const timer = setTimeout(() => {
      map.setView([center.lat, center.lng], 16, { animate: true });
    }, 50);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
};

const createCircleIcon = (text: string, className: string, isLive?: boolean, isRecovered?: boolean) => {
  const pulseHtml = isLive && !isRecovered ? `
    <div class="absolute inset-0 rounded-full bg-blue-500/40 animate-ping"></div>
    <div class="absolute -inset-1 rounded-full border border-blue-400/30 animate-pulse"></div>
  ` : '';

  const recoveredClass = isRecovered ? 'grayscale desaturate opacity-40 scale-90' : 'scale-100';
  const checkmark = isRecovered ? `
    <div class="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-white z-20 shadow-sm">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
  ` : '';

  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 transition-all duration-500 ${recoveredClass}">
        ${pulseHtml}
        ${checkmark}
        <div class="${className} relative z-10 w-10 h-10 flex items-center justify-center rounded-full border-2 border-white shadow-xl font-bold text-xs">
          ${text}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const createSetIcon = () => {
  // Icona Ciak (Clapperboard) pulita, senza filtri complessi che potrebbero non caricare
  return L.divIcon({
    className: 'leaflet-custom-marker',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        <div class="bg-yellow-500 relative z-10 w-10 h-10 flex items-center justify-center rounded-full border-2 border-white shadow-xl">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m18 4 3 3"/>
            <path d="m14 4 3 3"/>
            <path d="m10 4 3 3"/>
            <path d="m6 4 3 3"/>
            <path d="M22 10V4h-3L4 19v3h16c1.1 0 2-.9 2-2v-5Z"/>
            <path d="M7 14.8V22"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

const MapLayer: React.FC<MapLayerProps> = ({ 
  sets, 
  runners, 
  actors = [],
  crew, 
  onEntityClick, 
  onMapClick, 
  onMapLongPress,
  forceCenter,
  theme = 'dark'
}) => {
  // Destructure t from useLanguage hook
  const { t } = useLanguage();
  const defaultPosition: [number, number] = [41.9028, 12.4964];

  // Tile Server di CartoDB (molto stabili)
  const tileUrl = theme === 'dark' 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

  return (
    <div className="h-full w-full bg-zinc-950">
      <MapContainer 
        center={defaultPosition} 
        zoom={13} 
        className="h-full w-full"
        zoomControl={false}
        preferCanvas={true} // Migliora le performance con molti marker
      >
        <MapResizer />
        
        <TileLayer
          key={theme} // Forza il re-render delle tiles al cambio tema
          attribution='&copy; CARTO'
          url={tileUrl}
        />
        
        <MapEvents onClick={onMapClick} onLongPress={onMapLongPress} />
        {forceCenter && <ChangeView center={forceCenter} />}

        {/* Set Markers */}
        {sets.map(set => (
          <Marker 
            key={set.id} 
            position={[set.location.lat, set.location.lng]}
            icon={createSetIcon()}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 min-w-[140px]">
                <h4 className="font-bold text-sm mb-1 text-white">{set.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2 leading-tight">{set.address}</p>
                <button 
                  onClick={() => onEntityClick(set)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-yellow-500 text-black text-[10px] font-bold rounded-lg hover:bg-yellow-400 transition-all active:scale-95"
                >
                  {t('details') || 'DETAILS'}
                  <ChevronRight size={12} />
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Runner Markers */}
        {runners.map(runner => (
          <Marker 
            key={runner.id} 
            position={[runner.location.lat, runner.location.lng]}
            icon={createCircleIcon(runner.initials, 'bg-blue-500 text-white', runner.isLive)}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 text-center min-w-[120px]">
                {runner.isLive && (
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Radio size={10} className="text-blue-400 animate-pulse" />
                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Live</span>
                  </div>
                )}
                <h4 className="font-bold text-sm text-white">{runner.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2">{runner.role}</p>
                <button 
                  onClick={() => onEntityClick(runner)}
                  className="w-full px-3 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-all active:scale-95"
                >
                  {t('contact') || 'CONTACT'}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Actor Markers */}
        {actors.map(actor => (
          <Marker 
            key={actor.id} 
            position={[actor.location.lat, actor.location.lng]}
            icon={createCircleIcon(actor.initials, 'bg-violet-500 text-white', false, actor.isRecovered)}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 text-center">
                {actor.isRecovered && (
                  <div className="flex items-center justify-center gap-1 mb-1 text-green-500">
                    <CheckCircle2 size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Recuperato</span>
                  </div>
                )}
                <h4 className={`font-bold text-sm ${actor.isRecovered ? 'text-zinc-500 line-through' : 'text-white'}`}>{actor.name}</h4>
                <p className="text-[10px] text-zinc-500 mb-2">{actor.role}</p>
                <button 
                  onClick={() => onEntityClick(actor)}
                  className={`w-full px-3 py-1.5 ${actor.isRecovered ? 'bg-zinc-800 text-zinc-500' : 'bg-violet-500 text-white'} text-[10px] font-bold rounded-lg hover:opacity-80 transition-all active:scale-95`}
                >
                  {t('contact') || 'CONTACT'}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Crew Markers */}
        {crew.map(member => (
          <Marker 
            key={member.id} 
            position={[member.location.lat, member.location.lng]}
            icon={createCircleIcon(member.initials, 'bg-emerald-500 text-white', false, member.isRecovered)}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 text-center">
                {member.isRecovered && (
                  <div className="flex items-center justify-center gap-1 mb-1 text-green-500">
                    <CheckCircle2 size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Recuperato</span>
                  </div>
                )}
                <h4 className={`font-bold text-sm ${member.isRecovered ? 'text-zinc-500 line-through' : 'text-white'}`}>{member.name}</h4>
                <p className="text-[10px] text-zinc-500 mb-2">{member.role}</p>
                <button 
                  onClick={() => onEntityClick(member)}
                  className={`w-full px-3 py-1.5 ${member.isRecovered ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-white'} text-[10px] font-bold rounded-lg hover:opacity-80 transition-all active:scale-95`}
                >
                  {t('contact') || 'CONTACT'}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapLayer;
