import type { Location, Person } from "../types";

export const PICKUP_RADIUS_METERS = 5;
export const PICKUP_MAX_ACCURACY_METERS = 10;
export const PICKUP_MAX_FIX_AGE_MS = 15000;
const EARTH_RADIUS_METERS = 6371000;

const isValidLocation = (
  location: Location | undefined,
): location is Location =>
  Boolean(
    location &&
      Number.isFinite(location.lat) &&
      Number.isFinite(location.lng) &&
      Math.abs(location.lat) <= 90 &&
      Math.abs(location.lng) <= 180,
  );

/** Great-circle distance. Invalid coordinates can never trigger a pickup. */
export function distanceMeters(a: Location, b: Location): number {
  if (!isValidLocation(a) || !isValidLocation(b)) return Infinity;
  const radians = Math.PI / 180;
  const latitudeDelta = (b.lat - a.lat) * radians;
  const longitudeDelta = (b.lng - a.lng) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a.lat * radians) *
      Math.cos(b.lat * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))))
  );
}

/** Suggestions only: the runner must explicitly confirm every pickup. */
export function pickupCandidates(
  runner: Person | undefined,
  people: Person[],
  now: number,
): Person[] {
  const fresh = (timestamp: number | undefined) =>
    typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp > 0 &&
    timestamp <= now &&
    now - timestamp <= PICKUP_MAX_FIX_AGE_MS;

  if (
    !runner ||
    runner.category !== "RUNNER" ||
    !runner.isLive ||
    !Number.isFinite(now) ||
    !fresh(runner.lastSeen) ||
    (runner.locationTimestamp !== undefined &&
      !fresh(runner.locationTimestamp)) ||
    typeof runner.accuracy !== "number" ||
    !Number.isFinite(runner.accuracy) ||
    runner.accuracy < 0 ||
    runner.accuracy > PICKUP_MAX_ACCURACY_METERS ||
    !isValidLocation(runner.location)
  )
    return [];

  return people
    .filter(
      (person) =>
        person.category !== "RUNNER" &&
        person.assignedRunnerId === runner.id &&
        !person.isRecovered,
    )
    .map((person) => ({
      person,
      distance: distanceMeters(runner.location, person.location),
    }))
    .filter((candidate) => candidate.distance <= PICKUP_RADIUS_METERS)
    .sort(
      (a, b) =>
        a.distance - b.distance || a.person.id.localeCompare(b.person.id),
    )
    .map((candidate) => candidate.person);
}
