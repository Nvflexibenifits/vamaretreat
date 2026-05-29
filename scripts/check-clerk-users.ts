import * as fs from "fs";
import * as path from "path";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^=]+)="?([^"]*)"?$/);
  if (match) process.env[match[1]] = match[2];
});

import("@clerk/backend").then(async ({ createClerkClient }) => {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

  const ids = [
    "user_3ENrjl4R9yeoSYnPBSg6bNAPbC9", // admin
    "user_3ENrk3kfyMVCz5ZpukpoQCPpQQk", // sales
    "user_3ENrkFH8UK0KMurDN3s790BWnSf",  // frontoffice
  ];

  for (const id of ids) {
    const u = await clerk.users.getUser(id);
    console.log(`\n${u.firstName} (${u.emailAddresses[0]?.emailAddress})`);
    console.log(`  twoFactorEnabled: ${u.twoFactorEnabled}`);
    console.log(`  phoneNumbers: ${JSON.stringify(u.phoneNumbers)}`);
    console.log(`  totpEnabled: ${u.totpEnabled}`);
    console.log(`  emailAddresses verified: ${u.emailAddresses.map(e => `${e.emailAddress}=${e.verification?.status}`).join(", ")}`);
  }
});
