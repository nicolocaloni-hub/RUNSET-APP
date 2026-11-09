import type { Location, Person } from "../types";

/** A runner is "live" only if the server received a fix within this window. */
export const LIVE_TIMEOUT_MS = 30_000;
/** Fixes less precise than this never trigger a pickup suggestion. */
export const PICKUP_MAX_ACCURACY_METERS = 50;
export const PICKUP_MAX_FIX_AGE_MS = 20_000;
/** After "No", the suggestion stays hidden until the runner moves this far away. */
export const PICKUP_DISMISS_RESET_METERS = 80;
const EARTH_RADIUS_METERS = 6_371_000;

export interface Fix {
  location: Location;
  accuracy: number;
  /** Device clock, compared only with the same device's clock. */
  timestamp: number;
}

export const isValidLocation = (location: Location | undefined | null): location is Location =>
  Boolean(
    location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      Math.abs(location.lat) <= 90 &&
      Math.abs(location.lng) <= 180,
  );

/** Great-circle distance. Invalid coordinates can never trigger a pickup. */
export function distanceMeters(a: Location | undefined, b: Location | undefined): number {
  if (!isValidLocation(a) || !isValidLocation(b)) return Infinity;
  const radians = Math.PI / 180;
  const latitudeDelta = (b.lat - a.lat) * radians;
  const longitudeDelta = (b.lng - a.lng) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

/**
 * Radius grows with GPS uncertainty: a geocoded address is the building centroid
 * and urban GPS is often 10-30 m off, so a fixed 5 m radius almost never fired.
 */
export const pickupRadius = (accuracy: number) => Math.min(60, Math.max(25, accuracy + 20));

/** `now` must already be corrected to server time. */
export function isLive(person: Person | undefined, now: number): boolean {
  return Boolean(
    person?.sharing &&
      typeof person.lastSeen === "number" &&
      now - person.lastSeen <= LIVE_TIMEOUT_MS,
  );
}

/** Suggestions only: the runner must explicitly confirm every pickup. */
export function pickupCandidates(
  fix: Fix | null,
  runnerId: string | undefined,
  people: Person[],
  deviceNow: number,
): Person[] {
  if (
    !fix ||
    !runnerId ||
    !isValidLocation(fix.location) ||
    !Number.isFinite(fix.accuracy) ||
    fix.accuracy < 0 ||
    fix.accuracy > PICKUP_MAX_ACCURACY_METERS ||
    !Number.isFinite(fix.timestamp) ||
    deviceNow - fix.timestamp > PICKUP_MAX_FIX_AGE_MS
  )
    return [];
  const radius = pickupRadius(fix.accuracy);
  return people
    .filter((p) => p.category !== "RUNNER" && p.assignedRunnerId === runnerId && !p.isRecovered)
    .map((person) => ({ person, distance: distanceMeters(fix.location, person.location) }))
    .filter((candidate) => candidate.distance <= radius)
    .sort((a, b) => a.distance - b.distance || a.person.id.localeCompare(b.person.id))
    .map((candidate) => candidate.person);
}

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "?";
