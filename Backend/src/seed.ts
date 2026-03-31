/**
 * Seed script: creates a default store in the database.
 * Run with:  npx ts-node src/seed.ts
 * Or:        node -r ts-node/register src/seed.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Store } from "./Models/Store.model";
import { MenuItemModel } from "./Models/Menu_Item.model";

async function seed() {
  const uri = process.env.DB_CONNECTION_STRING!;
  const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

  console.log("Connecting to MongoDB…");
  await mongoose.connect(uri, { dbName });
  console.log("Connected ✅");

  // ── Create store if none exists ─────────────────────────────────────────────
  const existing = await Store.findOne({});
  if (existing) {
    console.log(`\n⚠️  Store already exists: ${existing.name} (${existing._id})`);
    console.log("Set VITE_STORE_ID in Owner_page/.env to this value:");
    console.log(`  VITE_STORE_ID=${existing._id}\n`);
  } else {
    const store = await Store.create({
      name: "LNM Bytes Canteen",
      description: "Main canteen of LNMIIT serving hot, fresh food all day.",
      phone: "+91 98765 43210",
      ownerName: "Admin",
      status: "open",
      location: "Main Building, LNMIIT",
      operationTime: { openTime: "08:00", closeTime: "22:00" },
      nightDelivery: false,
      foodType: "both",
      isOnlineOrderAvailable: true,
      isActive: true,
    });
    console.log(`\n✅ Store created: ${store.name} (${store._id})`);
    console.log("Set VITE_STORE_ID in Owner_page/.env to this value:");
    console.log(`  VITE_STORE_ID=${store._id}\n`);

    // ── Seed a few menu items ───────────────────────────────────────────────
    const items = [
      { name: "Veg Burger",       price: 60,  category: "snacks",  isVeg: true,  storeId: store._id },
      { name: "Chicken Burger",   price: 80,  category: "snacks",  isVeg: false, storeId: store._id },
      { name: "Samosa (2 pcs)",   price: 20,  category: "snacks",  isVeg: true,  storeId: store._id },
      { name: "Cold Coffee",      price: 50,  category: "drinks",  isVeg: true,  storeId: store._id },
      { name: "Masala Chai",      price: 15,  category: "drinks",  isVeg: true,  storeId: store._id },
      { name: "Veg Fried Rice",   price: 80,  category: "meals",   isVeg: true,  storeId: store._id },
      { name: "Chicken Biryani",  price: 120, category: "meals",   isVeg: false, storeId: store._id },
      { name: "Gulab Jamun",      price: 30,  category: "dessert", isVeg: true,  storeId: store._id },
    ];
    await MenuItemModel.insertMany(items);
    console.log(`✅ ${items.length} menu items seeded.\n`);
  }

  await mongoose.disconnect();
  console.log("Done 🎉");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
