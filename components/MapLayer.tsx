import React, { useEffect, useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { CheckCircle2, ChevronRight, Radio } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { isLive, isValidLocation } from "../services/proximity";
import type { Location, Person, SetPoint } from "../types";

const escapeHtml = (text: string) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

const CATEGORY_COLOR: Record<Person["category"], string> = {
  RUNNER: "bg-blue-500",
  ACTOR: "bg-violet-500",
  TROUPE: "bg-emerald-500",
};

// Leaflet measures its container once; recompute after layout and on resize
// to avoid grey tiles.
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100);
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
    click: (e) => onClick(e.latlng.lat, e.latlng.lng),
    contextmenu: (e) => onLongPress(e.latlng.lat, e.latlng.lng),
  });
  return null;
};

const ChangeView = ({ center }: { center: Location }) => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.setView([center.lat, center.lng], 16, { animate: true }), 50);
    return () => clearTimeout(timer);
  }, [center, map]);
  return null;
};

// Fit only the first snapshot with data. Later GPS updates must not steal the
// viewport from someone inspecting a person or choosing a map pin.
const InitialDataView = ({ locations, forceCenter }: { locations: Location[]; forceCenter?: Location }) => {
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
    map.fitBounds(L.latLngBounds(locations.map((l) => [l.lat, l.lng] as [number, number])), {
      padding: [55, 70],
      maxZoom: 16,
      animate: false,
    });
  }, [locations, forceCenter, map]);
  return null;
};

function circleIcon(text: string, className: string, live?: boolean, recovered?: boolean) {
  const pulse = live
    ? `<div class="absolute inset-0 rounded-full bg-blue-500/40 animate-ping"></div>
       <div class="absolute -inset-1 rounded-full border border-blue-400/30 animate-pulse"></div>`
    : "";
  const check = recovered
    ? `<div class="absolute -top-1 -right-1 z-20 rounded-full border border-white bg-zinc-700 p-0.5 text-white shadow-sm">
         <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
       </div>`
    : "";
  return L.divIcon({
    className: "leaflet-custom-marker",
    html: `<div class="relative flex h-10 w-10 items-center justify-center transition-all duration-500 ${recovered ? "grayscale scale-90" : ""}">
        ${pulse}${check}
        <div class="${className} relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-xl">${escapeHtml(text)}</div>
      </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
}

const setIcon = L.divIcon({
  className: "leaflet-custom-marker",
  html: `<div class="relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-yellow-500 shadow-xl">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m18 4 3 3"/><path d="m14 4 3 3"/><path d="m10 4 3 3"/><path d="m6 4 3 3"/>
        <path d="M22 10V4h-3L4 19v3h16c1.1 0 2-.9 2-2v-5Z"/><path d="M7 14.8V22"/>
      </svg>
    </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20],
});

export default function MapLayer({
  sets,
  people,
  now,
  onEntityClick,
  onMapClick,
  onMapLongPress,
  forceCenter,
  theme,
}: {
  sets: SetPoint[];
  people: Person[];
  /** Server-corrected time. */
  now: number;
  onEntityClick: (entity: SetPoint | Person) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapLongPress: (lat: number, lng: number) => void;
  forceCenter?: Location;
  theme: "light" | "dark";
}) {
  const { t, formatTime } = usePrefs();
  const visibleSets = sets.filter((s) => isValidLocation(s.location));
  // Runners appear only after their first GPS fix; there is no placeholder point.
  const visiblePeople = people.filter(
    (p) => isValidLocation(p.location) && (p.category !== "RUNNER" || p.lastSeen !== undefined),
  );
  const knownLocations = [...visibleSets, ...visiblePeople].map((entity) => entity.location!);
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  return (
    <div className={`h-full w-full bg-zinc-950 ${theme === "dark" ? "runset-map-dark" : ""}`}>
      <MapContainer center={[41.9028, 12.4964]} zoom={13} className="h-full w-full" zoomControl={false} preferCanvas>
        <MapResizer />
        <TileLayer
          attribution={
            import.meta.env.VITE_MAP_ATTRIBUTION ||
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          url={tileUrl}
          maxZoom={19}
        />
        <MapEvents onClick={onMapClick} onLongPress={onMapLongPress} />
        <InitialDataView locations={knownLocations} forceCenter={forceCenter} />
        {isValidLocation(forceCenter) && <ChangeView center={forceCenter} />}

        {visibleSets.map((set) => (
          <Marker key={set.id} title={set.name} position={[set.location.lat, set.location.lng]} icon={setIcon}>
            <Popup closeButton={false}>
              <div className="min-w-[140px] p-1">
                <h4 className="mb-1 text-sm font-bold text-white">{set.name}</h4>
                {set.address && <p className="mb-2 text-[10px] leading-tight text-zinc-400">{set.address}</p>}
                <button
                  type="button"
                  onClick={() => onEntityClick(set)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg bg-yellow-500 px-3 py-2 text-[10px] font-bold uppercase text-black"
                >
                  {t("details")}
                  <ChevronRight size={12} />
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {visiblePeople.map((person) => {
          const runner = person.category === "RUNNER";
          const live = runner && isLive(person, now);
          const color = runner ? (live ? "bg-blue-500" : "bg-zinc-600") : CATEGORY_COLOR[person.category];
          return (
            <Marker
              key={person.id}
              title={`${person.name}${person.isRecovered ? ` · ${t("recovered")}` : ""}`}
              position={[person.location!.lat, person.location!.lng]}
              icon={circleIcon(person.initials, color, live, person.isRecovered)}
            >
              <Popup closeButton={false}>
                <div className="min-w-[120px] p-1 text-center">
                  {live && (
                    <p className="mb-1 flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest text-blue-400">
                      <Radio size={10} className="animate-pulse" />
                      {t("live")}
                    </p>
                  )}
                  {runner && !live && person.lastSeen && (
                    <p className="mb-1 text-[10px] text-zinc-400">{t("last_known", { time: formatTime(person.lastSeen) })}</p>
                  )}
                  {person.isRecovered && (
                    <p className="mb-1 flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest text-green-500">
                      <CheckCircle2 size={10} />
                      {t("recovered")}
                    </p>
                  )}
                  <h4 className={`text-sm font-bold ${person.isRecovered ? "text-zinc-500 line-through" : "text-white"}`}>
                    {person.name}
                  </h4>
                  <p className="mb-2 text-[10px] text-zinc-400">{person.role}</p>
                  {runner && typeof person.accuracy === "number" && (
                    <p className="mb-2 text-[10px] text-zinc-400">{t("gps_precision", { m: Math.round(person.accuracy) })}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onEntityClick(person)}
                    className={`w-full rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-white ${
                      person.isRecovered ? "bg-zinc-800 text-zinc-400" : color
                    }`}
                  >
                    {t("contact")}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
