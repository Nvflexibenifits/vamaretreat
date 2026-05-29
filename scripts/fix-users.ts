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
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  // 1. Remove legacy owner-001 user (no Clerk account, causes duplicate Admin on login)
  console.log("Removing legacy owner-001 user from DB...");
  await prisma.user.deleteMany({ where: { id: "owner-001" } });
  console.log("  Done.");

  // 2. Update passwords for all Clerk-backed users to Vama@2026
  const clerkUsers = [
    "user_3ENrjl4R9yeoSYnPBSg6bNAPbC9", // admin@vamaretreats.com
    "user_3ENrk3kfyMVCz5ZpukpoQCPpQQk", // sales@vamaretreats.com
    "user_3ENrkFH8UK0KMurDN3s790BWnSf",  // frontoffice@vamaretreats.com
  ];

  console.log("\nUpdating Clerk passwords to Vama@2026...");
  for (const id of clerkUsers) {
    try {
      await clerk.users.updateUser(id, { password: "Vama@2026" });
      console.log(`  Updated: ${id}`);
    } catch (e) {
      console.error(`  Failed for ${id}:`, e);
    }
  }

  await prisma.$disconnect();
  console.log("\nDone. All users can now sign in with Vama@2026.");
});
