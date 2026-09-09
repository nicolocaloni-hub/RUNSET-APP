import { describe, it, expect } from "vitest";
import {
  hash,
  mutate,
  snapshot,
  passwordHash,
  verifyPassword,
  type Room,
  type Identity,
} from "./model";
import { UserRole, Person } from "../types";
const now = 100000;
const producer: Identity = { roomCode: "TEST", role: UserRole.PRODUCER };
const runner: Identity = {
  roomCode: "TEST",
  role: UserRole.RUNNER,
  runnerId: "r1",
  inviteHash: hash("a".repeat(32)),
};
const person = (
  id: string,
  category: Person["category"],
  assignedRunnerId?: string,
): Person => ({
  id,
  category,
  name: id,
  role: category,
  phone: "",
  initials: id,
  location: { lat: 41.9, lng: 12.49 },
  assignedRunnerId,
});
function room(): Room {
  return {
    name: "Test",
    password: "hidden",
    people: [
      person("r1", "RUNNER"),
      person("r2", "RUNNER"),
      person("a1", "ACTOR", "r1"),
      person("a2", "TROUPE", "r2"),
    ],
    sets: [],
    events: [],
    producerInfo: { name: "Producer", phone: "" },
    invites: { r1: runner.inviteHash! },
  };
}
describe("authorization and state transitions", () => {
  it("restricts roster and never exposes credentials", () => {
    const s = snapshot(room(), runner, 1, now);
    expect(s.people.map((p) => p.id)).toEqual(["r1", "a1"]);
    expect(s).not.toHaveProperty("password");
    expect(s).not.toHaveProperty("invites");
  });
  it.each([
    "savePerson",
    "deletePerson",
    "saveSet",
    "deleteSet",
    "saveProducer",
    "createInvite",
  ])("denies runner administration %s", (action) =>
    expect(() => mutate(room(), runner, { action }, now)).toThrow(
      "Solo il produttore",
    ),
  );
  it("only permits assigned pickups and records them once", () => {
    expect(() =>
      mutate(room(), runner, { action: "pickup", personId: "a2" }, now),
    ).toThrow("non è assegnata");
    const first = mutate(
      room(),
      runner,
      { action: "pickup", personId: "a1" },
      now,
    );
    const second = mutate(
      first,
      runner,
      { action: "pickup", personId: "a1" },
      now,
    );
    expect(second.events).toHaveLength(1);
    expect(second.people.find((p) => p.id === "a1")?.isRecovered).toBe(true);
  });
  it("prevents late GPS packets from undoing stop", () => {
    let s = mutate(
      room(),
      runner,
      {
        action: "location",
        sharing: true,
        timestamp: now - 10,
        location: { lat: 42, lng: 13 },
        accuracy: 3,
      },
      now,
    );
    s = mutate(
      s,
      runner,
      { action: "location", sharing: false, timestamp: now },
      now,
    );
    s = mutate(
      s,
      runner,
      {
        action: "location",
        sharing: true,
        timestamp: now - 5,
        location: { lat: 44, lng: 14 },
        accuracy: 3,
      },
      now,
    );
    expect(s.people[0].isLive).toBe(false);
    expect(s.people[0].location.lat).toBe(42);
  });
  it("protects runtime data from a stale producer form", () => {
    const stale = room().people[0];
    let s = mutate(
      room(),
      runner,
      {
        action: "location",
        sharing: true,
        timestamp: now,
        location: { lat: 42, lng: 13 },
        accuracy: 3,
      },
      now,
    );
    s = mutate(
      s,
      producer,
      { action: "savePerson", person: { ...stale, name: "Updated" } },
      now,
    );
    expect(s.people[0]).toMatchObject({
      name: "Updated",
      lastSeen: now,
      isLive: true,
      location: { lat: 42, lng: 13 },
    });
  });
  it("ages out live positions and rejects old samples", () => {
    const s = mutate(
      room(),
      runner,
      {
        action: "location",
        sharing: true,
        timestamp: now,
        location: { lat: 42, lng: 13 },
        accuracy: 3,
      },
      now,
    );
    expect(snapshot(s, producer, 1, now + 31000).people[0].isLive).toBe(false);
    expect(() =>
      mutate(
        s,
        runner,
        {
          action: "location",
          sharing: true,
          timestamp: 1,
          location: { lat: 42, lng: 13 },
          accuracy: 3,
        },
        now,
      ),
    ).toThrow("scaduta");
  });
  it("revokes an existing runner session when its invite rotates or runner is deleted", () => {
    const s = mutate(
      room(),
      producer,
      { action: "createInvite", runnerId: "r1", accessCode: "b".repeat(32) },
      now,
    );
    expect(() => snapshot(s, runner, 1, now)).toThrow("revocato");
    const deleted = mutate(
      room(),
      producer,
      { action: "deletePerson", id: "r1" },
      now,
    );
    expect(() => snapshot(deleted, runner, 1, now)).toThrow("revocato");
    expect(
      deleted.people.find((p) => p.id === "a1")?.assignedRunnerId,
    ).toBeUndefined();
  });
  it("rejects malformed coordinates", () =>
    expect(() =>
      mutate(
        room(),
        runner,
        {
          action: "location",
          sharing: true,
          timestamp: now,
          location: { lat: NaN, lng: 999 },
          accuracy: 3,
        },
        now,
      ),
    ).toThrow("Coordinate"));
  it("hashes passwords with independent salts", async () => {
    const a = await passwordHash("Password test 123");
    const b = await passwordHash("Password test 123");
    expect(a).not.toBe(b);
    expect(await verifyPassword("Password test 123", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
  });
});
