import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { HttpError } from "./model.js";
let client: NeonQueryFunction<false, false> | undefined;
let initialized: Promise<void> | undefined;
export function db() {
  if (!process.env.DATABASE_URL)
    throw new HttpError(
      503,
      "Database non ancora collegato. Riprova tra poco.",
    );
  return (client ??= neon(process.env.DATABASE_URL));
}
export async function initialize() {
  await (initialized ??= (async () => {
    const sql = db();
    await sql`CREATE TABLE IF NOT EXISTS runset_rooms (code text PRIMARY KEY, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1)`;
    await sql`CREATE TABLE IF NOT EXISTS runset_sessions (token_hash text PRIMARY KEY, identity jsonb NOT NULL, expires_at timestamptz NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS runset_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
  })().catch((error) => {
    initialized = undefined;
    throw error;
  }));
}
export async function rateLimit(key: string, limit: number, seconds = 600) {
  const sql = db();
  const bucket = key + ":" + Math.floor(Date.now() / (seconds * 1000));
  const rows =
    await sql`INSERT INTO runset_limits(key,count,expires_at) VALUES(${bucket},1,now()+${seconds}*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=runset_limits.count+1 RETURNING count`;
  if (rows[0].count > limit)
    throw new HttpError(429, "Troppi tentativi. Riprova più tardi.");
}
