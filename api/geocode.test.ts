import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import handler, { parseResults } from "./geocode";

function call(body: unknown, authorization?: string) {
  const req = Object.assign(Readable.from([JSON.stringify(body)]), {
    method: "POST",
    headers: authorization ? { authorization } : {},
  });
  let status = 0;
  let payload = "";
  const res = {
    setHeader: () => {},
    set statusCode(value: number) {
      status = value;
    },
    end: (value: string) => {
      payload = value;
    },
  };
  return handler(req as never, res as never).then(() => ({ status, body: JSON.parse(payload) }));
}

const user = (overrides: object) =>
  new Response(JSON.stringify({ id: "u1", is_anonymous: false, ...overrides }), { status: 200 });

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
});
afterEach(() => vi.unstubAllGlobals());

describe("api/geocode", () => {
  it("rifiuta richieste senza sessione", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect((await call({ q: "Via Roma 1" })).status).toBe(401);
  });

  it("rifiuta i runner (account anonimi)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => user({ is_anonymous: true })));
    expect((await call({ q: "Via Roma 1" }, "Bearer token-di-prova-lungo")).status).toBe(401);
  });

  it("cerca con User-Agent identificativo e limita a una richiesta al secondo", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      url.includes("/auth/v1/user")
        ? user({ id: "u-rate" })
        : new Response(JSON.stringify([{ lat: "41.9", lon: "12.5", display_name: "Via Roma 1, Roma" }])),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = await call({ q: "Via Roma 1" }, "Bearer token-di-prova-lungo");
    expect(first).toEqual({ status: 200, body: { results: [{ lat: 41.9, lng: 12.5, label: "Via Roma 1, Roma" }] } });
    const upstream = fetchMock.mock.calls.find(([url]) => url.includes("nominatim"));
    expect((upstream?.[1] as RequestInit).headers).toMatchObject({ "User-Agent": expect.stringContaining("RunSet") });
    expect((await call({ q: "Via Roma 2" }, "Bearer token-di-prova-lungo")).status).toBe(429);
  });

  it("scarta risultati con coordinate non valide", () => {
    expect(parseResults([{ lat: "100", lon: "0" }, { lat: "1", lon: "2", display_name: "ok" }, null])).toEqual([
      { lat: 1, lng: 2, label: "ok" },
    ]);
    expect(parseResults({})).toEqual([]);
  });
});
