// Fake but realistic canteen history for demos. Pure functions: no database, no network.
// The same seed always gives the same data, so a demo can be repeated.
import { startOfIstDay, istDateKey } from "../utils/copilotHelpers";

export type Category = "snacks" | "drinks" | "meals" | "dessert" | "other";
export type SlotName = "late_night" | "breakfast" | "lunch" | "snacks" | "dinner";

export interface MenuSpec {
    name: string;
    price: number;
    category: Category;
    isVeg: boolean;
    hasHalf?: boolean;
    halfPrice?: number | null;
    /** How popular the item is overall. 1 is average. */
    weight: number;
}

export const DEFAULT_MENU: MenuSpec[] = [
    { name: "Veg Roll", price: 40, category: "snacks", isVeg: true, weight: 3 },
    { name: "Samosa", price: 15, category: "snacks", isVeg: true, weight: 2.5 },
    { name: "Maggi", price: 40, category: "snacks", isVeg: true, weight: 2.2 },
    { name: "French Fries", price: 50, category: "snacks", isVeg: true, weight: 1.4 },
    { name: "Paneer Sandwich", price: 60, category: "snacks", isVeg: true, weight: 1.2 },
    { name: "Masala Chai", price: 10, category: "drinks", isVeg: true, weight: 3 },
    { name: "Cold Coffee", price: 50, category: "drinks", isVeg: true, weight: 1.8 },
    { name: "Veg Thali", price: 90, category: "meals", isVeg: true, hasHalf: true, halfPrice: 55, weight: 2.4 },
    { name: "Chole Bhature", price: 70, category: "meals", isVeg: true, hasHalf: true, halfPrice: 45, weight: 1.8 },
    { name: "Brownie", price: 45, category: "dessert", isVeg: true, weight: 1 },
];

// ─── Random numbers ──────────────────────────────────────────────────────────
export function makeRng(seed: number) {
    let a = seed >>> 0;
    const next = () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)];
    const weighted = <T,>(list: T[], weight: (item: T) => number): T => {
        const total = list.reduce((s, x) => s + weight(x), 0);
        let r = next() * total;
        for (const item of list) {
            r -= weight(item);
            if (r <= 0) return item;
        }
        return list[list.length - 1];
    };
    const gauss = () => {
        const u = Math.max(next(), 1e-9);
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    };
    return { next, pick, weighted, gauss };
}

// ─── Daily shape ─────────────────────────────────────────────────────────────
// Typical orders per slot on a normal weekday
const SLOT_BASE: Record<SlotName, number> = { breakfast: 12, lunch: 48, snacks: 30, dinner: 34, late_night: 6 };
// Sunday to Saturday
const WEEKDAY_FACTOR = [0.45, 1, 1.05, 1, 1.05, 0.9, 0.6];
// Hour of day -> how busy within the slot
const SLOT_HOURS: Record<SlotName, [number, number][]> = {
    breakfast: [[7, 0.5], [8, 2], [9, 2], [10, 1]],
    lunch: [[11, 0.6], [12, 3], [13, 4], [14, 2], [15, 0.7]],
    snacks: [[16, 2], [17, 3], [18, 2]],
    dinner: [[19, 2], [20, 3], [21, 3], [22, 1.5], [23, 0.5]],
    late_night: [[0, 2], [1, 1.5], [2, 1], [3, 0.3]],
};
// What each kind of food sells in each slot
const AFFINITY: Record<SlotName, Record<Category, number>> = {
    breakfast: { snacks: 1, drinks: 2, meals: 0.3, dessert: 0.2, other: 0.5 },
    lunch: { snacks: 1.5, drinks: 1, meals: 3, dessert: 0.5, other: 0.5 },
    snacks: { snacks: 3, drinks: 2.5, meals: 0.3, dessert: 1, other: 0.5 },
    dinner: { snacks: 2, drinks: 0.8, meals: 2.5, dessert: 0.8, other: 0.5 },
    late_night: { snacks: 3, drinks: 2, meals: 0.2, dessert: 0.5, other: 0.5 },
};
const NIGHT_DELIVERY_CHARGE = 10;

const FIRST = ["Aarav", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Karan", "Meera", "Nikhil", "Priya", "Rahul", "Riya", "Rohan", "Saanvi", "Siddharth", "Sneha", "Tanvi", "Vihaan", "Yash", "Zoya", "Harsh", "Pooja", "Aditya", "Neha"];
const LAST = ["Sharma", "Verma", "Gupta", "Singh", "Jain", "Agarwal", "Mehta", "Reddy", "Nair", "Khan", "Joshi", "Bansal", "Saxena", "Mishra", "Rathore", "Chauhan"];

const REJECT_REASONS: { code: string; weight: number; notes: string[] }[] = [
    { code: "out_of_stock", weight: 4, notes: ["", "no samosa left", "roll bread finished"] },
    { code: "too_busy", weight: 3, notes: ["", "try again in 15 minutes"] },
    { code: "closing_soon", weight: 1, notes: [""] },
    { code: "order_issue", weight: 1, notes: [""] },
    { code: "other", weight: 0.5, notes: [""] },
];

const STAR_WEIGHTS: [number, number][] = [[5, 0.45], [4, 0.33], [3, 0.14], [2, 0.05], [1, 0.03]];

// ─── Output types ────────────────────────────────────────────────────────────
export interface DemoStudent { name: string; email: string; phone: string; googleId: string }

export interface DemoOrderItem { menuIdx: number; quantity: number; portionSize: "full" | "half" }

export interface DemoOrder {
    studentIdx: number;
    items: DemoOrderItem[];
    totalAmount: number;
    createdAt: Date;
    status: "pending" | "preparing" | "ready" | "delivered" | "cancelled";
    paymentType: "cash" | "online";
    paymentStatus: "pending" | "paid" | "refunded";
    deliveryType: "pickup" | "night_delivery";
    rejectionReason?: string;
    rejectionNote?: string;
    /** When the student picked it up, for delivered orders */
    verifiedAt?: Date;
    rating?: number;
    ratedAt?: Date;
    /** Not an order from the history: a live one for the dashboard */
    live?: boolean;
}

export interface DemoOptions {
    now?: Date;
    seed?: number;
    weeks?: number;
    studentCount?: number;
    menu?: MenuSpec[];
}

export function slotOfHour(hour: number): SlotName {
    if (hour < 5) return "late_night";
    if (hour < 11) return "breakfast";
    if (hour < 16) return "lunch";
    if (hour < 19) return "snacks";
    return "dinner";
}

function istMoment(dateKey: string, hour: number, minute: number): Date {
    // dateKey is YYYY-MM-DD in IST
    return new Date(new Date(`${dateKey}T00:00:00+05:30`).getTime() + (hour * 60 + minute) * 60_000);
}

export function generateStudents(count: number, rng = makeRng(7)): DemoStudent[] {
    const out: DemoStudent[] = [];
    const used = new Set<string>();
    while (out.length < count) {
        const first = rng.pick(FIRST);
        const last = rng.pick(LAST);
        const handle = `demo.${first}.${last}`.toLowerCase();
        if (used.has(handle)) continue;
        used.add(handle);
        out.push({
            name: `${first} ${last}`,
            email: `${handle}@lnmiit.ac.in`,
            phone: `9${Math.floor(100000000 + rng.next() * 899999999)}`,
            googleId: `demo-${handle}`,
        });
    }
    return out;
}

export function generateDemoOrders(opts: DemoOptions = {}) {
    const now = opts.now ?? new Date();
    const rng = makeRng(opts.seed ?? 2026);
    const weeks = opts.weeks ?? 8;
    const menu = opts.menu ?? DEFAULT_MENU;
    const students = generateStudents(opts.studentCount ?? 40, makeRng((opts.seed ?? 2026) + 1));
    const days = weeks * 7;

    // One quiet day in the history, like a day the canteen was closed
    const closedOffset = 3 + Math.floor(rng.next() * (days - 3));

    const pickItems = (slot: SlotName, hasBigMeal: boolean): DemoOrderItem[] => {
        const count = rng.weighted([1, 2, 3], (n) => (n === 1 ? 6 : n === 2 ? 3 : 1));
        const chosen: DemoOrderItem[] = [];
        for (let i = 0; i < count; i++) {
            const idx = menu.indexOf(
                rng.weighted(menu, (m) => m.weight * AFFINITY[slot][m.category] * (hasBigMeal && m.category === "meals" ? 0.2 : 1)),
            );
            const m = menu[idx];
            const existing = chosen.find((c) => c.menuIdx === idx && c.portionSize === "full");
            const quantity = m.category === "drinks" || m.price <= 20 ? rng.weighted([1, 2, 3], (n) => (n === 1 ? 5 : n === 2 ? 3 : 1)) : rng.weighted([1, 2], (n) => (n === 1 ? 6 : 1));
            if (existing) existing.quantity += quantity;
            else chosen.push({ menuIdx: idx, quantity, portionSize: m.hasHalf && m.halfPrice && rng.next() < 0.25 ? "half" : "full" });
        }
        return chosen;
    };

    const priceOf = (items: DemoOrderItem[]) =>
        items.reduce((sum, it) => {
            const m = menu[it.menuIdx];
            const unit = it.portionSize === "half" && m.halfPrice ? m.halfPrice : m.price;
            return sum + unit * it.quantity;
        }, 0);

    const orders: DemoOrder[] = [];

    for (let ago = days; ago >= 0; ago--) {
        const dayStart = startOfIstDay(now, ago);
        const dateKey = istDateKey(dayStart);
        const weekday = new Date(dayStart.getTime() + 330 * 60_000).getUTCDay();
        if (ago === closedOffset && ago !== 0) continue;
        const dayNoise = 0.85 + rng.next() * 0.3;

        for (const slot of Object.keys(SLOT_BASE) as SlotName[]) {
            const mean = SLOT_BASE[slot] * WEEKDAY_FACTOR[weekday] * dayNoise;
            const count = Math.max(0, Math.round(mean + Math.sqrt(mean) * rng.gauss() * 0.6));
            for (let n = 0; n < count; n++) {
                const [hour] = rng.weighted(SLOT_HOURS[slot], (h) => h[1]);
                const createdAt = istMoment(dateKey, hour, Math.floor(rng.next() * 60));
                // Today only has orders that already happened, leaving the last 25 minutes for live ones
                if (createdAt.getTime() > now.getTime() - 25 * 60_000) continue;

                const paymentType: "cash" | "online" = rng.next() < 0.38 ? "online" : "cash";
                const nightDelivery = slot === "late_night";
                const items = pickItems(slot, false);
                const total = priceOf(items) + (nightDelivery ? NIGHT_DELIVERY_CHARGE : 0);

                const order: DemoOrder = {
                    studentIdx: Math.floor(Math.pow(rng.next(), 1.6) * students.length), // a few regulars order a lot
                    items,
                    totalAmount: total,
                    createdAt,
                    status: "delivered",
                    paymentType,
                    paymentStatus: paymentType === "online" ? "paid" : "pending",
                    deliveryType: nightDelivery ? "night_delivery" : "pickup",
                };

                if (rng.next() < 0.05) {
                    const reason = rng.weighted(REJECT_REASONS, (r) => r.weight);
                    order.status = "cancelled";
                    order.rejectionReason = reason.code;
                    order.rejectionNote = rng.pick(reason.notes);
                    if (paymentType === "online") order.paymentStatus = "refunded";
                } else {
                    order.verifiedAt = new Date(createdAt.getTime() + (8 + Math.floor(rng.next() * 14)) * 60_000);
                    // Old orders only: a student rates some of what they pick up
                    if (rng.next() < 0.55) {
                        order.rating = rng.weighted(STAR_WEIGHTS, (s) => s[1])[0];
                        order.ratedAt = new Date(order.verifiedAt.getTime() + (2 + Math.floor(rng.next() * 60)) * 60_000);
                    }
                }
                orders.push(order);
            }
        }
    }

    // A handful of live orders so the kitchen dashboard has something to act on
    const liveStates: { status: DemoOrder["status"]; minutesAgo: number }[] = [
        { status: "pending", minutesAgo: 2 },
        { status: "pending", minutesAgo: 5 },
        { status: "pending", minutesAgo: 9 },
        { status: "preparing", minutesAgo: 12 },
        { status: "preparing", minutesAgo: 14 },
        { status: "ready", minutesAgo: 18 },
    ];
    for (const s of liveStates) {
        const items = pickItems(slotOfHour(new Date(now.getTime() + 330 * 60_000).getUTCHours()), false);
        const paymentType: "cash" | "online" = rng.next() < 0.4 ? "online" : "cash";
        orders.push({
            studentIdx: Math.floor(rng.next() * students.length),
            items,
            totalAmount: priceOf(items),
            createdAt: new Date(now.getTime() - s.minutesAgo * 60_000),
            status: s.status,
            paymentType,
            paymentStatus: paymentType === "online" ? "paid" : "pending",
            deliveryType: "pickup",
            live: true,
        });
    }

    orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return { students, menu, orders };
}

/** Average stars and count for each menu item, worked out the same way the app does it (one rating per order, counted for every item in it). */
export function itemRatings(menuSize: number, orders: DemoOrder[]): { rating: number; ratingCount: number }[] {
    const sums = Array.from({ length: menuSize }, () => ({ total: 0, count: 0 }));
    for (const o of orders) {
        if (!o.rating) continue;
        for (const idx of new Set(o.items.map((i) => i.menuIdx))) {
            sums[idx].total += o.rating;
            sums[idx].count += 1;
        }
    }
    return sums.map((s) => ({
        rating: s.count ? Math.round((s.total / s.count) * 100) / 100 : 0,
        ratingCount: s.count,
    }));
}
