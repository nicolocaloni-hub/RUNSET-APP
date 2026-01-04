
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { SetPoint, Person, Location } from '../types';
import { ChevronRight, Radio } from 'lucide-react';

interface MapLayerProps {
  sets: SetPoint[];
  runners: Person[];
  actors: Person[];
  crew: Person[];
  onEntityClick: (entity: SetPoint | Person) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapLongPress: (lat: number, lng: number) => void;
  forceCenter?: Location;
}

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
    map.setView([center.lat, center.lng], 15, { animate: true });
  }, [center, map]);
  return null;
};

const createCircleIcon = (text: string, className: string, isLive?: boolean) => {
  const pulseHtml = isLive ? `
    <div class="absolute inset-0 rounded-full bg-blue-500/40 animate-ping"></div>
    <div class="absolute -inset-1 rounded-full border border-blue-400/30 animate-pulse"></div>
  ` : '';

  return L.divIcon({
    className: 'relative',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10">
        ${pulseHtml}
        <div class="${className} relative z-10 w-10 h-10 flex items-center justify-center rounded-full border-2 border-white shadow-lg font-bold">
          ${text}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
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
  forceCenter 
}) => {
  const defaultPosition: [number, number] = [41.9028, 12.4964];

  return (
    <div className="h-full w-full">
      <MapContainer 
        center={defaultPosition} 
        zoom={13} 
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapEvents onClick={onMapClick} onLongPress={onMapLongPress} />
        {forceCenter && <ChangeView center={forceCenter} />}

        {/* Set Markers */}
        {sets.map(set => (
          <Marker 
            key={set.id} 
            position={[set.location.lat, set.location.lng]}
            icon={createCircleIcon('SET', 'bg-yellow-500 text-black')}
          >
            <Popup closeButton={false} offset={[0, -10]}>
              <div className="p-1">
                <h4 className="font-bold text-sm mb-1">{set.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2 truncate max-w-[150px]">{set.address}</p>
                <button 
                  onClick={() => onEntityClick(set)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-yellow-500 text-black text-[10px] font-bold rounded-lg hover:bg-yellow-400 transition-all"
                >
                  DETAILS
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
            <Popup closeButton={false} offset={[0, -10]}>
              <div className="p-1 text-center min-w-[120px]">
                {runner.isLive && (
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Radio size={10} className="text-blue-400 animate-pulse" />
                    <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Live Tracking</span>
                  </div>
                )}
                <h4 className="font-bold text-sm text-white">{runner.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2">{runner.role}</p>
                <button 
                  onClick={() => onEntityClick(runner)}
                  className="w-full px-3 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-all"
                >
                  CONTACT
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
            icon={createCircleIcon(actor.initials, 'bg-violet-500 text-white')}
          >
            <Popup closeButton={false} offset={[0, -10]}>
              <div className="p-1 text-center">
                <h4 className="font-bold text-sm text-white">{actor.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2">{actor.role}</p>
                <button 
                  onClick={() => onEntityClick(actor)}
                  className="w-full px-3 py-1.5 bg-violet-500 text-white text-[10px] font-bold rounded-lg hover:bg-violet-600 transition-all"
                >
                  CONTACT
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
            icon={createCircleIcon(member.initials, 'bg-emerald-500 text-white')}
          >
            <Popup closeButton={false} offset={[0, -10]}>
              <div className="p-1 text-center">
                <h4 className="font-bold text-sm text-white">{member.name}</h4>
                <p className="text-[10px] text-zinc-400 mb-2">{member.role}</p>
                <button 
                  onClick={() => onEntityClick(member)}
                  className="w-full px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition-all"
                >
                  CONTACT
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
