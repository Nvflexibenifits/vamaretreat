import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";

// Load .env before importing Prisma (needs DATABASE_URL)
const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
});

const users = [
  { id: "user-admin",       name: "Admin",        role: "Admin",       email: "admin@vamaretreats.com",       color: "#0f2318" },
  { id: "user-sales",       name: "Sales User",   role: "Sales",       email: "sales@vamaretreats.com",       color: "#172f24" },
  { id: "user-frontoffice", name: "Front Office", role: "FrontOffice", email: "frontoffice@vamaretreats.com", color: "#1a4fd6" },
];

import("../src/generated/prisma/client.js").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();
  const hashed = await bcrypt.hash("Vama@2026", 10);
  console.log("Password hashed.");

  for (const u of users) {
    console.log(`\nProcessing: ${u.name} (${u.email})`);
    try {
      await prisma.user.upsert({
        where: { id: u.id },
        update: { name: u.name, email: u.email, color: u.color, active: true, password: hashed },
        create: {
          id: u.id,
          name: u.name,
          role: u.role as never,
          email: u.email,
          color: u.color,
          active: true,
          password: hashed,
        },
      });
      console.log(`  DB: upserted`);
    } catch (e) {
      console.error(`  DB error:`, e);
    }
  }

  await prisma.$disconnect();
  console.log("\nDone.");
});
