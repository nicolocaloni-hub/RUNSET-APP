import { describe, expect, it } from "vitest";
import type { Location, Person } from "../types";
import {
  distanceMeters,
  initials,
  isLive,
  LIVE_TIMEOUT_MS,
  pickupCandidates,
  pickupRadius,
  type Fix,
} from "./proximity";

const now = 1_800_000_000_000;
const north = (meters: number): Location => ({ lat: ((meters / 6371000) * 180) / Math.PI, lng: 0 });
const fix = (overrides: Partial<Fix> = {}): Fix => ({ location: north(0), accuracy: 10, timestamp: now, ...overrides });
const person = (id: string, meters: number, overrides: Partial<Person> = {}): Person => ({
  id,
  name: id,
  role: "Attore",
  phone: "",
  address: "",
  initials: "A",
  category: "ACTOR",
  location: north(meters),
  assignedRunnerId: "runner",
  ...overrides,
});

describe("distanceMeters", () => {
  it("misura in metri e rifiuta coordinate non valide", () => {
    expect(distanceMeters(north(0), north(100))).toBeCloseTo(100, 3);
    expect(distanceMeters(north(0), { lat: 91, lng: 0 })).toBe(Infinity);
    expect(distanceMeters(undefined, north(0))).toBe(Infinity);
  });
});

describe("pickupRadius", () => {
  it("cresce con l'incertezza GPS entro 25-60 m", () => {
    expect(pickupRadius(0)).toBe(25);
    expect(pickupRadius(15)).toBe(35);
    expect(pickupRadius(200)).toBe(60);
  });
});

describe("pickupCandidates", () => {
  it("propone le persone assegnate entro il raggio, dalla più vicina", () => {
    const people = [person("lontano", 31), person("vicino", 10), person("medio", 20)];
    expect(pickupCandidates(fix(), "runner", people, now).map((p) => p.id)).toEqual(["vicino", "medio"]);
  });

  it("ignora persone già recuperate, di altri runner e i runner", () => {
    const people = [
      person("recuperato", 1, { isRecovered: true }),
      person("altrui", 1, { assignedRunnerId: "altro" }),
      person("runner2", 1, { category: "RUNNER", assignedRunnerId: undefined }),
    ];
    expect(pickupCandidates(fix(), "runner", people, now)).toEqual([]);
  });

  it("non propone nulla con GPS impreciso, vecchio o assente", () => {
    const people = [person("vicino", 1)];
    expect(pickupCandidates(fix({ accuracy: 51 }), "runner", people, now)).toEqual([]);
    expect(pickupCandidates(fix({ timestamp: now - 21_000 }), "runner", people, now)).toEqual([]);
    expect(pickupCandidates(null, "runner", people, now)).toEqual([]);
    expect(pickupCandidates(fix({ location: { lat: NaN, lng: 0 } }), "runner", people, now)).toEqual([]);
  });
});

describe("isLive", () => {
  const runner = (overrides: Partial<Person>): Person =>
    person("r", 0, { category: "RUNNER", assignedRunnerId: undefined, sharing: true, lastSeen: now, ...overrides });

  it("è live solo se condivide e l'ultimo segnale è recente", () => {
    expect(isLive(runner({}), now + LIVE_TIMEOUT_MS)).toBe(true);
    expect(isLive(runner({}), now + LIVE_TIMEOUT_MS + 1)).toBe(false);
    expect(isLive(runner({ sharing: false }), now)).toBe(false);
    expect(isLive(runner({ lastSeen: undefined }), now)).toBe(false);
  });
});

describe("initials", () => {
  it("usa le prime lettere di nome e cognome", () => {
    expect(initials("  mario   rossi bianchi ")).toBe("MR");
    expect(initials("Élodie")).toBe("É");
    expect(initials("   ")).toBe("?");
  });
});
