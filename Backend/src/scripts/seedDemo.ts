/**
 * Demo data seed.
 *
 * Fills the database with fake students and about 8 weeks of realistic orders (rush hours,
 * weekday patterns, rejections with reasons, ratings) plus a few live orders, so every feature
 * can be shown: demand hints, ratings, reject reasons, ready alerts, the kitchen queue, Rush Radar.
 *
 * Usage (from the Backend folder, with DB_CONNECTION_STRING in .env):
 *   npx tsx src/scripts/seedDemo.ts                                  # dry run: shows what it would do, writes nothing
 *   npx tsx src/scripts/seedDemo.ts --confirm                        # creates a "Demo Canteen" with its own owner login
 *   npx tsx src/scripts/seedDemo.ts --all-stores --confirm           # seeds orders across ALL active shops using their existing menus
 *   npx tsx src/scripts/seedDemo.ts --store <id1,id2> --confirm      # seeds orders into one or more specific shops using their existing menus
 *   npx tsx src/scripts/seedDemo.ts --all-stores --student you@lnmiit.ac.in --confirm
 *                                                                    # also gives that real student live & past demo orders
 *   npx tsx src/scripts/seedDemo.ts --reset-only --confirm           # removes everything this script made
 *   Add --reset to remove the previous demo data first, then seed again.
 *   Add --weeks <n> (default 9) to control how many weeks of history are generated per shop.
 *
 * Everything it creates is recorded in a "demo_seed_manifest" collection, so removal only
 * touches what the script made. Real students, stores and pre-existing menu/orders are preserved
 * (menu item ratings on pre-existing items are backed up and restored on reset).
 */
import "dotenv/config";
import dns from "dns";
import crypto from "crypto";
import mongoose from "mongoose";
import { Store } from "../Models/Store.model";
import { OwnerModel } from "../Models/Owner.model";
import { UserModel } from "../Models/User.model";
import { MenuItemModel } from "../Models/Menu_Item.model";
import { CounterModel } from "../Models/Counter.model";
import { DEFAULT_MENU, generateDemoOrders, generateStudents, itemRatings, type DemoOrder, type MenuSpec } from "./demoData";

const OWNER_EMAIL = "demo.owner@lnmbytes.demo";
const OWNER_PASSWORD = "Demo@1234";
const MANIFEST = "demo_seed_manifest";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const storeOptions = () => {
    const ids: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--store" && args[i + 1]) {
            ids.push(...args[i + 1].split(",").map((s) => s.trim()).filter(Boolean));
        }
    }
    return [...new Set(ids)];
};

const confirm = flag("--confirm");
const resetOnly = flag("--reset-only");
const reset = flag("--reset") || resetOnly;
const allStores = flag("--all-stores");
const existingStoreIds = storeOptions();
const studentEmail = option("--student")?.toLowerCase();
const weeksArg = Number(option("--weeks") ?? 9);
const weeks = Number.isFinite(weeksArg) && weeksArg >= 1 && weeksArg <= 24 ? Math.floor(weeksArg) : 9;

interface StoreManifestEntry {
    storeId: mongoose.Types.ObjectId;
    createdStore: boolean;
    ownerId: mongoose.Types.ObjectId | null;
    createdMenuItemIds: mongoose.Types.ObjectId[];
    menuBackup: { _id: any; rating: number; ratingCount: number }[];
}

function fail(message: string): never {
    console.error(`\n❌  ${message}`);
    process.exit(1);
}

async function removePrevious(db: mongoose.mongo.Db): Promise<boolean> {
    const manifest: any = await db.collection(MANIFEST).findOne({ _id: "manifest" as any });
    if (!manifest) return false;

    const orders = await db.collection("orders").deleteMany({
        orderNumber: { $gte: manifest.orderNumberFrom, $lte: manifest.orderNumberTo },
    });
    const users = await UserModel.deleteMany({ _id: { $in: manifest.userIds ?? [] } });

    // Support both new multi-store entries and legacy single-store manifest shape
    const entries: StoreManifestEntry[] = Array.isArray(manifest.storeEntries)
        ? manifest.storeEntries
        : [
            {
                storeId: manifest.storeId,
                createdStore: !!manifest.createdStore,
                ownerId: manifest.ownerId ?? null,
                createdMenuItemIds: manifest.createdMenu ? (manifest.menuItemIds ?? []) : [],
                menuBackup: manifest.menuBackup ?? [],
            },
        ];

    let deletedStores = 0;
    let deletedMenuItems = 0;
    for (const entry of entries) {
        if (entry.ownerId) await OwnerModel.deleteOne({ _id: entry.ownerId });
        if (entry.createdMenuItemIds?.length) {
            const delMenu = await MenuItemModel.deleteMany({ _id: { $in: entry.createdMenuItemIds } });
            deletedMenuItems += delMenu.deletedCount ?? 0;
        }
        for (const b of entry.menuBackup ?? []) {
            await MenuItemModel.updateOne({ _id: b._id }, { $set: { rating: b.rating, ratingCount: b.ratingCount } });
        }
        if (entry.createdStore && entry.storeId) {
            const delStore = await Store.deleteOne({ _id: entry.storeId });
            deletedStores += delStore.deletedCount ?? 0;
        }
    }

    await db.collection(MANIFEST).deleteOne({ _id: "manifest" as any });

    console.log(
        `🧹  Removed ${orders.deletedCount} orders, ${users.deletedCount} students` +
        `${deletedMenuItems ? `, ${deletedMenuItems} seeded menu items` : ""}` +
        `${deletedStores ? `, ${deletedStores} demo store(s)` : ""}.`,
    );
    return true;
}

interface PreparedStore {
    storeId: mongoose.Types.ObjectId;
    storeName: string;
    menuDocs: any[];
    menuSpecs: MenuSpec[];
    orders: DemoOrder[];
    entry: StoreManifestEntry;
}

async function prepareExistingStore(store: any, storeIndex: number): Promise<PreparedStore | null> {
    const storeId = store._id as mongoose.Types.ObjectId;
    const existingMenu = await MenuItemModel.find({ storeId }).lean();
    if (existingMenu.length === 0) {
        console.warn(`⚠️   Skipping "${store.name}" — no menu items found.`);
        return null;
    }

    const menuBackup = existingMenu.map((m) => ({
        _id: m._id,
        rating: m.rating ?? 0,
        ratingCount: m.ratingCount ?? 0,
    }));

    const available = existingMenu.filter((m) => m.isAvailable !== false);
    const menuDocs = available.length > 0 ? available : existingMenu;

    const menuSpecs: MenuSpec[] = menuDocs.map((m, i) => {
        // Keep the last item low-volume on 5+ item menus so Insights "Slow movers" shows real contrast
        const isLastSlowMover = menuDocs.length >= 5 && i === menuDocs.length - 1;
        const baseWeight = Math.max(0.6, 2.4 - i * 0.22);
        return {
            name: m.name,
            price: m.price,
            category: (m.category as MenuSpec["category"]) || "snacks",
            isVeg: m.isVeg !== false,
            hasHalf: !!m.hasHalf,
            halfPrice: m.halfPrice ?? null,
            weight: isLastSlowMover ? 0.015 : baseWeight,
        };
    });

    const data = generateDemoOrders({ menu: menuSpecs, weeks, seed: 2026 + storeIndex * 97 });
    console.log(`ℹ️   Prepared "${store.name}" (${menuDocs.length} existing menu items, ${data.orders.length} orders)`);

    return {
        storeId,
        storeName: store.name,
        menuDocs,
        menuSpecs,
        orders: data.orders,
        entry: {
            storeId,
            createdStore: false,
            ownerId: null,
            createdMenuItemIds: [],
            menuBackup,
        },
    };
}

async function createDemoCanteen(): Promise<PreparedStore> {
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
    const storeId = store._id as mongoose.Types.ObjectId;
    const owner = await OwnerModel.create({
        name: "Demo Owner",
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD, // hashed by the model
        storeId,
        phone: "9000000000",
        role: "owner",
        isApproved: true,
    });
    const inserted = await MenuItemModel.insertMany(
        DEFAULT_MENU.map((m) => ({
            name: m.name,
            price: m.price,
            category: m.category,
            isVeg: m.isVeg,
            hasHalf: !!m.hasHalf,
            halfPrice: m.halfPrice ?? null,
            isAvailable: true,
            storeId,
        })),
    );
    const menuDocs = inserted.map((d) => d.toObject());
    const menuSpecs: MenuSpec[] = menuDocs.map((m, i) => ({
        name: m.name,
        price: m.price,
        category: (m.category as MenuSpec["category"]) || "snacks",
        isVeg: m.isVeg !== false,
        hasHalf: !!m.hasHalf,
        halfPrice: m.halfPrice ?? null,
        weight: DEFAULT_MENU[i]?.weight ?? 1,
    }));
    const data = generateDemoOrders({ menu: menuSpecs, weeks, seed: 2026 });

    return {
        storeId,
        storeName: store.name,
        menuDocs,
        menuSpecs,
        orders: data.orders,
        entry: {
            storeId,
            createdStore: true,
            ownerId: owner._id as mongoose.Types.ObjectId,
            createdMenuItemIds: inserted.map((m) => m._id as mongoose.Types.ObjectId),
            menuBackup: [],
        },
    };
}

function buildOrderDocs(
    orders: DemoOrder[],
    startNumber: number,
    storeId: mongoose.Types.ObjectId,
    menuDocs: any[],
    students: any[],
    realUser: any,
    realUserOrders: { order: DemoOrder; qr: boolean }[],
) {
    const toDoc = (
        o: DemoOrder,
        number: number,
        user: { _id: any; name: string; email: string; phone?: string | null },
        qr: boolean,
    ) => {
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
                return {
                    _id: new mongoose.Types.ObjectId(),
                    menuItemId: m._id,
                    name: m.name,
                    quantity: it.quantity,
                    price: unit,
                    portionSize: it.portionSize,
                };
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

    const docs: any[] = [];
    let n = startNumber;
    for (const o of orders) docs.push(toDoc(o, n++, students[o.studentIdx], false));
    for (const r of realUserOrders) docs.push(toDoc(r.order, n++, realUser, r.qr));
    return docs;
}

async function main() {
    if (allStores && existingStoreIds.length > 0) {
        fail("Pass either --all-stores or --store <id>, not both.");
    }

    // Dry run: build a sample plan in memory only
    const samplePlan = generateDemoOrders({ weeks });
    const histogram = samplePlan.orders.reduce<Record<string, number>>((m, o) => ((m[o.status] = (m[o.status] || 0) + 1), m), {});

    const uri = process.env.DB_CONNECTION_STRING;
    const dbName = process.env.DB_NAME || "BTP_PROJECT_LNMIIT";

    if (!confirm) {
        console.log("Dry run. Nothing will be written.\n");
        console.log(`Database:  ${dbName}`);
        console.log(`History:   ${weeks} week(s) -> ~${samplePlan.orders.length} orders/shop (${JSON.stringify(histogram)})`);
        console.log(`Students:  ${samplePlan.students.length} shared demo students`);
        if (allStores) console.log("Target:    ALL active non-admin shops (orders only, using each shop's existing menu)");
        else if (existingStoreIds.length) console.log(`Target:    store(s) ${existingStoreIds.join(", ")}`);
        else console.log(`Target:    new "Demo Canteen" with owner login ${OWNER_EMAIL}`);
        console.log("\nRun again with --confirm to write it (requires DB_CONNECTION_STRING in .env).");
        return;
    }

    if (!uri) fail("DB_CONNECTION_STRING is not set in .env");

    dns.setServers(["8.8.8.8", "8.8.4.4"]);
    dns.setDefaultResultOrder("ipv4first");
    await mongoose.connect(uri, { dbName, family: 4, serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db!;
    console.log(`✅  Connected to "${dbName}" on ${mongoose.connection.host}`);

    const hadPrevious = await db.collection(MANIFEST).findOne({ _id: "manifest" as any });
    if (hadPrevious && !reset) fail("Demo data is already seeded. Run with --reset to replace it, or --reset-only to remove it.");
    if (reset) await removePrevious(db);
    if (resetOnly) return;

    // ─── Target stores ───────────────────────────────────────────────────────
    const preparedStores: PreparedStore[] = [];

    if (allStores) {
        const stores = await Store.find({ isActive: true, name: { $not: /admin/i } }).lean();
        if (stores.length === 0) {
            fail('No active non-admin stores found. Leave out --all-stores to create a fresh "Demo Canteen".');
        }
        for (let i = 0; i < stores.length; i++) {
            const prepared = await prepareExistingStore(stores[i], i);
            if (prepared) preparedStores.push(prepared);
        }
        if (preparedStores.length === 0) {
            fail("None of the active stores have any menu items yet.");
        }
    } else if (existingStoreIds.length > 0) {
        for (const id of existingStoreIds) {
            if (!mongoose.isValidObjectId(id)) fail(`Invalid store id: ${id}`);
        }
        const stores = await Store.find({ _id: { $in: existingStoreIds } }).lean();
        if (stores.length !== existingStoreIds.length) {
            fail("One or more --store ids were not found in the database.");
        }
        for (let i = 0; i < stores.length; i++) {
            const prepared = await prepareExistingStore(stores[i], i);
            if (prepared) preparedStores.push(prepared);
        }
        if (preparedStores.length === 0) {
            fail("None of the selected stores have any menu items yet.");
        }
    } else {
        preparedStores.push(await createDemoCanteen());
    }

    // ─── Shared demo students (across all shops so Wrapped rankings work) ───
    const demoStudents = generateStudents(40);
    const students = await UserModel.insertMany(
        demoStudents.map((s) => ({ name: s.name, email: s.email, phone: s.phone, googleId: s.googleId, role: "student" })),
    );

    // ─── Optional live & past orders for a real student (on first shop) ─────
    let realUser: any = null;
    const realUserOrders: { order: DemoOrder; qr: boolean }[] = [];
    if (studentEmail) {
        realUser = await UserModel.findOne({ email: studentEmail }).lean();
        if (!realUser) {
            console.warn(`⚠️   No student account for ${studentEmail}. Sign in to the student app once, then run this again with --reset. Continuing without it.`);
        } else {
            const firstSpecs = preparedStores[0].menuSpecs;
            const now = Date.now();
            const pick = (i: number) => ({ menuIdx: i % firstSpecs.length, quantity: 1, portionSize: "full" as const });
            const mk = (over: Partial<DemoOrder> & { status: DemoOrder["status"]; minutesAgo: number }, idxs: number[]): DemoOrder => {
                const items = idxs.map(pick);
                return {
                    studentIdx: -1,
                    items,
                    totalAmount: items.reduce((s, it) => s + firstSpecs[it.menuIdx].price, 0),
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
                { order: mk({ status: "delivered", minutesAgo: 45, verifiedAt: new Date(now - 30 * 60_000) }, [2, 6]), qr: false },
                { order: mk({ status: "cancelled", minutesAgo: 70, rejectionReason: "out_of_stock", rejectionNote: "item finished" }, [1]), qr: false },
            );
        }
    }

    // ─── Reserve one contiguous block of order numbers for all stores ────────
    const totalOrders =
        preparedStores.reduce((sum, s) => sum + s.orders.length, 0) + realUserOrders.length;
    const counter = await CounterModel.findOneAndUpdate(
        { _id: "orderNumber" },
        { $inc: { seq: totalOrders } },
        { upsert: true, new: true },
    );
    const lastNumber = (counter?.seq ?? totalOrders) + 1000;
    const firstNumber = lastNumber - totalOrders + 1;

    // ─── Insert orders & update ratings per store ────────────────────────────
    let cursor = firstNumber;
    let liveTotal = 0;

    for (let i = 0; i < preparedStores.length; i++) {
        const ps = preparedStores[i];
        const extraReal = i === 0 ? realUserOrders : [];
        const docs = buildOrderDocs(ps.orders, cursor, ps.storeId, ps.menuDocs, students, realUser, extraReal);
        cursor += docs.length;
        liveTotal += docs.filter((d) => ["pending", "preparing", "ready"].includes(d.status)).length;

        for (let k = 0; k < docs.length; k += 1000) {
            await db.collection("orders").insertMany(docs.slice(k, k + 1000), { ordered: false });
        }

        const stars = itemRatings(ps.menuDocs.length, ps.orders);
        for (let m = 0; m < ps.menuDocs.length; m++) {
            if (stars[m].ratingCount === 0) continue;
            await MenuItemModel.updateOne(
                { _id: ps.menuDocs[m]._id },
                { $set: { rating: stars[m].rating, ratingCount: stars[m].ratingCount } },
            );
        }
    }

    await db.collection(MANIFEST).insertOne({
        _id: "manifest" as any,
        createdAt: new Date(),
        storeId: preparedStores[0].storeId, // kept for backward compatibility
        storeEntries: preparedStores.map((s) => s.entry),
        userIds: students.map((s) => s._id),
        orderNumberFrom: firstNumber,
        orderNumberTo: lastNumber,
    });

    const shopNames = preparedStores.map((s) => `"${s.storeName}"`).join(", ");
    console.log(`\n🌱  Seeded ${students.length} students and ${totalOrders} orders (${liveTotal} live) across ${preparedStores.length} shop(s): ${shopNames}.`);
    if (preparedStores.some((s) => s.entry.createdStore)) {
        console.log(`\n    Owner login:  ${OWNER_EMAIL}  /  ${OWNER_PASSWORD}`);
        console.log(`    Store id:     ${preparedStores[0].storeId}`);
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
