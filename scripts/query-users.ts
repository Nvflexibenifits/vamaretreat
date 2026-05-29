import * as fs from "fs";
import * as path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
});

import("@clerk/backend").then(async ({ createClerkClient }) => {
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  const prisma = new PrismaClient();

  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  console.log("=== DB USERS ===");
  users.forEach((u: any) =>
    console.log(`  [${u.role}] ${u.name} | ${u.email} | id=${u.id} | active=${u.active}`)
  );
  console.log(`Total: ${users.length}`);

  await prisma.$disconnect();
});
