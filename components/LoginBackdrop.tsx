import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { DEMO_ROUTES } from "../lib/demoRoutes";
import { bearing } from "../lib/runners";
import { carIcon } from "./MapLayer";

const SPEED_MPS = 16;
const TRAIL_METERS = 450;
const M_PER_DEG = 111_320;
const COS_LAT = Math.cos((41.9 * Math.PI) / 180);
const meters = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * M_PER_DEG, (a[1] - b[1]) * M_PER_DEG * COS_LAT);

/** Drives the demo cars along their loops; imperative Leaflet calls keep it to one render. */
function DemoCars() {
  const map = useMap();
  useEffect(() => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Center the routes in the part of the screen the cards leave free:
    // right of the card on desktop, the strip between header and form on phones.
    const { innerWidth: w, innerHeight: h } = window;
    map.panBy(w >= 768 ? [-(w * 0.08 + 448) / 2, 0] : [0, h / 2 - (165 + h * 0.12)], { animate: false });
    const cars = DEMO_ROUTES.map((route, index) => {
      const cumulative = [0];
      for (let i = 1; i < route.path.length; i++) cumulative.push(cumulative[i - 1] + meters(route.path[i - 1], route.path[i]));
      const length = cumulative[cumulative.length - 1];
      const casing = L.polyline([], { color: "#ffffff", weight: 9, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
      const trail = L.polyline([], { color: route.color, weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round", interactive: false }).addTo(map);
      const marker = L.marker(route.path[0], { icon: carIcon(route.initials, route.name, route.color, true), interactive: false, keyboard: false }).addTo(map);
      // Spread the cars around their loops so they are not bunched at the start.
      return { route, cumulative, length, casing, trail, marker, offset: (length * index) / DEMO_ROUTES.length };
    });

    // Point at distance d along a loop, plus the index of the segment it lies on.
    const at = (car: (typeof cars)[number], d: number): [[number, number], number] => {
      const { cumulative, route } = car;
      let i = 1;
      while (i < cumulative.length - 1 && cumulative[i] < d) i++;
      const span = cumulative[i] - cumulative[i - 1] || 1;
      const k = Math.min(1, Math.max(0, (d - cumulative[i - 1]) / span));
      const [a, b] = [route.path[i - 1], route.path[i]];
      return [[a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], i];
    };

    const draw = (seconds: number) => {
      for (const car of cars) {
        const d = (car.offset + seconds * SPEED_MPS) % car.length;
        const [point, segment] = at(car, d);
        car.marker.setLatLng(point);
        const [from, to] = [car.route.path[segment - 1], car.route.path[segment]];
        const svg = car.marker.getElement()?.querySelector<SVGElement>("[data-car]");
        if (svg) svg.style.transform = `rotate(${bearing({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] })}deg)`;
        // Trail: the stretch of road driven in the last TRAIL_METERS (wrapping past the loop start).
        const tail: [number, number][] = [];
        const start = d - TRAIL_METERS;
        for (let step = start; step < d; step += 25) tail.push(at(car, (step + car.length) % car.length)[0]);
        tail.push(point);
        car.casing.setLatLngs(tail);
        car.trail.setLatLngs(tail);
      }
    };

    let frame = 0;
    const begin = performance.now();
    const loop = (now: number) => {
      draw((now - begin) / 1000);
      frame = requestAnimationFrame(loop);
    };
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      for (const car of cars) [car.casing, car.trail, car.marker].forEach((layer) => layer.remove());
    };
  }, [map]);
  return null;
}

/** Decorative live-looking map of Rome behind the login form. */
export default function LoginBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0">
      <MapContainer
        center={[41.8952, 12.4858]}
        zoom={15}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer url={import.meta.env.VITE_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png"} maxZoom={19} />
        <DemoCars />
      </MapContainer>
      {/* Soft wash so the floating cards stay the focus. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ground/70 via-ground/10 to-ground/60" />
    </div>
  );
}
