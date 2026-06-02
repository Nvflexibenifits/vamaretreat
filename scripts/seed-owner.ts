import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

// Load .env before connecting (needs DATABASE_URL)
const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
});

const seedUsers = [
  { id: "user-admin",       name: "Admin",        role: "Admin",        email: "admin@vamaretreats.com",       color: "#0f2318" },
  { id: "user-sales",       name: "Sales User",   role: "Sales",        email: "sales@vamaretreats.com",       color: "#172f24" },
  { id: "user-frontoffice", name: "Front Office", role: "Front Office", email: "frontoffice@vamaretreats.com", color: "#1a4fd6" },
];

import("@neondatabase/serverless").then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL!);
  const hashed = await bcrypt.hash("Vama@2026", 10);
  console.log("Password hashed.");

  for (const u of seedUsers) {
    console.log(`\nProcessing: ${u.name} (${u.email})`);
    try {
      await sql`
        INSERT INTO "User" (id, name, role, email, color, active, password)
        VALUES (${u.id}, ${u.name}, ${u.role}, ${u.email}, ${u.color}, true, ${hashed})
        ON CONFLICT (id) DO UPDATE
        SET name = ${u.name}, email = ${u.email}, color = ${u.color}, active = true, password = ${hashed}
      `;
      console.log(`  DB: upserted`);
    } catch (e) {
      console.error(`  DB error:`, e);
    }
  }

  console.log("\nDone.");
});
