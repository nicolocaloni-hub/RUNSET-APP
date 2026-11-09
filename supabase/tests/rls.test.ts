// Verifica schema, RLS e funzioni RPC su un Postgres in-process (PGlite).
// auth.uid()/auth.jwt() sono simulati come su Supabase, leggendo i claim JWT
// dalle impostazioni di sessione.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const migrations = join(import.meta.dirname, "../migrations");
const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

let db: PGlite;
const PRODUCER = "00000000-0000-4000-8000-000000000001";
const OTHER_PRODUCER = "00000000-0000-4000-8000-000000000002";
const RUNNER_DEVICE = "00000000-0000-4000-8000-000000000003";
const ANON = "00000000-0000-4000-8000-000000000004";

/** Runs a statement as an authenticated Supabase user. */
async function as<T = Record<string, unknown>>(
  user: string,
  sql: string,
  params: unknown[] = [],
  anonymous = false,
): Promise<T[]> {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify({ sub: user, role: "authenticated", is_anonymous: anonymous }),
  ]);
  await db.exec("set role authenticated");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}
const rpc = async (user: string, call: string, params: unknown[] = [], anonymous = false) =>
  Object.values((await as(user, `select ${call} as result`, params, anonymous))[0])[0] as any;

let production: string;
let runner: string;
let actor: string;
let otherProduction: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(bootstrap);
  for (const file of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(migrations, file), "utf8"));
  await db.exec(
    `insert into auth.users(id) values ('${PRODUCER}'),('${OTHER_PRODUCER}'),('${RUNNER_DEVICE}'),('${ANON}')`,
  );
  production = await rpc(PRODUCER, "public.create_production($1,$2)", ["Il film", "Nicolò"]);
  otherProduction = await rpc(OTHER_PRODUCER, "public.create_production($1,$2)", ["Altro", "Anna"]);
  [{ id: runner }] = await as<{ id: string }>(
    PRODUCER,
    "insert into public.people(production_id,category,name) values ($1,'RUNNER','Luca Runner') returning id",
    [production],
  );
  [{ id: actor }] = await as<{ id: string }>(
    PRODUCER,
    "insert into public.people(production_id,category,name,lat,lng,assigned_runner_id) values ($1,'ACTOR','Sara Attrice',41.9,12.5,$2) returning id",
    [production, runner],
  );
  await as(
    PRODUCER,
    "insert into public.people(production_id,category,name,lat,lng) values ($1,'TROUPE','Gio Non Assegnato',41.9,12.5)",
    [production],
  );
});

describe("produzioni", () => {
  it("un account anonimo non può creare produzioni", async () => {
    await expect(
      rpc(ANON, "public.create_production($1,$2)", ["X", "Y"], true),
    ).rejects.toThrow(/producer_account_required/);
  });

  it("ogni produttore vede solo la propria produzione", async () => {
    const rows = await as(PRODUCER, "select id from public.productions");
    expect(rows.map((r) => r.id)).toEqual([production]);
    expect(await as(PRODUCER, "select * from public.people where production_id=$1", [otherProduction])).toEqual([]);
  });

  it("un produttore non può scrivere nella produzione di un altro", async () => {
    await expect(
      as(OTHER_PRODUCER, "insert into public.people(production_id,category,name) values ($1,'RUNNER','Intruso')", [production]),
    ).rejects.toThrow(/row-level security/);
    const updated = await as(OTHER_PRODUCER, "update public.productions set name='Hack' where id=$1 returning id", [production]);
    expect(updated).toEqual([]);
  });

  it("il produttore non può cambiare la giornata direttamente", async () => {
    await expect(
      as(PRODUCER, "update public.productions set day_number=9 where id=$1", [production]),
    ).rejects.toThrow(/permission denied/);
  });

  it("un runner non può essere assegnato da un'altra produzione", async () => {
    const [{ id: foreign }] = await as<{ id: string }>(
      OTHER_PRODUCER,
      "insert into public.people(production_id,category,name) values ($1,'RUNNER','Altro runner') returning id",
      [otherProduction],
    );
    await expect(
      as(PRODUCER, "update public.people set assigned_runner_id=$1 where id=$2", [foreign, actor]),
    ).rejects.toThrow(/runner_not_found/);
  });
});

describe("inviti e accesso runner", () => {
  let token: string;

  it("solo il produttore della produzione crea inviti", async () => {
    await expect(rpc(OTHER_PRODUCER, "public.create_invite($1)", [runner])).rejects.toThrow(/runner_not_found/);
    token = await rpc(PRODUCER, "public.create_invite($1)", [runner]);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const [{ token_hash }] = (await db.query<{ token_hash: string }>("select token_hash from public.invites")).rows;
    expect(token_hash).not.toBe(token);
    await expect(as(PRODUCER, "select token_hash from public.invites")).rejects.toThrow(/permission denied/);
    expect(await as(PRODUCER, "select runner_id from public.invites")).toEqual([{ runner_id: runner }]);
  });

  it("un token sbagliato viene rifiutato", async () => {
    await expect(rpc(RUNNER_DEVICE, "public.redeem_invite($1)", ["x".repeat(64)], true)).rejects.toThrow(/invite_invalid/);
  });

  it("il runner entra una sola volta con il link", async () => {
    expect(await rpc(RUNNER_DEVICE, "public.redeem_invite($1)", [token], true)).toBe(production);
    await expect(rpc(ANON, "public.redeem_invite($1)", [token], true)).rejects.toThrow(/invite_invalid/);
  });

  it("il runner vede solo sé stesso e le persone assegnate", async () => {
    const names = (await as<{ name: string }>(RUNNER_DEVICE, "select name from public.people order by name", [], true)).map((r) => r.name);
    expect(names).toEqual(["Luca Runner", "Sara Attrice"]);
    expect(await as(RUNNER_DEVICE, "select id from public.invites", [], true)).toEqual([]);
  });

  it("il runner non può modificare persone né set", async () => {
    const changed = await as(RUNNER_DEVICE, "update public.people set name='X' where id=$1 returning id", [actor], true);
    expect(changed).toEqual([]);
    await expect(
      as(RUNNER_DEVICE, "insert into public.sets(production_id,name,lat,lng) values ($1,'S',1,1)", [production], true),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("posizione GPS", () => {
  const now = Date.now();
  const at = (ms: number) => new Date(now + ms).toISOString();
  const position = () =>
    as<{ lat: number; sharing: boolean }>(PRODUCER, "select lat, sharing from public.runner_positions where runner_id=$1", [runner]);

  it("salva la posizione e la rende visibile al produttore", async () => {
    await rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,41.9,12.5,8)", [production, at(0)], true);
    expect(await position()).toEqual([{ lat: 41.9, sharing: true }]);
  });

  it("uno stop vince su un campione più vecchio arrivato in ritardo", async () => {
    await rpc(RUNNER_DEVICE, "public.report_position($1,false,$2)", [production, at(5000)], true);
    await rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,10,10,5)", [production, at(4000)], true);
    expect(await position()).toEqual([{ lat: 41.9, sharing: false }]);
  });

  it("rifiuta coordinate non valide", async () => {
    await expect(
      rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,200,12,5)", [production, at(9000)], true),
    ).rejects.toThrow(/invalid_position/);
  });

  it("avvisa una sola volta quando il runner è entro 250 m da una persona assegnata", async () => {
    const arriving = async () =>
      (await db.query<{ data: { meters: number; person: string } }>("select data from public.events where type='ARRIVING'")).rows;
    // Sara is at 41.9, 12.5: ~1.1 km north first, then ~110 m away.
    // The first test already reported her exact spot, so start from a clean slate.
    await db.query("delete from public.events where type='ARRIVING'");
    await rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,41.91,12.5,8)", [production, at(20_000)], true);
    expect(await arriving()).toEqual([]);
    await db.query("update public.runner_positions set updated_at = now() - interval '5 seconds'");
    await rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,41.901,12.5,8)", [production, at(30_000)], true);
    const first = await arriving();
    expect(first).toHaveLength(1);
    expect(first[0].data.person).toBe("Sara Attrice");
    expect(first[0].data.meters).toBeGreaterThan(100);
    expect(first[0].data.meters).toBeLessThan(120);
    await db.query("update public.runner_positions set updated_at = now() - interval '5 seconds'");
    await rpc(RUNNER_DEVICE, "public.report_position($1,true,$2,41.9005,12.5,8)", [production, at(40_000)], true);
    expect(await arriving()).toHaveLength(1);
  });

  it("il produttore non può inviare posizioni", async () => {
    await expect(rpc(PRODUCER, "public.report_position($1,false,$2)", [production, at(0)])).rejects.toThrow(/runner_required/);
  });
});

describe("recuperi", () => {
  it("conferma una sola volta e registra un evento", async () => {
    expect(await rpc(RUNNER_DEVICE, "public.confirm_pickup($1)", [actor], true)).toBe(true);
    expect(await rpc(RUNNER_DEVICE, "public.confirm_pickup($1)", [actor], true)).toBe(false);
    const events = await as<{ type: string }>(PRODUCER, "select type from public.events where type='PICKUP'");
    expect(events).toHaveLength(1);
  });

  it("non si può recuperare una persona non assegnata", async () => {
    const [{ id }] = await as<{ id: string }>(PRODUCER, "select id from public.people where name='Gio Non Assegnato'");
    await expect(rpc(RUNNER_DEVICE, "public.confirm_pickup($1)", [id], true)).rejects.toThrow(/person_not_assigned/);
  });

  it("il runner può annullare un recupero appena fatto", async () => {
    await rpc(RUNNER_DEVICE, "public.undo_pickup($1)", [actor], true);
    expect(await as(PRODUCER, "select * from public.pickups where undone_at is null")).toEqual([]);
    expect(await rpc(RUNNER_DEVICE, "public.confirm_pickup($1)", [actor], true)).toBe(true);
  });

  it("la nuova giornata azzera i recuperi attivi", async () => {
    expect(await rpc(PRODUCER, "public.start_new_day($1)", [production])).toBe(2);
    const active = await as(
      PRODUCER,
      "select pk.* from public.pickups pk join public.productions p on p.id=pk.production_id and p.day_number=pk.day_number where pk.undone_at is null",
    );
    expect(active).toEqual([]);
    await expect(rpc(RUNNER_DEVICE, "public.start_new_day($1)", [production], true)).rejects.toThrow(/producer_required/);
  });
});

describe("segnalazioni", () => {
  it("accetta solo i tipi previsti e limita la frequenza", async () => {
    await expect(rpc(RUNNER_DEVICE, "public.send_alert($1,$2)", [production, "BOH"], true)).rejects.toThrow(/invalid_alert/);
    await rpc(RUNNER_DEVICE, "public.send_alert($1,$2)", [production, "TRAFFIC"], true);
    await expect(rpc(RUNNER_DEVICE, "public.send_alert($1,$2)", [production, "FUEL"], true)).rejects.toThrow(/alert_throttled/);
  });
});

describe("conservazione dati", () => {
  it("la pulizia notturna elimina eventi oltre 90 giorni e posizioni vecchie", async () => {
    await db.query("update public.events set created_at = now() - interval '91 days' where type='ALERT'");
    await db.query("update public.runner_positions set updated_at = now() - interval '31 days'");
    await db.query("select private.purge_old_data()");
    expect((await db.query("select id from public.events where type='ALERT'")).rows).toEqual([]);
    expect((await db.query("select lat from public.runner_positions")).rows).toEqual([{ lat: null }]);
  });
});

describe("revoca", () => {
  it("un nuovo invito scollega subito il dispositivo precedente", async () => {
    await rpc(PRODUCER, "public.create_invite($1)", [runner]);
    expect(await as(RUNNER_DEVICE, "select * from public.people", [], true)).toEqual([]);
    await expect(rpc(RUNNER_DEVICE, "public.confirm_pickup($1)", [actor], true)).rejects.toThrow(/person_not_assigned/);
  });

  it("eliminare la produzione cancella tutti i dati collegati", async () => {
    await as(PRODUCER, "delete from public.productions where id=$1", [production]);
    for (const table of ["people", "sets", "pickups", "runner_positions", "events", "invites", "members"]) {
      const [{ count }] = (await db.query<{ count: number }>(
        `select count(*)::int as count from public.${table} where production_id=$1`,
        [production],
      )).rows;
      expect(count, table).toBe(0);
    }
  });
});
