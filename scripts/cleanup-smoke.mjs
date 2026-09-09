import { readFile, unlink } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
const { roomCode } = JSON.parse(
  await readFile(".cache/smoke-session.json", "utf8"),
);
if (!/^[A-F0-9]{10}$/.test(roomCode)) throw new Error("Invalid test room code");
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`SELECT data FROM runset_rooms WHERE code=${roomCode}`;
if (rows.length && !rows[0].data.name.startsWith("RunSet collaudo "))
  throw new Error("Refusing to remove non-test production");
await sql.transaction([
  sql`DELETE FROM runset_sessions WHERE identity->>'roomCode'=${roomCode}`,
  sql`DELETE FROM runset_rooms WHERE code=${roomCode} AND data->>'name' LIKE 'RunSet collaudo %'`,
]);
await unlink(".cache/smoke-session.json");
console.log("Temporary test production removed.");
