// Edge Function "push": invia le notifiche push ai produttori.
// POST dal database (trigger events_push) con il segreto del Vault;
// GET dal browser per leggere la chiave pubblica VAPID.
// Le chiavi VAPID nascono qui al primo avvio e restano nel Vault.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

type Lang = "it" | "en";
type Sub = { endpoint: string; p256dh: string; auth: string; lang: Lang };
type Data = { person?: string; runner?: string; alert?: string; meters?: number; time?: string };

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const ALERTS = {
  it: { TRAFFIC: "Traffico", INCIDENT: "Imprevisto", FUEL: "Pausa benzina" },
  en: { TRAFFIC: "Traffic", INCIDENT: "Incident", FUEL: "Fuel stop" },
} as const;

// Stessi testi di translations.ts (ev_*, notify_*): qui servono senza l'app aperta.
function text(type: string, d: Data, lang: Lang): { title: string; body: string } | null {
  const it = lang === "it";
  const alert = ALERTS[lang][d.alert as keyof (typeof ALERTS)["it"]] ?? d.alert ?? "";
  switch (type) {
    case "PICKUP":
      return it
        ? { title: "Recupero completato", body: `${d.person} è stato recuperato da ${d.runner}.` }
        : { title: "Pickup completed", body: `${d.person} was picked up by ${d.runner}.` };
    case "ARRIVING":
      return it
        ? { title: "Runner in arrivo", body: `${d.runner} sta arrivando da ${d.person} · ${d.meters} m` }
        : { title: "Runner arriving", body: `${d.runner} is arriving at ${d.person} · ${d.meters} m` };
    case "ALERT":
      return { title: it ? "Segnalazione" : "Runner alert", body: `${d.runner}: ${alert}` };
    case "LATE":
      return it
        ? {
            title: "Possibile ritardo",
            body: d.meters == null
              ? `${d.person} è convocato alle ${d.time}: ${d.runner} non condivide il GPS.`
              : `${d.person} è convocato alle ${d.time}: ${d.runner} è ancora a ${(d.meters / 1000).toFixed(1)} km.`,
          }
        : {
            title: "Possible delay",
            body: d.meters == null
              ? `${d.person} is due at ${d.time}: ${d.runner} is not sharing GPS.`
              : `${d.person} is due at ${d.time}: ${d.runner} is still ${(d.meters / 1000).toFixed(1)} km away.`,
          };
    default:
      return null;
  }
}

async function config(): Promise<Record<string, string>> {
  const read = async () => {
    const { data, error } = await db.rpc("push_config");
    if (error) throw error;
    return data as Record<string, string>;
  };
  let current = await read();
  if (!current.runset_vapid_public) {
    const keys = webpush.generateVAPIDKeys();
    const { error } = await db.rpc("push_store_vapid", { p_public: keys.publicKey, p_private: keys.privateKey });
    if (error) throw error;
    current = await read();
  }
  return current;
}

function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const cfg = await config();
    if (req.method === "GET") return Response.json({ publicKey: cfg.runset_vapid_public }, { headers: cors });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!cfg.runset_push_secret || !sameSecret(req.headers.get("Authorization") ?? "", `Bearer ${cfg.runset_push_secret}`))
      return new Response("Unauthorized", { status: 401 });

    const { event, subs } = (await req.json()) as { event: { id: string; type: string; data: Data }; subs: Sub[] };
    webpush.setVapidDetails("mailto:runset.smartset@gmail.com", cfg.runset_vapid_public, cfg.runset_vapid_private);
    const gone: string[] = [];
    await Promise.all(
      (subs ?? []).slice(0, 200).map(async (sub) => {
        const message = text(event.type, event.data ?? {}, sub.lang === "en" ? "en" : "it");
        if (!message) return;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ ...message, tag: event.id }),
            { TTL: 600, urgency: "high" },
          );
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(sub.endpoint);
        }
      }),
    );
    if (gone.length) await db.rpc("push_forget", { p_endpoints: gone });
    return Response.json({ sent: (subs?.length ?? 0) - gone.length });
  } catch (error) {
    console.error("push failed", error);
    return new Response("Error", { status: 500, headers: cors });
  }
});
