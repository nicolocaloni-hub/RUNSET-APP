import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL)
  throw new Error("Missing DATABASE_URL. Run vercel env pull first.");
const sql = neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS runset_rooms (code text PRIMARY KEY, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1)`;
await sql`CREATE TABLE IF NOT EXISTS runset_sessions (token_hash text PRIMARY KEY, identity jsonb NOT NULL, expires_at timestamptz NOT NULL)`;
await sql`CREATE TABLE IF NOT EXISTS runset_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL)`;
console.log("RunSet database schema ready.");
