import { describe, expect, it } from "vitest";
import type { Location, Person } from "../types";
import { distanceMeters, pickupCandidates } from "./proximity";

const now = 1_800_000_000_000;
const north = (meters: number): Location => ({
  lat: ((meters / 6371000) * 180) / Math.PI,
  lng: 0,
});
const runner: Person = {
  id: "runner",
  name: "Runner",
  role: "Runner",
  phone: "",
  initials: "R",
  category: "RUNNER",
  location: north(0),
  isLive: true,
  accuracy: 10,
  lastSeen: now,
  locationTimestamp: now,
};
const person = (
  id: string,
  meters: number,
  overrides: Partial<Person> = {},
): Person => ({
  id,
  name: id,
  role: "Attore",
  phone: "",
  initials: "A",
  category: "ACTOR",
  location: north(meters),
  assignedRunnerId: runner.id,
  isRecovered: false,
  ...overrides,
});

describe("distanceMeters", () => {
  it("returns meters, is symmetric and handles the date line", () => {
    expect(distanceMeters(north(0), north(0))).toBe(0);
    expect(distanceMeters(north(0), north(5))).toBeCloseTo(5, 8);
    expect(distanceMeters(north(5), north(0))).toBeCloseTo(5, 8);
    expect(
      distanceMeters({ lat: 0, lng: 179.99999 }, { lat: 0, lng: -179.99999 }),
    ).toBeCloseTo(2.2239, 3);
    expect(
      Number.isFinite(
        distanceMeters({ lat: 90, lng: 0 }, { lat: -90, lng: 180 }),
      ),
    ).toBe(true);
  });

  it.each([
    { lat: NaN, lng: 0 },
    { lat: 91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: 0, lng: Infinity },
  ])("rejects invalid coordinates %j", (bad) => {
    expect(distanceMeters(bad, north(0))).toBe(Infinity);
    expect(distanceMeters(north(0), bad)).toBe(Infinity);
  });
});

describe("pickupCandidates", () => {
  it("includes the five-meter boundary, excludes positions beyond it and orders nearest first", () => {
    const five = person("five", 5);
    const close = person("close", 1);
    expect(
      pickupCandidates(runner, [five, person("far", 5.001), close], now),
    ).toEqual([close, five]);
  });

  it("only suggests assigned, unrecovered cast and crew", () => {
    const crew = person("crew", 2, { category: "TROUPE" });
    const input = [
      person("recovered", 0, { isRecovered: true }),
      person("other", 0, { assignedRunnerId: "other-runner" }),
      person("unassigned", 0, { assignedRunnerId: undefined }),
      { ...runner, assignedRunnerId: runner.id },
      crew,
    ];
    expect(pickupCandidates(runner, input, now)).toEqual([crew]);
  });

  it("accepts the freshness and accuracy boundaries", () => {
    const actor = person("actor", 0);
    expect(
      pickupCandidates(
        {
          ...runner,
          lastSeen: now - 15000,
          locationTimestamp: now - 15000,
          accuracy: 10,
        },
        [actor],
        now,
      ),
    ).toEqual([actor]);
  });

  it.each<Partial<Person>>([
    { isLive: false },
    { lastSeen: undefined },
    { lastSeen: now - 15001 },
    { lastSeen: now + 1 },
    { lastSeen: NaN },
    { locationTimestamp: now - 15001 },
    { locationTimestamp: now + 1 },
    { accuracy: undefined },
    { accuracy: -1 },
    { accuracy: 10.001 },
    { accuracy: NaN },
    { accuracy: Infinity },
    { category: "ACTOR" },
    { location: { lat: 92, lng: 0 } },
  ])("rejects unusable GPS state %j", (overrides) => {
    expect(
      pickupCandidates({ ...runner, ...overrides }, [person("actor", 0)], now),
    ).toEqual([]);
  });

  it("handles a missing runner, invalid clock and bad target coordinates without prompting", () => {
    expect(pickupCandidates(undefined, [person("actor", 0)], now)).toEqual([]);
    expect(pickupCandidates(runner, [person("actor", 0)], NaN)).toEqual([]);
    expect(
      pickupCandidates(
        runner,
        [person("actor", 0, { location: { lat: NaN, lng: 0 } })],
        now,
      ),
    ).toEqual([]);
  });

  it("does not mutate the contacts or require a GPS timestamp on a static pickup point", () => {
    const input = [person("far", 4), person("near", 1)];
    const original = structuredClone(input);
    expect(
      pickupCandidates(
        { ...runner, locationTimestamp: undefined },
        input,
        now,
      ).map((p) => p.id),
    ).toEqual(["near", "far"]);
    expect(input).toEqual(original);
  });
});
