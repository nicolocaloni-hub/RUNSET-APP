import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { SetPoint, Person, Location } from "../types";
import { ChevronRight, Radio, CheckCircle2 } from "lucide-react";
import { useLanguage } from "../App";

const validLocation = (location: Location | undefined): location is Location =>
  Boolean(
    location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      Math.abs(location.lat) <= 90 &&
      Math.abs(location.lng) <= 180,
  );
const escapeHtml = (text: string) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
const runnerIsLive = (runner: Person, now: number) =>
  Boolean(
    runner.isLive &&
      Number.isFinite(runner.lastSeen) &&
      runner.lastSeen! > 0 &&
      now >= runner.lastSeen! &&
      now - runner.lastSeen! <= 45000,
  );

interface MapLayerProps {
  sets: SetPoint[];
  runners: Person[];
  actors: Person[];
  crew: Person[];
  onEntityClick: (entity: SetPoint | Person) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapLongPress: (lat: number, lng: number) => void;
  forceCenter?: Location;
  theme?: "light" | "dark";
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
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);
  return null;
};

const MapEvents = ({
  onClick,
  onLongPress,
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

// Fit only the first real data snapshot. Subsequent GPS updates must not steal
// the viewport from someone inspecting another person or choosing a map pin.
const InitialDataView = ({
  locations,
  forceCenter,
}: {
  locations: Location[];
  forceCenter?: Location;
}) => {
  const map = useMap();
  const initialized = useRef(false);
  useMapEvents({
    dragstart: () => {
      initialized.current = true;
    },
  });
  useEffect(() => {
    if (initialized.current) return;
    if (forceCenter) {
      initialized.current = true;
      return;
    }
    if (locations.length === 0) return;
    initialized.current = true;
    map.fitBounds(
      L.latLngBounds(
        locations.map(
          (location) => [location.lat, location.lng] as [number, number],
        ),
      ),
      { padding: [55, 70], maxZoom: 16, animate: false },
    );
  }, [locations, forceCenter, map]);
  return null;
};

const createCircleIcon = (
  text: string,
  className: string,
  isLive?: boolean,
  isRecovered?: boolean,
) => {
  const pulseHtml =
    isLive && !isRecovered
      ? `
    <div class="absolute inset-0 rounded-full bg-blue-500/40 animate-ping"></div>
    <div class="absolute -inset-1 rounded-full border border-blue-400/30 animate-pulse"></div>
  `
      : "";

  const recoveredClass = isRecovered ? "grayscale scale-90" : "scale-100";
  const checkmark = isRecovered
    ? `
    <div class="absolute -top-1 -right-1 bg-zinc-700 text-white rounded-full p-0.5 border border-white z-20 shadow-sm">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
    </div>
  `
    : "";

  return L.divIcon({
    className: "leaflet-custom-marker",
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 transition-all duration-500 ${recoveredClass}">
        ${pulseHtml}
        ${checkmark}
        <div class="${className} relative z-10 w-10 h-10 flex items-center justify-center rounded-full border-2 border-white shadow-xl font-bold text-xs">
          ${escapeHtml(text)}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

const createSetIcon = () => {
  // Icona Ciak (Clapperboard) pulita, senza filtri complessi che potrebbero non caricare
  return L.divIcon({
    className: "leaflet-custom-marker",
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
    popupAnchor: [0, -20],
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
  theme = "dark",
}) => {
  const { t } = useLanguage();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);
  const visibleSets = sets.filter((set) => validLocation(set.location));
  const visibleRunners = runners.filter(
    (runner) =>
      validLocation(runner.location) &&
      Number.isFinite(runner.lastSeen) &&
      runner.lastSeen! > 0,
  );
  const visibleActors = actors.filter((actor) => validLocation(actor.location));
  const visibleCrew = crew.filter((member) => validLocation(member.location));
  const knownLocations = [
    ...visibleSets,
    ...visibleRunners,
    ...visibleActors,
    ...visibleCrew,
  ].map((entity) => entity.location);
  const defaultPosition: [number, number] = [41.9028, 12.4964];

  // Standard OSM tiles use normal browser caching; no prefetch/offline download.
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className={`h-full w-full bg-zinc-950 ${theme === 'dark' ? 'runset-map-dark' : ''}`}>
      <MapContainer
        center={defaultPosition}
        zoom={13}
        className="h-full w-full"
        zoomControl={false}
        preferCanvas={true} // Migliora le performance con molti marker
      >
        <MapResizer />

        <TileLayer
          attribution={import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}
          url={tileUrl}
          maxZoom={19}
        />

        <MapEvents onClick={onMapClick} onLongPress={onMapLongPress} />
        <InitialDataView locations={knownLocations} forceCenter={forceCenter} />
        {validLocation(forceCenter) && <ChangeView center={forceCenter} />}

        {/* Set Markers */}
        {visibleSets.map((set) => (
          <Marker
            key={set.id}
            title={set.name}
            position={[set.location.lat, set.location.lng]}
            icon={createSetIcon()}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 min-w-[140px]">
                <h4 className="font-bold text-sm mb-1 text-white">
                  {set.name}
                </h4>
                <p className="text-[10px] text-zinc-400 mb-2 leading-tight">
                  {set.address}
                </p>
                <button
                  onClick={() => onEntityClick(set)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-yellow-500 text-black text-[10px] font-bold rounded-lg hover:bg-yellow-400 transition-all active:scale-95"
                >
                  {t("details") || "DETAILS"}
                  <ChevronRight size={12} />
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Runner Markers */}
        {visibleRunners.map((runner) => {
          const isLive = runnerIsLive(runner, now);
          return (
            <Marker
              key={runner.id}
              title={`${runner.name} · ${isLive ? "Live" : "Ultima posizione nota"}`}
              position={[runner.location.lat, runner.location.lng]}
              icon={createCircleIcon(
                runner.initials,
                isLive ? "bg-blue-500 text-white" : "bg-zinc-600 text-white",
                isLive,
              )}
            >
              <Popup closeButton={false} offset={[0, 0]}>
                <div className="p-1 text-center min-w-[120px]">
                  {isLive ? (
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Radio
                        size={10}
                        className="text-blue-400 animate-pulse"
                      />
                      <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">
                        Live
                      </span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-400 mb-1">
                      Ultima posizione nota ·{" "}
                      {new Date(runner.lastSeen!).toLocaleTimeString("it-IT")}
                    </p>
                  )}
                  <h4 className="font-bold text-sm text-white">
                    {runner.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 mb-2">
                    {runner.role}
                  </p>
                  {typeof runner.accuracy === "number" && (
                    <p className="text-[10px] text-zinc-400 mb-2">
                      Precisione GPS ±{Math.round(runner.accuracy)} m
                    </p>
                  )}
                  <button
                    onClick={() => onEntityClick(runner)}
                    className="w-full px-3 py-1.5 bg-blue-500 text-white text-[10px] font-bold rounded-lg hover:bg-blue-600 transition-all active:scale-95"
                  >
                    {t("contact") || "CONTACT"}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Actor Markers */}
        {visibleActors.map((actor) => (
          <Marker
            key={actor.id}
            title={`${actor.name}${actor.isRecovered ? " · Recuperato" : ""}`}
            position={[actor.location.lat, actor.location.lng]}
            icon={createCircleIcon(
              actor.initials,
              "bg-violet-500 text-white",
              false,
              actor.isRecovered,
            )}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 text-center">
                {actor.isRecovered && (
                  <div className="flex items-center justify-center gap-1 mb-1 text-green-500">
                    <CheckCircle2 size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">
                      Recuperato
                    </span>
                  </div>
                )}
                <h4
                  className={`font-bold text-sm ${actor.isRecovered ? "text-zinc-500 line-through" : "text-white"}`}
                >
                  {actor.name}
                </h4>
                <p className="text-[10px] text-zinc-500 mb-2">{actor.role}</p>
                <button
                  onClick={() => onEntityClick(actor)}
                  className={`w-full px-3 py-1.5 ${actor.isRecovered ? "bg-zinc-800 text-zinc-500" : "bg-violet-500 text-white"} text-[10px] font-bold rounded-lg hover:opacity-80 transition-all active:scale-95`}
                >
                  {t("contact") || "CONTACT"}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Crew Markers */}
        {visibleCrew.map((member) => (
          <Marker
            key={member.id}
            title={`${member.name}${member.isRecovered ? " · Recuperato" : ""}`}
            position={[member.location.lat, member.location.lng]}
            icon={createCircleIcon(
              member.initials,
              "bg-emerald-500 text-white",
              false,
              member.isRecovered,
            )}
          >
            <Popup closeButton={false} offset={[0, 0]}>
              <div className="p-1 text-center">
                {member.isRecovered && (
                  <div className="flex items-center justify-center gap-1 mb-1 text-green-500">
                    <CheckCircle2 size={10} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">
                      Recuperato
                    </span>
                  </div>
                )}
                <h4
                  className={`font-bold text-sm ${member.isRecovered ? "text-zinc-500 line-through" : "text-white"}`}
                >
                  {member.name}
                </h4>
                <p className="text-[10px] text-zinc-500 mb-2">{member.role}</p>
                <button
                  onClick={() => onEntityClick(member)}
                  className={`w-full px-3 py-1.5 ${member.isRecovered ? "bg-zinc-800 text-zinc-500" : "bg-emerald-500 text-white"} text-[10px] font-bold rounded-lg hover:opacity-80 transition-all active:scale-95`}
                >
                  {t("contact") || "CONTACT"}
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
