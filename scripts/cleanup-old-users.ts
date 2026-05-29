import * as fs from "fs";
import * as path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
});

import("../src/generated/prisma/client.js").then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient();

  const oldIds = [
    "user_3ENrjl4R9yeoSYnPBSg6bNAPbC9",
    "user_3ENrk3kfyMVCz5ZpukpoQCPpQQk",
    "user_3ENrkFH8UK0KMurDN3s790BWnSf",
  ];

  const { count } = await prisma.user.deleteMany({ where: { id: { in: oldIds } } });
  console.log(`Deleted ${count} old Clerk-backed users.`);

  await prisma.$disconnect();
});
