// Ricerca indirizzi per i produttori. Passa da qui perché il browser non invii
// gli indirizzi di cast e troupe a servizi terzi, e per rispettare la policy di
// Nominatim (User-Agent identificativo, massimo 1 richiesta al secondo).
import type { IncomingMessage, ServerResponse } from "node:http";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "RunSet/2.0 (+https://runset-app.vercel.app)";

// shortcut: limiti in memoria per singola istanza serverless; con traffico alto
// passare a un limitatore condiviso (tabella Supabase o Vercel KV).
const lastRequestByUser = new Map<string, number>();
let nextUpstreamSlot = 0;

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

export function parseResults(raw: unknown): GeocodeResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      lat: Number(item?.lat),
      lng: Number(item?.lon),
      label: String(item?.display_name ?? "").slice(0, 300),
    }))
    .filter(
      (r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180,
    )
    .slice(0, 3);
}

async function readJson(req: IncomingMessage & { body?: unknown }): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === "object") return req.body as Record<string, unknown>;
  let body = typeof req.body === "string" ? req.body : "";
  if (!body)
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) throw new Error("too_large");
    }
  const parsed = JSON.parse(body || "{}");
  return parsed && typeof parsed === "object" ? parsed : {};
}

/** Returns the Supabase user id for a real (non-anonymous) account, or null. */
async function producerId(authorization: string | undefined): Promise<string | null> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !authorization?.startsWith("Bearer ") || authorization.length < 20) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: authorization },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return null;
  const user = (await response.json()) as { id?: string; is_anonymous?: boolean };
  return user.id && !user.is_anonymous ? user.id : null;
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, value: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return send(405, { error: "method_not_allowed" });
    }
    const userId = await producerId(req.headers.authorization);
    if (!userId) return send(401, { error: "unauthorized" });

    const body = await readJson(req);
    const query = typeof body.q === "string" ? body.q.trim() : "";
    const language = body.language === "en" ? "en" : "it";
    if (query.length < 3 || query.length > 300) return send(400, { error: "invalid_query" });

    const now = Date.now();
    if (now - (lastRequestByUser.get(userId) ?? 0) < 1000) return send(429, { error: "rate_limited" });
    lastRequestByUser.set(userId, now);
    if (lastRequestByUser.size > 5000) lastRequestByUser.clear();

    // Serialize upstream calls to at most one per second from this instance.
    const wait = Math.max(0, nextUpstreamSlot - now);
    if (wait > 3000) return send(429, { error: "rate_limited" });
    nextUpstreamSlot = now + wait + 1100;
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));

    const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "3", "accept-language": language });
    const upstream = await fetch(`${NOMINATIM}?${params}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return send(502, { error: "upstream_failed" });
    send(200, { results: parseResults(await upstream.json()) });
  } catch (error) {
    console.error("geocode failure", error instanceof Error ? error.name : "unknown");
    send(502, { error: "upstream_failed" });
  }
}
