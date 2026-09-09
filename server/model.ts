import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { UserRole, type Person, type SetPoint } from "../types.js";
import type { RunEvent, Snapshot } from "../services/protocol.js";

const scrypt = promisify(scryptCallback);
export const LIVE_TIMEOUT_MS = 30_000;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const token = () => randomBytes(24).toString("base64url");
export async function passwordHash(value: string) {
  const salt = token();
  return `${salt}:${((await scrypt(value, salt, 64)) as Buffer).toString("hex")}`;
}
export async function verifyPassword(value: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key || !/^[a-f0-9]{128}$/.test(key)) return false;
  const actual = (await scrypt(value, salt, 64)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}

export interface Room {
  name: string;
  password: string;
  people: Person[];
  sets: SetPoint[];
  producerInfo: { name: string; phone: string };
  events: RunEvent[];
  invites: Record<string, string>;
  /** Private ordering watermark; never exposed in snapshots. */
  sharingUpdates?: Record<string, { timestamp: number; sharing: boolean }>;
}
export interface Identity {
  roomCode: string;
  role: UserRole;
  runnerId?: string;
  inviteHash?: string;
}

export function str(value: unknown, max = 120, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  ) {
    throw new HttpError(400, "Controlla i campi inseriti.");
  }
  return value.trim();
}
export function passwordValue(value: unknown, creating = false): string {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !value.trim() ||
    (creating && value.length < 10)
  ) {
    throw new HttpError(
      400,
      creating
        ? "Usa una password di almeno 10 caratteri."
        : "Controlla la password inserita.",
    );
  }
  return value;
}
function identifier(value: unknown): string {
  const id = str(value, 100, true);
  if (
    !/^[a-zA-Z0-9_-]+$/.test(id) ||
    ["__proto__", "constructor", "prototype"].includes(id)
  ) {
    throw new HttpError(400, "Identificativo non valido.");
  }
  return id;
}
export function location(value: any) {
  if (
    !value ||
    !Number.isFinite(value.lat) ||
    !Number.isFinite(value.lng) ||
    Math.abs(value.lat) > 90 ||
    Math.abs(value.lng) > 180
  ) {
    throw new HttpError(400, "Coordinate non valide.");
  }
  return { lat: value.lat as number, lng: value.lng as number };
}
export function authorize(room: Room, identity: Identity) {
  if (![UserRole.PRODUCER, UserRole.RUNNER].includes(identity.role))
    throw new HttpError(401, "Sessione non valida.");
  if (
    identity.role === UserRole.RUNNER &&
    (!identity.runnerId ||
      !room.people.some(
        (p) => p.id === identity.runnerId && p.category === "RUNNER",
      ) ||
      !identity.inviteHash ||
      !Object.hasOwn(room.invites, identity.runnerId) ||
      room.invites[identity.runnerId] !== identity.inviteHash)
  ) {
    throw new HttpError(
      401,
      "Invito revocato. Richiedi un nuovo accesso al produttore.",
    );
  }
}
export function snapshot(
  room: Room,
  identity: Identity,
  version: number,
  now = Date.now(),
): Snapshot {
  authorize(room, identity);
  const producer = identity.role === UserRole.PRODUCER;
  return {
    session: {
      role: identity.role,
      runnerId: identity.runnerId,
      roomCode: identity.roomCode,
      roomName: room.name,
    },
    people: room.people
      .filter(
        (p) =>
          producer ||
          p.id === identity.runnerId ||
          p.assignedRunnerId === identity.runnerId,
      )
      .map((p) => ({
        ...p,
        isLive:
          !!p.isLive &&
          p.lastSeen !== undefined &&
          now - p.lastSeen <= LIVE_TIMEOUT_MS,
      })),
    sets: structuredClone(room.sets),
    producerInfo: { ...room.producerInfo },
    events: room.events
      .filter(
        (e) => producer || !e.runnerId || e.runnerId === identity.runnerId,
      )
      .map((e) => ({ ...e })),
    version,
  };
}

export function mutate(
  current: Room,
  identity: Identity,
  body: Record<string, any>,
  now = Date.now(),
): Room {
  authorize(current, identity);
  const room = structuredClone(current);
  const action = body.action;
  const producerActions = [
    "savePerson",
    "deletePerson",
    "saveSet",
    "deleteSet",
    "saveProducer",
    "createInvite",
  ];
  if (producerActions.includes(action) && identity.role !== UserRole.PRODUCER) {
    throw new HttpError(
      403,
      "Solo il produttore può modificare la produzione.",
    );
  }
  const event = (
    type: RunEvent["type"],
    message: string,
    personId?: string,
  ) => {
    room.events.push({
      id: randomUUID(),
      type,
      message,
      personId,
      runnerId: identity.runnerId,
      createdAt: now,
    });
    room.events = room.events.slice(-200);
  };
  if (action === "savePerson") {
    const p = body.person;
    if (!p || !["RUNNER", "ACTOR", "TROUPE"].includes(p.category))
      throw new HttpError(400, "Categoria non valida.");
    const id = identifier(p.id),
      previous = room.people.find((x) => x.id === id);
    if (previous && previous.category !== p.category)
      throw new HttpError(400, "La categoria di un contatto non può cambiare.");
    if (!previous && room.people.length >= 300)
      throw new HttpError(400, "Limite di 300 contatti per produzione.");
    const assigned =
      p.category === "RUNNER" ? "" : str(p.assignedRunnerId ?? "", 100);
    if (
      assigned &&
      !room.people.some((x) => x.id === assigned && x.category === "RUNNER")
    )
      throw new HttpError(400, "Runner assegnato non disponibile.");
    const name = str(p.name, 120, true);
    const person: Person = {
      id,
      name,
      category: p.category,
      role: str(p.role ?? "", 100),
      phone: str(p.phone ?? "", 40),
      address: str(p.address ?? "", 500),
      initials: name
        .split(/\s+/)
        .map((x) => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      // Producer forms never overwrite GPS samples or runtime pickup state.
      location:
        p.category === "RUNNER"
          ? (previous?.location ?? { lat: 0, lng: 0 })
          : location(p.location),
      assignedRunnerId: assigned || undefined,
      isRecovered: previous?.isRecovered ?? false,
      lastSeen: previous?.lastSeen,
      accuracy: previous?.accuracy,
      locationTimestamp: previous?.locationTimestamp,
      isLive: previous?.isLive ?? false,
      recoveredAt: previous?.recoveredAt,
    };
    room.people = previous
      ? room.people.map((x) => (x.id === id ? person : x))
      : [...room.people, person];
  } else if (action === "deletePerson") {
    const id = identifier(body.id);
    room.people = room.people
      .filter((p) => p.id !== id)
      .map((p) =>
        p.assignedRunnerId === id ? { ...p, assignedRunnerId: undefined } : p,
      );
    delete room.invites[id];
    if (room.sharingUpdates) delete room.sharingUpdates[id];
  } else if (action === "saveSet") {
    const s = body.set;
    if (!s) throw new HttpError(400, "Set non valido.");
    const item: SetPoint = {
      id: identifier(s.id),
      name: str(s.name, 120, true),
      address: str(s.address ?? "", 500),
      managerName: str(s.managerName ?? "", 120),
      phone: str(s.phone ?? "", 40),
      note: str(s.note ?? "", 2000),
      location: location(s.location),
    };
    const exists = room.sets.some((x) => x.id === item.id);
    if (!exists && room.sets.length >= 50)
      throw new HttpError(400, "Limite di 50 set.");
    room.sets = exists
      ? room.sets.map((x) => (x.id === item.id ? item : x))
      : [...room.sets, item];
    if (!exists) event("SET", `Nuovo set: ${item.name}. ${item.address}`);
  } else if (action === "deleteSet") {
    const id = identifier(body.id);
    room.sets = room.sets.filter((s) => s.id !== id);
  } else if (action === "saveProducer") {
    room.producerInfo = {
      name: str(body.producerInfo?.name, 120, true),
      phone: str(body.producerInfo?.phone ?? "", 40),
    };
  } else if (action === "createInvite") {
    const id = identifier(body.runnerId);
    if (!room.people.some((p) => p.id === id && p.category === "RUNNER"))
      throw new HttpError(404, "Runner non trovato.");
    // This value is generated by the API, never accepted from a client payload.
    if (
      typeof body.accessCode !== "string" ||
      !/^[A-Za-z0-9_-]{32}$/.test(body.accessCode)
    )
      throw new HttpError(400, "Invito non valido.");
    room.invites[id] = hash(body.accessCode);
    room.people = room.people.map((p) =>
      p.id === id ? { ...p, isLive: false } : p,
    );
    (room.sharingUpdates ??= {})[id] = { timestamp: now, sharing: false };
  } else if (["location", "pickup", "alert"].includes(action)) {
    if (identity.role !== UserRole.RUNNER)
      throw new HttpError(403, "Accedi come runner.");
    const runner = room.people.find((p) => p.id === identity.runnerId)!;
    if (action === "location") {
      const ts = body.timestamp;
      if (typeof body.sharing !== "boolean")
        throw new HttpError(400, "Indica se la posizione è condivisa.");
      if (!Number.isFinite(ts) || Math.abs(now - ts) > LIVE_TIMEOUT_MS)
        throw new HttpError(
          400,
          "Posizione scaduta: attendi un nuovo segnale GPS.",
        );
      const previous = room.sharingUpdates?.[runner.id] ?? {
        timestamp: runner.locationTimestamp ?? 0,
        sharing: !!runner.isLive,
      };
      const loc = body.sharing ? location(body.location) : undefined;
      if (
        body.sharing &&
        (!Number.isFinite(body.accuracy) ||
          body.accuracy < 0 ||
          body.accuracy > 10_000)
      )
        throw new HttpError(400, "Precisione GPS non valida.");
      // Stop wins ties. Late samples and late stops cannot undo a newer choice.
      if (
        ts > previous.timestamp ||
        (ts === previous.timestamp && !body.sharing)
      ) {
        (room.sharingUpdates ??= {})[runner.id] = {
          timestamp: ts,
          sharing: body.sharing,
        };
        runner.isLive = body.sharing;
        if (loc) {
          runner.location = loc;
          runner.locationTimestamp = ts;
          runner.lastSeen = now;
          runner.accuracy = body.accuracy;
        }
      }
    } else if (action === "pickup") {
      const person = room.people.find(
        (p) =>
          p.id === body.personId &&
          p.category !== "RUNNER" &&
          p.assignedRunnerId === runner.id,
      );
      if (!person)
        throw new HttpError(403, "Questa persona non è assegnata a te.");
      if (!person.isRecovered) {
        person.isRecovered = true;
        person.recoveredAt = now;
        event(
          "PICKUP",
          `${person.name} è stato recuperato da ${runner.name}.`,
          person.id,
        );
      }
    } else {
      if (!["TRAFFICO", "IMPREVISTO", "PAUSA BENZINA"].includes(body.type))
        throw new HttpError(400, "Segnalazione non valida.");
      if (
        room.events.some(
          (e) =>
            e.type === "ALERT" &&
            e.runnerId === runner.id &&
            now - e.createdAt < 10_000,
        )
      )
        throw new HttpError(
          429,
          "Attendi qualche secondo prima di inviare un’altra segnalazione.",
        );
      event("ALERT", `${runner.name}: ${body.type}`);
    }
  } else throw new HttpError(400, "Azione non valida.");
  return room;
}
