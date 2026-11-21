/**
 * Demo data seed.
 *
 * Fills the database with fake students and about 8 weeks of realistic orders (rush hours,
 * weekday patterns, rejections with reasons, ratings) plus a few live orders, so every feature
 * can be shown: demand hints, ratings, reject reasons, ready alerts, the kitchen queue.
 *
 * Usage (from the Backend folder, with DB_CONNECTION_STRING in .env):
 *   npx tsx src/scripts/seedDemo.ts                      # dry run: shows what it would do, writes nothing
 *   npx tsx src/scripts/seedDemo.ts --confirm            # creates a "Demo Canteen" with its own owner login
 *   npx tsx src/scripts/seedDemo.ts --confirm --student you@lnmiit.ac.in
 *                                                        # also gives that real student demo orders (a ready QR, a pickup to rate...)
 *   npx tsx src/scripts/seedDemo.ts --confirm --store <storeId>
 *                                                        # puts the history into an existing store instead (it needs 3+ menu items)
 *   npx tsx src/scripts/seedDemo.ts --reset-only --confirm   # removes everything this script made
 *   Add --reset to remove the previous demo data first, then seed again.
 *
 * Everything it creates is recorded in a "demo_seed_manifest" collection, so removal only
 * touches what the script made. Real students, stores and orders are never changed, except the
 * star ratings of menu items when --store is used (the old values are saved and put back on reset).
 */
import "dotenv/config";
import dns from "dns";
import crypto from "crypto";
import mongoose from "mongoose";
import { Store } from "../Models/Store.model";
import { OwnerModel } from "../Models/Owner.model";
import { UserModel } from "../Models/User.model";
import { MenuItemModel } from "../Models/Menu_Item.model";
import { OrderModel } from "../Models/Order_Schema.model";
import { CounterModel } from "../Models/Counter.model";
import { DEFAULT_MENU, generateDemoOrders, itemRatings, type DemoOrder, type MenuSpec } from "./demoData";

const OWNER_EMAIL = "demo.owner@lnmbytes.demo";
const OWNER_PASSWORD = "Demo@1234";
const MANIFEST = "demo_seed_manifest";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};

const confirm = flag("--confirm");
const resetOnly = flag("--reset-only");
const reset = flag("--reset") || resetOnly;
const existingStoreId = option("--store");
const studentEmail = option("--student")?.toLowerCase();

function fail(message: string): never {
    console.error(`\n❌  ${message}`);
    process.exit(1);
}

async function removePrevious(db: mongoose.mongo.Db): Promise<boolean> {
    const manifest: any = await db.collection(MANIFEST).findOne({ _id: "manifest" as any });
    if (!manifest) return false;

    const orders = await db.collection("orders").deleteMany({ orderNumber: { $gte: manifest.orderNumberFrom, $lte: manifest.orderNumberTo } });
    const users = await UserModel.deleteMany({ _id: { $in: manifest.userIds } });
    if (manifest.ownerId) await OwnerModel.deleteOne({ _id: manifest.ownerId });
    if (manifest.createdMenu) await MenuItemModel.deleteMany({ _id: { $in: manifest.menuItemIds } });
    for (const b of manifest.menuBackup ?? []) {
        await MenuItemModel.updateOne({ _id: b._id }, { $set: { rating: b.rating, ratingCount: b.ratingCount } });
    }
    if (manifest.createdStore) await Store.deleteOne({ _id: manifest.storeId });
    await db.collection(MANIFEST).deleteOne({ _id: "manifest" as any });

    console.log(`🧹  Removed ${orders.deletedCount} orders, ${users.deletedCount} students${manifest.createdStore ? ", the demo store and its owner" : ""}.`);
    return true;
}

async function main() {
    // Dry run: build the data in memory only
    const plan = generateDemoOrders();
    const histogram = plan.orders.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {});

    const uri = process.env.DB_CONNECTION_STRING;
    const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";
    if (!uri) fail("DB_CONNECTION_STRING is not set in .env");

    if (!confirm) {
        console.log("Dry run. Nothing will be written.\n");
        console.log(`Database:  ${dbName}`);
        console.log(`Would create: ${plan.students.length} students, ${plan.orders.length} orders (${JSON.stringify(histogram)})`);
        console.log(existingStoreId ? `Target:    existing store ${existingStoreId}` : `Target:    new "Demo Canteen" with owner login ${OWNER_EMAIL}`);
        console.log("\nRun again with --confirm to write it.");
        return;
    }

    dns.setServers(["8.8.8.8", "8.8.4.4"]);
    dns.setDefaultResultOrder("ipv4first");
    await mongoose.connect(uri, { dbName, family: 4, serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db!;
    console.log(`✅  Connected to "${dbName}" on ${mongoose.connection.host}`);

    const hadPrevious = await db.collection(MANIFEST).findOne({ _id: "manifest" as any });
    if (hadPrevious && !reset) fail("Demo data is already seeded. Run with --reset to replace it, or --reset-only to remove it.");
    if (reset) await removePrevious(db);
    if (resetOnly) return;

    // ─── Store and menu ──────────────────────────────────────────────────────
    let storeId: mongoose.Types.ObjectId;
    let createdStore = false;
    let ownerId: mongoose.Types.ObjectId | null = null;
    let menuDocs: any[];
    let createdMenu = false;
    const menuBackup: { _id: any; rating: number; ratingCount: number }[] = [];

    if (existingStoreId) {
        if (!mongoose.isValidObjectId(existingStoreId)) fail("--store must be a store id");
        const store = await Store.findById(existingStoreId).lean();
        if (!store) fail("No store with that id");
        storeId = store!._id as mongoose.Types.ObjectId;
        menuDocs = await MenuItemModel.find({ storeId }).lean();
        if (menuDocs.length < 3) fail("That store needs at least 3 menu items before demo orders make sense. Add some first, or leave out --store.");
        menuDocs.forEach((m) => menuBackup.push({ _id: m._id, rating: m.rating ?? 0, ratingCount: m.ratingCount ?? 0 }));
        console.log(`ℹ️   Using existing store "${store!.name}" with ${menuDocs.length} menu items`);
    } else {
        const store = await Store.create({
            name: "Demo Canteen",
            description: "Sample canteen with demo data.",
            phone: "9000000000",
            ownerName: "Demo Owner",
            status: "open",
            location: "Demo Block",
            operationTime: { openTime: "00:00", closeTime: "23:59" }, // always open, so a demo works at any hour
            nightDelivery: true,
            nightDeliveryCharge: 10,
            foodType: "veg",
            isOnlineOrderAvailable: true,
            isActive: true,
            upiId: "demo@upi",
        });
        storeId = store._id as mongoose.Types.ObjectId;
        createdStore = true;
        const owner = await OwnerModel.create({
            name: "Demo Owner",
            email: OWNER_EMAIL,
            password: OWNER_PASSWORD, // hashed by the model
            storeId,
            phone: "9000000000",
            role: "owner",
            isApproved: true,
        });
        ownerId = owner._id as mongoose.Types.ObjectId;
        menuDocs = await MenuItemModel.insertMany(
            DEFAULT_MENU.map((m) => ({ name: m.name, price: m.price, category: m.category, isVeg: m.isVeg, hasHalf: !!m.hasHalf, halfPrice: m.halfPrice ?? null, isAvailable: true, storeId })),
        );
        createdMenu = true;
    }

    // Order data uses the real menu (names, prices, categories) of the target store
    const menuSpecs: MenuSpec[] = menuDocs.map((m, i) => ({
        name: m.name,
        price: m.price,
        category: (m.category as MenuSpec["category"]) || "snacks",
        isVeg: m.isVeg !== false,
        hasHalf: !!m.hasHalf,
        halfPrice: m.halfPrice ?? null,
        weight: createdMenu ? (DEFAULT_MENU[i]?.weight ?? 1) : Math.max(0.6, 2.2 - i * 0.25), // earlier items sell more
    }));
    const data = generateDemoOrders({ menu: menuSpecs });
    const orders: DemoOrder[] = [...data.orders];

    // ─── Optional live orders for a real student ─────────────────────────────
    let realUser: any = null;
    const realUserOrders: { order: DemoOrder; qr: boolean }[] = [];
    if (studentEmail) {
        realUser = await UserModel.findOne({ email: studentEmail }).lean();
        if (!realUser) console.warn(`⚠️   No student account for ${studentEmail}. Sign in to the student app once, then run this again with --reset. Continuing without it.`);
        else {
            const now = Date.now();
            const pick = (i: number) => ({ menuIdx: i % menuSpecs.length, quantity: 1, portionSize: "full" as const });
            const mk = (over: Partial<DemoOrder> & { status: DemoOrder["status"]; minutesAgo: number }, idxs: number[]): DemoOrder => {
                const items = idxs.map(pick);
                return {
                    studentIdx: -1,
                    items,
                    totalAmount: items.reduce((s, it) => s + menuSpecs[it.menuIdx].price, 0),
                    createdAt: new Date(now - over.minutesAgo * 60_000),
                    paymentType: "cash",
                    paymentStatus: "pending",
                    deliveryType: "pickup",
                    live: true,
                    ...over,
                };
            };
            realUserOrders.push(
                { order: mk({ status: "ready", minutesAgo: 6 }, [0, 5]), qr: true },
                { order: mk({ status: "preparing", minutesAgo: 9 }, [1]), qr: false },
                { order: mk({ status: "delivered", minutesAgo: 45, verifiedAt: new Date(now - 30 * 60_000) }, [2, 6]), qr: false }, // not rated: shows the stars
                { order: mk({ status: "cancelled", minutesAgo: 70, rejectionReason: "out_of_stock", rejectionNote: "no samosa left" }, [1]), qr: false },
            );
        }
    }

    // ─── Students ────────────────────────────────────────────────────────────
    const students = await UserModel.insertMany(data.students.map((s) => ({ name: s.name, email: s.email, phone: s.phone, googleId: s.googleId, role: "student" })));

    // ─── Order numbers: one block, so they cannot clash with real orders ─────
    const total = orders.length + realUserOrders.length;
    const counter = await CounterModel.findOneAndUpdate({ _id: "orderNumber" }, { $inc: { seq: total } }, { upsert: true, new: true });
    const lastNumber = (counter?.seq ?? total) + 1000;
    const firstNumber = lastNumber - total + 1;

    const toDoc = (o: DemoOrder, number: number, user: { _id: any; name: string; email: string; phone?: string | null }, qr: boolean) => {
        const created = o.createdAt;
        const ready = o.status === "ready";
        return {
            orderNumber: number,
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            userPhone: user.phone ?? null,
            storeId,
            items: o.items.map((it) => {
                const m = menuDocs[it.menuIdx];
                const unit = it.portionSize === "half" && m.halfPrice ? m.halfPrice : m.price;
                return { _id: new mongoose.Types.ObjectId(), menuItemId: m._id, name: m.name, quantity: it.quantity, price: unit, portionSize: it.portionSize };
            }),
            totalAmount: o.totalAmount,
            status: o.status,
            paymentType: o.paymentType,
            paymentStatus: o.paymentStatus,
            cashfreeOrderId: null,
            orderNote: "",
            deliveryType: o.deliveryType,
            qrToken: ready || qr ? crypto.randomBytes(16).toString("hex") : null,
            qrExpiresAt: ready ? new Date(Date.now() + 45 * 60_000) : null,
            qrVerified: o.status === "delivered",
            qrVerifiedAt: o.verifiedAt ?? null,
            rejectionReason: o.rejectionReason ?? null,
            rejectionNote: o.rejectionNote ?? "",
            rating: o.rating ?? null,
            ratedAt: o.ratedAt ?? null,
            createdAt: created,
            updatedAt: o.verifiedAt ?? created,
            __v: 0,
        };
    };

    // Delivered orders have no QR token left after pickup in real use, so only live ready ones keep one
    const docs: any[] = [];
    let n = firstNumber;
    for (const o of orders) docs.push(toDoc(o, n++, students[o.studentIdx] as any, false));
    for (const r of realUserOrders) docs.push(toDoc(r.order, n++, realUser, r.qr));

    for (let i = 0; i < docs.length; i += 1000) {
        await db.collection("orders").insertMany(docs.slice(i, i + 1000), { ordered: false });
    }

    // ─── Star ratings on the menu, from the seeded ratings ───────────────────
    const stars = itemRatings(menuDocs.length, orders);
    for (let i = 0; i < menuDocs.length; i++) {
        if (stars[i].ratingCount === 0) continue;
        await MenuItemModel.updateOne({ _id: menuDocs[i]._id }, { $set: { rating: stars[i].rating, ratingCount: stars[i].ratingCount } });
    }

    await db.collection(MANIFEST).insertOne({
        _id: "manifest" as any,
        createdAt: new Date(),
        storeId,
        createdStore,
        ownerId,
        createdMenu,
        menuItemIds: createdMenu ? menuDocs.map((m) => m._id) : [],
        menuBackup,
        userIds: students.map((s) => s._id),
        orderNumberFrom: firstNumber,
        orderNumberTo: lastNumber,
    });

    const live = docs.filter((d) => ["pending", "preparing", "ready"].includes(d.status)).length;
    console.log(`\n🌱  Seeded ${students.length} students and ${docs.length} orders (${live} live) for ${createdStore ? '"Demo Canteen"' : "your store"}.`);
    if (createdStore) {
        console.log(`\n    Owner login:  ${OWNER_EMAIL}  /  ${OWNER_PASSWORD}`);
        console.log(`    Store id:     ${storeId}`);
    }
    console.log("\n    Tips: demand hints and menu ratings can take up to 10 minutes to show on a running server (cached). Restart the backend to see them at once.");
    console.log("    Remove it all later with:  npx tsx src/scripts/seedDemo.ts --reset-only --confirm");
}

main()
    .catch((err) => {
        console.error("\n❌  Seed failed:", err?.message || err);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
