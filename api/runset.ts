import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { db, initialize, rateLimit } from "../server/db.js";
import {
  authorize,
  hash,
  HttpError,
  type Identity,
  mutate,
  passwordHash,
  passwordValue,
  type Room,
  snapshot,
  str,
  token,
  verifyPassword,
} from "../server/model.js";
import { UserRole } from "../types.js";
type Req = IncomingMessage & { body?: Record<string, any> };
async function readBody(req: Req) {
  if (req.body !== undefined) {
    const encoded =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(encoded) > 65536)
      throw new HttpError(413, "Richiesta troppo grande.");
    try {
      return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      throw new HttpError(400, "Richiesta non valida.");
    }
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 65536)
      throw new HttpError(413, "Richiesta troppo grande.");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new HttpError(400, "Richiesta non valida.");
  }
}
function cookie(res: ServerResponse, value: string, maxAge = 604800) {
  res.setHeader(
    "Set-Cookie",
    `runset_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.VERCEL ? " ; Secure" : ""}`,
  );
}
export default async function handler(req: Req, res: ServerResponse) {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Vary", "Cookie");
  const send = (status: number, value: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  try {
    if (!["GET", "POST"].includes(req.method ?? "")) {
      res.setHeader("Allow", "GET, POST");
      throw new HttpError(405, "Metodo non consentito.");
    }
    if (req.method === "POST") {
      let origin: URL | undefined;
      try {
        origin = req.headers.origin ? new URL(req.headers.origin) : undefined;
      } catch {
        throw new HttpError(403, "Origine non consentita.");
      }
      if (
        (origin &&
          (origin.host !== req.headers.host ||
            !["http:", "https:"].includes(origin.protocol))) ||
        req.headers["sec-fetch-site"] === "cross-site"
      )
        throw new HttpError(403, "Origine non consentita.");
    }
    const body = req.method === "POST" ? await readBody(req) : {};
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new HttpError(400, "Richiesta non valida.");
    const sid = (req.headers.cookie ?? "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("runset_session="))
      ?.slice(15);
    if (body.action === "logout") {
      if (sid && process.env.DATABASE_URL) {
        await initialize();
        await db()`DELETE FROM runset_sessions WHERE token_hash=${hash(sid)}`;
      }
      cookie(res, "", 0);
      send(200, { ok: true });
      return;
    }
    await initialize();
    const sql = db();
    const action = body.action;
    if (["createRoom", "loginProducer", "joinRunner"].includes(action)) {
      const ip = String(
        req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown",
      ).split(",")[0];
      await rateLimit("auth:" + hash(ip), 30);
      await sql`DELETE FROM runset_limits WHERE expires_at<now()`;
      await sql`DELETE FROM runset_sessions WHERE expires_at<now()`;
      let identity: Identity,
        room: Room,
        version = 1;
      if (action === "createRoom") {
        await rateLimit("create:" + hash(ip), 5, 3600);
        const password = passwordValue(body.password, true);
        const code = randomBytes(5).toString("hex").toUpperCase();
        room = {
          name: str(body.name, 120, true),
          password: await passwordHash(password),
          people: [],
          sets: [],
          producerInfo: { name: str(body.producerName, 120, true), phone: "" },
          events: [],
          invites: {},
        };
        await sql`INSERT INTO runset_rooms(code,data) VALUES(${code},${JSON.stringify(room)}::jsonb)`;
        identity = { roomCode: code, role: UserRole.PRODUCER };
      } else {
        const code = str(body.roomCode, 32, true).toUpperCase();
        await rateLimit("room:" + hash(code), 40);
        const rows =
          await sql`SELECT data,version FROM runset_rooms WHERE code=${code}`;
        if (!rows.length)
          throw new HttpError(
            401,
            "Codice produzione o credenziali non validi.",
          );
        room = rows[0].data as Room;
        version = rows[0].version;
        if (action === "loginProducer") {
          if (
            !(await verifyPassword(passwordValue(body.password), room.password))
          )
            throw new HttpError(
              401,
              "Codice produzione o credenziali non validi.",
            );
          identity = { roomCode: code, role: UserRole.PRODUCER };
        } else {
          const inviteHash = hash(str(body.accessCode, 100, true));
          const runnerId = Object.keys(room.invites).find(
            (id) => room.invites[id] === inviteHash,
          );
          if (!runnerId)
            throw new HttpError(401, "Codice produzione o invito non validi.");
          identity = {
            roomCode: code,
            role: UserRole.RUNNER,
            runnerId,
            inviteHash,
          };
          authorize(room, identity);
        }
      }
      const session = token();
      await sql`INSERT INTO runset_sessions(token_hash,identity,expires_at) VALUES(${hash(session)},${JSON.stringify(identity)}::jsonb,now()+interval '7 days')`;
      cookie(res, session);
      send(200, snapshot(room, identity, version));
      return;
    }
    if (!sid) throw new HttpError(401, "Accedi alla tua produzione.");
    const sessions =
      await sql`SELECT identity FROM runset_sessions WHERE token_hash=${hash(sid)} AND expires_at>now()`;
    if (!sessions.length)
      throw new HttpError(401, "Sessione scaduta. Accedi di nuovo.");
    const identity = sessions[0].identity as Identity;
    // Generate once, outside the compare-and-swap retry loop.
    const accessCode = action === "createInvite" ? token() : undefined;
    for (let attempt = 0; attempt < 8; attempt++) {
      const rows =
        await sql`SELECT data,version FROM runset_rooms WHERE code=${identity.roomCode}`;
      if (!rows.length) throw new HttpError(401, "Produzione non disponibile.");
      const row = rows[0];
      const room = row.data as Room;
      authorize(room, identity);
      if (req.method === "GET") {
        send(200, snapshot(room, identity, row.version));
        return;
      }
      const updated = mutate(room, identity, { ...body, accessCode });
      const changed =
        await sql`UPDATE runset_rooms SET data=${JSON.stringify(updated)}::jsonb,version=version+1 WHERE code=${identity.roomCode} AND version=${row.version} RETURNING version`;
      if (changed.length) {
        send(200, {
          ...snapshot(updated, identity, changed[0].version),
          ...(accessCode ? { accessCode } : {}),
        });
        return;
      }
    }
    throw new HttpError(409, "Produzione in aggiornamento. Riprova.");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500)
      console.error(
        "RunSet API failure",
        error instanceof Error ? error.name : "Unknown",
      );
    send(status, {
      error:
        error instanceof HttpError
          ? error.message
          : "Servizio temporaneamente non disponibile. Riprova.",
    });
  }
}
