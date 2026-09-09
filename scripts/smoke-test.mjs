import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.RUNSET_TEST_URL || "http://127.0.0.1:3001";
const credentials = {
  password: randomBytes(20).toString("base64url"),
  roomCode: "",
  runnerCode: "",
  runner2Code: "",
  runnerId: "",
  actorId: "",
};
class Client {
  cookie = "";
  async request(body, expected = 200, extra = {}) {
    const res = await fetch(base + "/api/runset", {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...extra,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const value = await res.json();
    assert.equal(res.status, expected, JSON.stringify(value));
    if (res.headers.get("set-cookie")) {
      assert.match(res.headers.get("set-cookie"), /HttpOnly/);
      this.cookie = res.headers.get("set-cookie").split(";")[0];
    }
    return value;
  }
}
const admin = new Client(),
  secondAdmin = new Client(),
  runner = new Client(),
  runner2 = new Client(),
  anonymous = new Client();
const person = (name, category, assignedRunnerId) => ({
  id: randomUUID(),
  name,
  category,
  role: category,
  phone: "",
  initials: "QA",
  location: { lat: 41.9028, lng: 12.4964 },
  assignedRunnerId,
});
await anonymous.request(undefined, 401);
await anonymous.request({ action: "createRoom", name: "blocked" }, 403, {
  Origin: "https://untrusted.example",
});
let state = await admin.request({
  action: "createRoom",
  name: "RunSet collaudo " + new Date().toISOString(),
  producerName: "Produzione di prova",
  password: credentials.password,
});
credentials.roomCode = state.session.roomCode;
await mkdir(".cache", { recursive: true });
await writeFile(".cache/smoke-session.json", JSON.stringify(credentials));
await secondAdmin.request({
  action: "loginProducer",
  roomCode: credentials.roomCode,
  password: credentials.password,
});
const r1 = person("Runner collaudo A", "RUNNER"),
  r2 = person("Runner collaudo B", "RUNNER"),
  a1 = person("Attrice collaudo", "ACTOR", r1.id),
  a2 = person("Troupe collaudo", "TROUPE", r2.id);
for (const p of [r1, r2, a1, a2])
  await admin.request({ action: "savePerson", person: p });
await admin.request({
  action: "saveSet",
  set: {
    id: randomUUID(),
    name: "Set collaudo",
    address: "Punto di prova Roma",
    managerName: "Test",
    phone: "",
    location: { lat: 41.9028, lng: 12.4964 },
  },
});
credentials.runnerCode = (
  await admin.request({ action: "createInvite", runnerId: r1.id })
).accessCode;
credentials.runner2Code = (
  await admin.request({ action: "createInvite", runnerId: r2.id })
).accessCode;
credentials.runnerId = r1.id;
credentials.actorId = a1.id;
await writeFile(".cache/smoke-session.json", JSON.stringify(credentials));
state = await runner.request({
  action: "joinRunner",
  roomCode: credentials.roomCode,
  accessCode: credentials.runnerCode,
});
assert.deepEqual(
  state.people.map((p) => p.id),
  [r1.id, a1.id],
);
assert.equal(state.password, undefined);
assert.equal(state.invites, undefined);
await runner2.request({
  action: "joinRunner",
  roomCode: credentials.roomCode,
  accessCode: credentials.runner2Code,
});
await runner.request({ action: "savePerson", person: r1 }, 403);
await runner.request({ action: "pickup", personId: a2.id }, 403);
const timestamp = Date.now();
await Promise.all([
  runner.request({
    action: "location",
    sharing: true,
    timestamp,
    accuracy: 4,
    location: { lat: 41.9028, lng: 12.4964 },
  }),
  runner2.request({
    action: "location",
    sharing: true,
    timestamp,
    accuracy: 7,
    location: { lat: 41.9128, lng: 12.5064 },
  }),
]);
state = await secondAdmin.request();
assert.equal(
  state.people.filter((p) => p.category === "RUNNER" && p.isLive).length,
  2,
);
await runner.request({ action: "pickup", personId: a1.id });
await runner.request({ action: "pickup", personId: a1.id });
state = await secondAdmin.request();
assert.equal(state.people.find((p) => p.id === a1.id).isRecovered, true);
assert.equal(state.events.filter((e) => e.type === "PICKUP").length, 1);
await runner.request({ action: "alert", type: "TRAFFICO" });
state = await secondAdmin.request();
assert.match(state.events.at(-1).message, /TRAFFICO/);
const stop = Date.now();
await runner.request({ action: "location", sharing: false, timestamp: stop });
await runner.request({
  action: "location",
  sharing: true,
  timestamp: stop - 1,
  accuracy: 4,
  location: { lat: 50, lng: 10 },
});
state = await admin.request();
assert.equal(state.people.find((p) => p.id === r1.id).isLive, false);
credentials.runner2Code = (
  await admin.request({ action: "createInvite", runnerId: r2.id })
).accessCode;
await runner2.request(undefined, 401);
await writeFile(".cache/smoke-session.json", JSON.stringify(credentials));
await runner.request({ action: "logout" });
await runner.request(undefined, 401);
console.log(
  "PASS: isolated sessions, server authorization, concurrent GPS, persisted idempotent pickup, alerts, stop ordering, invite revocation and logout.",
);
console.log(
  "Test workspace saved locally for browser QA; no credentials printed.",
);
