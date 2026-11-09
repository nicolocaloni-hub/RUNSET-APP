import type { Person } from "../types";

/** Car, trail and badge color for each runner, in a fixed order. */
export const RUNNER_COLORS = ["#FF5B1F", "#2563EB", "#DB2777", "#CA8A04", "#0891B2", "#65A30D", "#7C3AED", "#DC2626"];

/** The database assigns each runner a fixed color; the id order is only a fallback. */
export function runnerColors(people: Person[]): Map<string, string> {
  const runners = people.filter((p) => p.category === "RUNNER").sort((a, b) => (a.id < b.id ? -1 : 1));
  return new Map(runners.map((r, index) => [r.id, r.color ?? RUNNER_COLORS[index % RUNNER_COLORS.length]]));
}

/** Compass bearing in degrees from one point to another (0 = north). */
export function bearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLng = (to.lng - from.lng) * rad;
  const y = Math.sin(dLng) * Math.cos(to.lat * rad);
  const x =
    Math.cos(from.lat * rad) * Math.sin(to.lat * rad) - Math.sin(from.lat * rad) * Math.cos(to.lat * rad) * Math.cos(dLng);
  return (Math.atan2(y, x) / rad + 360) % 360;
}
