import type { RealtimeChannel } from "@supabase/supabase-js";
import { client } from "../lib/supabase";
import { Category, Location, Person, SetPoint, UserRole } from "../types";
import { initials } from "./proximity";
import type { AlertType, RunEvent, Snapshot } from "./protocol";

export interface Membership {
  productionId: string;
  productionName: string;
  role: UserRole;
  runnerId?: string;
}

/** Error with a translation key in `code` (see translations: err_*). */
export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

const KNOWN_CODES = [
  "producer_account_required", "productions_limit", "runner_not_found", "invite_invalid",
  "already_producer", "runner_required", "invalid_position", "person_not_assigned",
  "pickup_not_found", "undo_not_allowed", "invalid_alert", "alert_throttled",
  "producer_required", "people_limit", "sets_limit", "person_immutable", "config_missing",
  "geocode_failed", "geocode_rate_limited", "staff_limit", "invalid_email", "owner_cannot_leave",
];

/** Maps Supabase/Postgres/network failures to a translation key. */
export function errorCode(error: unknown): string {
  if (error instanceof AppError) return error.code;
  const message = String((error as { message?: string })?.message ?? error ?? "");
  const known = KNOWN_CODES.find((code) => message.includes(code));
  if (known) return known;
  if (/row-level security|permission denied|JWT|42501/i.test(message)) return "forbidden";
  if (/invalid login credentials/i.test(message)) return "login_failed";
  if (/already registered|already been registered/i.test(message)) return "email_taken";
  if (/password should be|weak password/i.test(message)) return "weak_password";
  if (/rate limit|too many/i.test(message)) return "rate_limited";
  if (/email not confirmed/i.test(message)) return "email_not_confirmed";
  if (/anonymous sign-ins are disabled/i.test(message)) return "anonymous_disabled";
  if (/fetch|network|Failed to fetch|timeout|NetworkError/i.test(message)) return "network";
  return "generic";
}

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw new AppError(errorCode(result.error));
  return result.data;
}
const rows = <T>(result: { data: T[] | null; error: unknown }): T[] => check(result) ?? [];

// ---------------------------------------------------------------------------
// Clock offset: lastSeen is server time; compare it with corrected client time.
// ---------------------------------------------------------------------------
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;
export async function syncClock() {
  const started = Date.now();
  const { data, error } = await client().rpc("server_time");
  if (error || typeof data !== "string") return;
  const roundTrip = Date.now() - started;
  clockOffset = Date.parse(data) + roundTrip / 2 - Date.now();
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function memberships(): Promise<Membership[]> {
  // Staff invited by email join their productions on sign-in (no-op for runner devices).
  await client().rpc("claim_staff_invites");
  const rows = check(
    await client()
      .from("members")
      .select("production_id, role, person_id, productions(name)")
      .eq("user_id", (await client().auth.getUser()).data.user?.id ?? ""),
  ) as unknown as {
    production_id: string;
    role: "producer" | "runner";
    person_id: string | null;
    productions: { name: string } | null;
  }[];
  return rows.map((row) => ({
    productionId: row.production_id,
    productionName: row.productions?.name ?? "",
    role: row.role === "producer" ? UserRole.PRODUCER : UserRole.RUNNER,
    runnerId: row.person_id ?? undefined,
  }));
}

const toLocation = (lat: number | null, lng: number | null): Location | undefined =>
  lat === null || lng === null ? undefined : { lat, lng };

/** Loads everything the signed-in user may see; RLS does the filtering. */
export async function loadSnapshot(membership: Membership): Promise<Snapshot | null> {
  const db = client();
  const id = membership.productionId;
  const production = check(
    await db.from("productions").select("id, name, producer_name, producer_phone, day_number").eq("id", id).maybeSingle(),
  );
  // No row: the production was deleted or this device's access was revoked.
  if (!production) return null;
  const [people, sets, pickups, positions, events] = await Promise.all([
    db.from("people").select("*").eq("production_id", id).order("created_at"),
    db.from("sets").select("*").eq("production_id", id).order("created_at"),
    db.from("pickups").select("person_id, runner_id, picked_at")
      .eq("production_id", id).eq("day_number", production.day_number).is("undone_at", null),
    db.from("runner_positions").select("*").eq("production_id", id),
    db.from("events").select("*").eq("production_id", id).order("created_at", { ascending: false }).limit(200),
  ]);
  const pickupByPerson = new Map(
    rows(pickups).map((p: { person_id: string; runner_id: string | null; picked_at: string }) => [p.person_id, p]),
  );
  const positionByRunner = new Map(
    rows(positions).map((p: PositionRow) => [p.runner_id, p]),
  );
  return {
    session: {
      role: membership.role,
      runnerId: membership.runnerId,
      productionId: id,
      productionName: production.name,
      dayNumber: production.day_number,
    },
    producerInfo: { name: production.producer_name, phone: production.producer_phone },
    people: rows(people).map((row: PersonRow) => {
      const person: Person = {
        id: row.id,
        name: row.name,
        role: row.role,
        phone: row.phone,
        address: row.address,
        category: row.category,
        initials: initials(row.name),
        location: toLocation(row.lat, row.lng),
        assignedRunnerId: row.assigned_runner_id ?? undefined,
        color: row.color ?? undefined,
        pickupTime: row.pickup_time?.slice(0, 5) ?? undefined,
      };
      if (row.category === "RUNNER") applyPosition(person, positionByRunner.get(row.id));
      const pickup = pickupByPerson.get(row.id);
      if (pickup) {
        person.isRecovered = true;
        person.recoveredAt = Date.parse(pickup.picked_at);
        person.recoveredBy = pickup.runner_id ?? undefined;
      }
      return person;
    }),
    sets: rows(sets).map((row: SetRow) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      managerName: row.manager_name,
      phone: row.phone,
      note: row.note,
      location: { lat: row.lat, lng: row.lng },
    })),
    events: rows(events)
      .map((row: EventRow) => ({
        id: row.id,
        type: row.type,
        data: row.data ?? {},
        createdAt: Date.parse(row.created_at),
        runnerId: row.runner_id ?? undefined,
        personId: row.person_id ?? undefined,
      }))
      .reverse(),
  };
}

export interface PositionRow {
  runner_id: string;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  sharing: boolean;
  updated_at: string;
  day_meters?: number;
  meters_day?: number | null;
}
interface PersonRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  address: string;
  category: Category;
  lat: number | null;
  lng: number | null;
  assigned_runner_id: string | null;
  color: string | null;
  pickup_time: string | null;
}
interface SetRow {
  id: string;
  name: string;
  address: string;
  manager_name: string;
  phone: string;
  note: string;
  lat: number;
  lng: number;
}
interface EventRow {
  id: string;
  type: RunEvent["type"];
  data: RunEvent["data"] | null;
  created_at: string;
  runner_id: string | null;
  person_id: string | null;
}

export function applyPosition(person: Person, row: PositionRow | undefined) {
  person.location = row ? toLocation(row.lat, row.lng) : undefined;
  person.sharing = row?.sharing ?? false;
  person.accuracy = row?.accuracy ?? undefined;
  person.lastSeen = row && row.lat !== null ? Date.parse(row.updated_at) : undefined;
  person.dayMeters = row?.day_meters;
  person.metersDay = row?.meters_day ?? undefined;
}

/**
 * Realtime: GPS rows arrive in `onPosition` and are applied directly; any other
 * change asks for a reload. RLS is enforced by Supabase on every payload.
 */
export function subscribe(
  productionId: string,
  onPosition: (row: PositionRow) => void,
  onChange: () => void,
  onStatus: (connected: boolean) => void,
): () => void {
  const db = client();
  const filter = `production_id=eq.${productionId}`;
  let channel: RealtimeChannel = db.channel(`production:${productionId}`);
  for (const table of ["people", "sets", "pickups", "events"])
    channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter }, onChange);
  channel = channel
    .on("postgres_changes", { event: "*", schema: "public", table: "productions", filter: `id=eq.${productionId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "runner_positions", filter }, (payload) => {
      if (payload.new && "runner_id" in payload.new) onPosition(payload.new as PositionRow);
      else onChange();
    });
  channel.subscribe((status) => onStatus(status === "SUBSCRIBED"));
  return () => void db.removeChannel(channel);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const rpc = async <T>(name: string, args: Record<string, unknown>) =>
  check(await client().rpc(name, args)) as T;

export const actions = {
  createProduction: (name: string, producerName: string) =>
    rpc<string>("create_production", { p_name: name, p_producer_name: producerName }),

  async savePerson(productionId: string, person: Person, isNew: boolean) {
    const fields = {
      name: person.name,
      role: person.role,
      phone: person.phone,
      address: person.address,
      // Runner positions come from GPS only; the form never writes them.
      lat: person.category === "RUNNER" ? null : person.location?.lat,
      lng: person.category === "RUNNER" ? null : person.location?.lng,
      assigned_runner_id: person.category === "RUNNER" ? null : person.assignedRunnerId || null,
      pickup_time: person.category === "RUNNER" ? null : person.pickupTime || null,
    };
    const table = client().from("people");
    check(
      isNew
        ? await table.insert({ ...fields, production_id: productionId, category: person.category })
        : await table.update(fields).eq("id", person.id),
    );
  },
  async runners(productionId: string) {
    return rows(
      await client().from("people").select("id, name").eq("production_id", productionId).eq("category", "RUNNER"),
    ) as { id: string; name: string }[];
  },
  async deletePerson(id: string) {
    check(await client().from("people").delete().eq("id", id));
  },
  async saveSet(productionId: string, set: SetPoint, isNew: boolean) {
    const fields = {
      name: set.name,
      address: set.address,
      manager_name: set.managerName,
      phone: set.phone,
      note: set.note,
      lat: set.location.lat,
      lng: set.location.lng,
    };
    const table = client().from("sets");
    check(
      isNew
        ? await table.insert({ ...fields, production_id: productionId })
        : await table.update(fields).eq("id", set.id),
    );
  },
  async deleteSet(id: string) {
    check(await client().from("sets").delete().eq("id", id));
  },
  async saveProduction(id: string, values: { name: string; producerName: string; producerPhone: string }) {
    check(
      await client()
        .from("productions")
        .update({ name: values.name, producer_name: values.producerName, producer_phone: values.producerPhone })
        .eq("id", id),
    );
  },
  async deleteProduction(id: string) {
    const deleted = check(await client().from("productions").delete().eq("id", id).select("id"));
    if (!deleted?.length) throw new AppError("forbidden");
  },
  createInvite: (runnerId: string) => rpc<string>("create_invite", { p_runner: runnerId }),
  redeemInvite: (token: string) => rpc<string>("redeem_invite", { p_token: token }),
  confirmPickup: (personId: string) => rpc<boolean>("confirm_pickup", { p_person: personId }),
  undoPickup: (personId: string) => rpc<void>("undo_pickup", { p_person: personId }),
  sendAlert: (productionId: string, type: AlertType) =>
    rpc<void>("send_alert", { p_production: productionId, p_type: type }),
  inviteStaff: (productionId: string, email: string) =>
    rpc<void>("invite_staff", { p_production: productionId, p_email: email }),
  listStaff: (productionId: string) =>
    rpc<{ user_id: string; email: string; is_owner: boolean }[]>("list_staff", { p_production: productionId }),
  async pendingStaff(productionId: string) {
    return rows(await client().from("staff_invites").select("id, email").eq("production_id", productionId)) as {
      id: string;
      email: string;
    }[];
  },
  async cancelStaffInvite(id: string) {
    check(await client().from("staff_invites").delete().eq("id", id));
  },
  removeStaff: (productionId: string, userId: string) =>
    rpc<void>("remove_staff", { p_production: productionId, p_user: userId }),
  savePushSubscription: (endpoint: string, p256dh: string, auth: string, lang: string) =>
    rpc<void>("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_lang: lang }),
  deletePushSubscription: (endpoint: string) => rpc<void>("delete_push_subscription", { p_endpoint: endpoint }),
  startNewDay: (productionId: string) => rpc<number>("start_new_day", { p_production: productionId }),
  reportPosition: (productionId: string, sharing: boolean, timestamp: number, fix?: { lat: number; lng: number; accuracy: number }) =>
    rpc<void>("report_position", {
      p_production: productionId,
      p_sharing: sharing,
      p_client_ts: new Date(timestamp).toISOString(),
      p_lat: fix?.lat ?? null,
      p_lng: fix?.lng ?? null,
      p_accuracy: fix ? Math.min(10_000, Math.max(0, fix.accuracy)) : null,
    }),
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

/** Address search through our server, so the browser never sends addresses to third parties. */
export async function geocode(query: string, language: string): Promise<GeocodeResult[]> {
  const token = (await client().auth.getSession()).data.session?.access_token;
  let response: Response;
  try {
    response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ q: query, language }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new AppError("network");
  }
  if (response.status === 429) throw new AppError("geocode_rate_limited");
  if (!response.ok) throw new AppError("geocode_failed");
  const body = (await response.json()) as { results?: GeocodeResult[] };
  return body.results ?? [];
}
