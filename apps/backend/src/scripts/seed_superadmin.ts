/**
 * Super Admin Seed Script
 * Run once with: npx ts-node -r dotenv/config src/scripts/seed_superadmin.ts
 *
 * Creates a super admin owner account with a dedicated "Admin" store.
 * After running, log in to the Owner_page with the credentials below.
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Store } from "../Models/Store.model";
import { OwnerModel } from "../Models/Owner.model";

const SUPERADMIN_EMAIL    = "superadmin@lnmbytes.admin";
const SUPERADMIN_PASSWORD = "LNMBytes@2026";
const SUPERADMIN_NAME     = "Super Admin";
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  const DB_URI = process.env.DB_CONNECTION_STRING!;
  const DB_NAME = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

  if (!DB_URI) {
    console.error("❌  DB_CONNECTION_STRING not set in .env");
    process.exit(1);
  }

  await mongoose.connect(DB_URI, { dbName: DB_NAME });
  console.log("✅  Connected to MongoDB");

  // Check if superadmin already exists
  const existing = await OwnerModel.findOne({ email: SUPERADMIN_EMAIL });
  if (existing) {
    console.log(`ℹ️   Super admin already exists (${SUPERADMIN_EMAIL})`);
    console.log(`    Role: ${existing.role}  |  isApproved: ${existing.isApproved}`);
    await mongoose.disconnect();
    return;
  }

  // Create a dedicated "Admin" store
  const store = await Store.create({
    name: "Admin HQ",
    description: "Super admin control store — not a real canteen.",
    phone: "0000000000",
    ownerName: SUPERADMIN_NAME,
    location: "LNMIIT Admin Office",
    operationTime: { openTime: "00:00", closeTime: "23:59" },
    isActive: true,
    status: "open",
  });

  // Hash password manually (model pre-save hook won't run with create+plain text)
  const hashedPassword = await bcrypt.hash(SUPERADMIN_PASSWORD, 10);

  await OwnerModel.collection.insertOne({
    name: SUPERADMIN_NAME,
    email: SUPERADMIN_EMAIL,
    password: hashedPassword,
    storeId: store._id,
    role: "superadmin",
    isApproved: true,       // always approved
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("\n🎉  Super Admin created successfully!\n");
  console.log("┌──────────────────────────────────────────┐");
  console.log("│        SUPER ADMIN LOGIN CREDENTIALS      │");
  console.log("├──────────────────────────────────────────┤");
  console.log(`│  Email   :  ${SUPERADMIN_EMAIL.padEnd(28)}│`);
  console.log(`│  Password:  ${SUPERADMIN_PASSWORD.padEnd(28)}│`);
  console.log("└──────────────────────────────────────────┘");
  console.log("\n → Open Owner_page → login with the above credentials");
  console.log(" → You'll see 👑 Super Admin in the sidebar\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
