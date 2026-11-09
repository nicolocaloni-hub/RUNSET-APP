import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { CheckCircle2, ChevronRight, Layers, Maximize2, Radio } from "lucide-react";
import { usePrefs } from "../lib/preferences";
import { bearing, runnerColors } from "../lib/runners";
import { distanceMeters, isLive, isValidLocation } from "../services/proximity";
import type { Location, Person, SetPoint } from "../types";

const escapeHtml = (text: string) =>
  String(text ?? "").replace(
    /[&<>"']/g,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );

const CATEGORY_COLOR: Record<Person["category"], string> = { RUNNER: "#0D1B2A", ACTOR: "#6C4CF1", TROUPE: "#0B7A6B" };
const GLIDE_MS = 2800;
const TRAIL_POINTS = 40;
const TRAIL_MAX_AGE_MS = 15 * 60_000;
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const label = (text: string) =>
  `<span class="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-white/95 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-ink shadow">${escapeHtml(text)}</span>`;

// Icons are rebuilt only when what they show changes, so Leaflet keeps the same DOM node.
const iconCache = new Map<string, L.DivIcon>();
function cachedIcon(key: string, build: () => L.DivIcon) {
  let icon = iconCache.get(key);
  if (!icon) {
    icon = build();
    iconCache.set(key, icon);
  }
  return icon;
}

const carIcon = (initials: string, name: string, color: string, live: boolean) =>
  cachedIcon(`car|${initials}|${name}|${color}|${live}`, () =>
    L.divIcon({
      className: "leaflet-custom-marker",
      html: `<div class="relative h-11 w-11 ${live ? "" : "opacity-60"}">
        <svg data-car class="absolute inset-0" width="44" height="44" viewBox="0 0 44 44" style="z-index: 0; transition: transform 0.6s ease-out; filter: drop-shadow(0 3px 5px rgba(13,27,42,.45))">
          <rect x="11" y="2" width="22" height="40" rx="8" fill="${color}" stroke="#ffffff" stroke-width="2.5"></rect>
          <path d="M14.5 11 Q22 7 29.5 11 L28.5 15 L15.5 15 Z" fill="#0D1B2A" opacity="0.65"></path>
          <rect x="15" y="34" width="14" height="4" rx="2" fill="#0D1B2A" opacity="0.45"></rect>
        </svg>
        <span class="absolute left-[11px] top-[11px] z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white font-display text-[9px] font-extrabold text-ink">${escapeHtml(initials)}</span>
        ${label(name)}
      </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -22],
    }),
  );

const personIcon = (initials: string, name: string, color: string, recovered: boolean) =>
  cachedIcon(`person|${initials}|${name}|${color}|${recovered}`, () =>
    L.divIcon({
      className: "leaflet-custom-marker",
      html: `<div class="relative h-[38px] w-[38px]">
        ${
          recovered
            ? `<div class="flex h-[38px] w-[38px] items-center justify-center rounded-full border-2 border-[#9AA4B2] bg-white text-[#5B6675] shadow-md">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
               </div>`
            : `<div class="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[3px] border-white font-display text-xs font-bold text-white shadow-lg" style="background:${color}">${escapeHtml(initials)}</div>`
        }
        ${label(name)}
      </div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19],
      popupAnchor: [0, -19],
    }),
  );

const setIcon = (name: string) =>
  cachedIcon(`set|${name}`, () =>
    L.divIcon({
      className: "leaflet-custom-marker",
      html: `<div class="relative h-10 w-10">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl border-[3px] border-white bg-ink shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF5B1F" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z"></path><path d="m6.2 5.3 3.1 3.9"></path><path d="m12.4 3.4 3.1 4"></path><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>
          </svg>
        </div>
        ${label(name)}
      </div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    }),
  );

// Leaflet measures its container once; recompute after layout and on resize to avoid grey tiles.
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

const fitAll = (map: L.Map, locations: Location[], animate: boolean) => {
  if (locations.length === 0) return;
  map.fitBounds(L.latLngBounds(locations.map((l) => [l.lat, l.lng] as [number, number])), {
    padding: [60, 70],
    maxZoom: 16,
    animate,
  });
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
    fitAll(map, locations, false);
  }, [locations, forceCenter, map]);
  return null;
};

/** A runner's car glides from fix to fix and turns toward where it is heading. */
function RunnerCar({
  runner,
  color,
  live,
  children,
}: {
  runner: Person;
  color: string;
  live: boolean;
  children: React.ReactNode;
}) {
  const target = runner.location!;
  const marker = useRef<L.Marker>(null);
  const heading = useRef(0);
  // The marker keeps its first position as a prop; later moves are animated by hand.
  const [start] = useState<[number, number]>([target.lat, target.lng]);

  const turn = () => {
    const car = marker.current?.getElement()?.querySelector<SVGElement>("[data-car]");
    if (car) car.style.transform = `rotate(${heading.current}deg)`;
  };
  // A new icon (live/stale) replaces the element, so the heading is applied after every render.
  useLayoutEffect(turn);

  useEffect(() => {
    const m = marker.current;
    if (!m) return;
    const from = m.getLatLng();
    const moved = distanceMeters(from, target);
    if (moved < 1) return;
    if (moved > 4) {
      heading.current = bearing(from, target);
      turn();
    }
    // Long jumps (first fix after a pause) and reduced motion skip the glide.
    if (moved > 2000 || reducedMotion()) {
      m.setLatLng([target.lat, target.lng]);
      return;
    }
    const begin = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - begin) / GLIDE_MS);
      m.setLatLng([from.lat + (target.lat - from.lat) * k, from.lng + (target.lng - from.lng) * k]);
      if (k < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target.lat, target.lng]);

  return (
    <Marker
      ref={marker}
      position={start}
      title={runner.name}
      icon={carIcon(runner.initials, firstName(runner.name), color, live)}
      zIndexOffset={1000}
    >
      {children}
    </Marker>
  );
}

type TrailPoint = { lat: number; lng: number; at: number };

export default function MapLayer({
  sets,
  people,
  now,
  onEntityClick,
  onMapClick,
  onMapLongPress,
  forceCenter,
  controlsClassName = "bottom-4",
}: {
  sets: SetPoint[];
  people: Person[];
  /** Server-corrected time. */
  now: number;
  onEntityClick: (entity: SetPoint | Person) => void;
  onMapClick: (lat: number, lng: number) => void;
  onMapLongPress: (lat: number, lng: number) => void;
  forceCenter?: Location;
  /** Vertical position of the map buttons, so they clear sheets and docks. */
  controlsClassName?: string;
}) {
  const { t, formatTime, mapTheme, setMapTheme } = usePrefs();
  const [map, setMap] = useState<L.Map | null>(null);
  const [trails, setTrails] = useState<Record<string, TrailPoint[]>>({});
  const colors = runnerColors(people);
  const visibleSets = sets.filter((s) => isValidLocation(s.location));
  // Runners appear only after their first GPS fix; there is no placeholder point.
  const visiblePeople = people.filter(
    (p) => isValidLocation(p.location) && (p.category !== "RUNNER" || p.lastSeen !== undefined),
  );
  const runners = visiblePeople.filter((p) => p.category === "RUNNER");
  const others = visiblePeople.filter((p) => p.category !== "RUNNER");
  const knownLocations = [...visibleSets, ...visiblePeople].map((entity) => entity.location!);
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  // The trail is drawn from the fixes this device has seen (last 15 minutes).
  useEffect(() => {
    setTrails((previous) => {
      const at = Date.now();
      let changed = false;
      const next: Record<string, TrailPoint[]> = {};
      for (const runner of people) {
        if (runner.category !== "RUNNER" || !isValidLocation(runner.location) || !runner.sharing) continue;
        const list = (previous[runner.id] ?? []).filter((p) => at - p.at < TRAIL_MAX_AGE_MS);
        const last = list[list.length - 1];
        if (!last || distanceMeters(last, runner.location) >= 4) {
          list.push({ ...runner.location, at });
          changed = true;
        }
        next[runner.id] = list.slice(-TRAIL_POINTS);
      }
      return changed || Object.keys(next).length !== Object.keys(previous).length ? next : previous;
    });
  }, [people]);

  const mapButton =
    "pointer-events-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink shadow-float";

  return (
    <div className={`relative h-full w-full ${mapTheme === "dark" ? "runset-map-dark" : ""}`}>
      <MapContainer ref={setMap} center={[41.9028, 12.4964]} zoom={13} className="h-full w-full" zoomControl={false}>
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

        {Object.entries(trails).map(([id, points]) =>
          points.length < 2 ? null : (
            <React.Fragment key={id}>
              <Polyline
                positions={points.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round" }}
                interactive={false}
              />
              <Polyline
                positions={points.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: colors.get(id) ?? "#FF5B1F", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
                interactive={false}
              />
            </React.Fragment>
          ),
        )}

        {visibleSets.map((set) => (
          <Marker key={set.id} title={set.name} position={[set.location.lat, set.location.lng]} icon={setIcon(set.name)}>
            <Popup closeButton={false}>
              <div className="min-w-[150px] p-1">
                <h4 className="mb-1 text-sm font-bold text-ink">{set.name}</h4>
                {set.address && <p className="mb-2 text-xs leading-tight text-muted">{set.address}</p>}
                <button
                  type="button"
                  onClick={() => onEntityClick(set)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white"
                >
                  {t("details")}
                  <ChevronRight size={14} />
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {others.map((person) => {
          const runnerColor = person.assignedRunnerId ? colors.get(person.assignedRunnerId) : undefined;
          return (
            <Marker
              key={person.id}
              title={`${person.name}${person.isRecovered ? ` · ${t("recovered")}` : ""}`}
              position={[person.location!.lat, person.location!.lng]}
              icon={personIcon(person.initials, firstName(person.name), CATEGORY_COLOR[person.category], !!person.isRecovered)}
            >
              <Popup closeButton={false}>
                <div className="min-w-[150px] p-1">
                  {person.isRecovered && (
                    <p className="mb-1 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-muted">
                      <CheckCircle2 size={12} />
                      {t("recovered")}
                    </p>
                  )}
                  <h4 className={`text-sm font-bold ${person.isRecovered ? "text-muted line-through" : "text-ink"}`}>
                    {person.name}
                  </h4>
                  {person.role && <p className="text-xs text-muted">{person.role}</p>}
                  {runnerColor && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink2">
                      <span className="h-2 w-2 rounded-full" style={{ background: runnerColor }} />
                      {people.find((p) => p.id === person.assignedRunnerId)?.name}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onEntityClick(person)}
                    className="mt-2 w-full rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white"
                  >
                    {t("contact")}
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {runners.map((runner) => {
          const live = isLive(runner, now);
          return (
            <RunnerCar key={runner.id} runner={runner} color={colors.get(runner.id) ?? "#FF5B1F"} live={live}>
              <Popup closeButton={false}>
                <div className="min-w-[150px] p-1">
                  {live ? (
                    <p className="mb-1 flex items-center gap-1 font-mono text-[10px] font-semibold uppercase text-live">
                      <Radio size={12} />
                      {t("live")}
                    </p>
                  ) : (
                    runner.lastSeen && (
                      <p className="mb-1 font-mono text-[10px] text-muted">
                        {t("last_known", { time: formatTime(runner.lastSeen) })}
                      </p>
                    )
                  )}
                  <h4 className="text-sm font-bold text-ink">{runner.name}</h4>
                  {typeof runner.accuracy === "number" && (
                    <p className="font-mono text-[11px] text-muted">{t("gps_precision", { m: Math.round(runner.accuracy) })}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => onEntityClick(runner)}
                    className="mt-2 w-full rounded-xl px-3 py-2 text-xs font-semibold text-white"
                    style={{ background: colors.get(runner.id) }}
                  >
                    {t("contact")}
                  </button>
                </div>
              </Popup>
            </RunnerCar>
          );
        })}
      </MapContainer>
      <div className={`pointer-events-none absolute right-3 z-[15] flex flex-col gap-2 ${controlsClassName}`}>
        <button
          type="button"
          aria-label={t("map_fit_all")}
          title={t("map_fit_all")}
          onClick={() => map && fitAll(map, knownLocations, true)}
          className={mapButton}
        >
          <Maximize2 size={20} />
        </button>
        <button
          type="button"
          aria-label={t("map_layers")}
          title={t("map_layers")}
          aria-pressed={mapTheme === "dark"}
          onClick={() => setMapTheme(mapTheme === "dark" ? "light" : "dark")}
          className={mapButton}
        >
          <Layers size={20} />
        </button>
      </div>
    </div>
  );
}
