import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

// Load DATABASE_URL from .env manually
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const match = env.match(/DATABASE_URL="([^"]+)"/);
if (!match) { console.error("DATABASE_URL not found in .env"); process.exit(1); }

const sql = neon(match[1]);

const tables = [
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS room_inventory (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS venues (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS venue_blocks (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bulk_room_blocks (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS special_days (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS credit_notes (
    code TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
  )`,
];

console.log("Creating tables in Neon...");
for (const ddl of tables) {
  const name = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/)[1];
  try {
    await sql.query(ddl);
    console.log(`  created: ${name}`);
  } catch (err) {
    console.error(`  failed:  ${name} —`, err.message);
  }
}
console.log("Done.");
