// "LNM Bytes Wrapped": a student's semester in food. Pure helpers, no database or network access.
import { istDateKey } from "./copilotHelpers";

const IST_OFFSET_MS = 330 * 60 * 1000;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const MIN_ORDERS = 3;            // fewer orders than this is not enough for a recap
export const MIN_USERS_FOR_RANK = 20;   // "top 10%" means nothing with three students

export interface WrappedPeriod {
    id: "semester" | "all";
    label: string;     // "Jul to Dec 2026"
    from: Date;        // inclusive
    to: Date;          // exclusive
}

/** The semester that contains `now`: January to June, or July to December, in IST. */
export function periodFor(kind: string | undefined, now: Date = new Date()): WrappedPeriod {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    const year = ist.getUTCFullYear();
    if (kind === "all") {
        return { id: "all", label: "All time", from: new Date(0), to: new Date(now.getTime() + 24 * 3600 * 1000) };
    }
    const firstHalf = ist.getUTCMonth() < 6;
    const startMonth = firstHalf ? 0 : 6;
    const from = new Date(Date.UTC(year, startMonth, 1) - IST_OFFSET_MS);
    const to = new Date(Date.UTC(year, startMonth + 6, 1) - IST_OFFSET_MS);
    return { id: "semester", label: `${firstHalf ? "Jan to Jun" : "Jul to Dec"} ${year}`, from, to };
}

export interface WrappedOrderLike {
    storeId: unknown;
    totalAmount: number;
    createdAt: Date | string;
    deliveryType?: string;
    items?: Array<{ name: string; quantity: number }>;
}

export type PersonaId = "early_bird" | "lunch_loyalist" | "snack_hunter" | "dinner_devotee" | "night_owl";

// Order matters: ties go to the first one
const PERSONAS: { id: PersonaId; title: string; line: string; from: number; to: number }[] = [
    { id: "night_owl", title: "The Night Owl", line: "While the campus sleeps, you are still hungry.", from: 0, to: 5 },
    { id: "early_bird", title: "The Early Bird", line: "Breakfast first, everything else later.", from: 5, to: 11 },
    { id: "lunch_loyalist", title: "The Lunch Loyalist", line: "Midday is your meal. Never missed it.", from: 11, to: 16 },
    { id: "snack_hunter", title: "The Snack Hunter", line: "Evenings belong to chai and something fried.", from: 16, to: 19 },
    { id: "dinner_devotee", title: "The Dinner Devotee", line: "You save your appetite for the night.", from: 19, to: 24 },
];

export interface Wrapped {
    ready: boolean;
    period: { id: string; label: string };
    needed: number;                       // orders still needed to unlock (0 when ready)
    orders: number;
    items: number;                        // total pieces ordered
    spent: number;
    avgOrder: number;
    biggestOrder: number;
    activeDays: number;
    longestStreak: number;                // longest run of days in a row with an order
    busiestWeekday: string | null;
    uniqueItems: number;
    nightDeliveries: number;
    topItems: { name: string; qty: number }[];
    topStoreId: string | null;
    topStoreOrders: number;
    persona: { id: PersonaId; title: string; line: string; share: number } | null; // share = % of orders in that slot
    firstOrderDate: string | null;        // YYYY-MM-DD
    topPercent: number | null;            // "top 10% of users"; null when too few users to say
}

function istHour(d: Date): number {
    return new Date(d.getTime() + IST_OFFSET_MS).getUTCHours();
}

function longestRun(sortedKeys: string[]): number {
    let best = 0;
    let run = 0;
    let prev: number | null = null;
    for (const k of sortedKeys) {
        const day = Math.floor(new Date(`${k}T00:00:00Z`).getTime() / 86400000);
        run = prev !== null && day === prev + 1 ? run + 1 : 1;
        best = Math.max(best, run);
        prev = day;
    }
    return best;
}

/** "Top X%" among all users by number of orders; null when there are too few users for it to mean something. */
export function topPercent(myOrders: number, allCounts: number[]): number | null {
    if (allCounts.length < MIN_USERS_FOR_RANK || myOrders <= 0) return null;
    const ahead = allCounts.filter((c) => c > myOrders).length;
    return Math.max(1, Math.round(((ahead + 1) / allCounts.length) * 100));
}

export function buildWrapped(
    orders: WrappedOrderLike[],
    period: Pick<WrappedPeriod, "id" | "label">,
    allCounts: number[] = [],
): Wrapped {
    const base: Wrapped = {
        ready: false,
        period: { id: period.id, label: period.label },
        needed: Math.max(0, MIN_ORDERS - orders.length),
        orders: orders.length,
        items: 0, spent: 0, avgOrder: 0, biggestOrder: 0, activeDays: 0, longestStreak: 0,
        busiestWeekday: null, uniqueItems: 0, nightDeliveries: 0, topItems: [],
        topStoreId: null, topStoreOrders: 0, persona: null, firstOrderDate: null, topPercent: null,
    };
    if (orders.length < MIN_ORDERS) return base;

    let spent = 0;
    let items = 0;
    let biggest = 0;
    let night = 0;
    const days = new Set<string>();
    const weekdayCount = new Array(7).fill(0);
    const slotCount = new Array(PERSONAS.length).fill(0);
    const itemQty = new Map<string, number>();
    const storeCount = new Map<string, number>();
    let first: Date | null = null;

    for (const o of orders) {
        const at = new Date(o.createdAt);
        const total = Number(o.totalAmount) || 0;
        spent += total;
        biggest = Math.max(biggest, total);
        if (o.deliveryType === "night_delivery") night += 1;
        days.add(istDateKey(at));
        weekdayCount[new Date(at.getTime() + IST_OFFSET_MS).getUTCDay()] += 1;
        const slot = PERSONAS.findIndex((p) => istHour(at) >= p.from && istHour(at) < p.to);
        if (slot >= 0) slotCount[slot] += 1;
        if (!first || at < first) first = at;

        const sid = String(o.storeId);
        storeCount.set(sid, (storeCount.get(sid) ?? 0) + 1);
        for (const it of o.items ?? []) {
            const q = Number(it.quantity) || 0;
            items += q;
            itemQty.set(it.name, (itemQty.get(it.name) ?? 0) + q);
        }
    }

    const topItems = Array.from(itemQty.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([name, qty]) => ({ name, qty }));

    const topStore = Array.from(storeCount.entries()).sort((a, b) => b[1] - a[1])[0];
    const topSlot = slotCount.reduce((best, v, i) => (v > slotCount[best] ? i : best), 0);
    const busiest = weekdayCount.reduce((best, v, i) => (v > weekdayCount[best] ? i : best), 0);

    return {
        ...base,
        ready: true,
        needed: 0,
        items,
        spent: Math.round(spent),
        avgOrder: Math.round(spent / orders.length),
        biggestOrder: Math.round(biggest),
        activeDays: days.size,
        longestStreak: longestRun(Array.from(days).sort()),
        busiestWeekday: WEEKDAYS[busiest],
        uniqueItems: itemQty.size,
        nightDeliveries: night,
        topItems,
        topStoreId: topStore ? topStore[0] : null,
        topStoreOrders: topStore ? topStore[1] : 0,
        persona: {
            id: PERSONAS[topSlot].id,
            title: PERSONAS[topSlot].title,
            line: PERSONAS[topSlot].line,
            share: Math.round((slotCount[topSlot] / orders.length) * 100),
        },
        firstOrderDate: first ? istDateKey(first) : null,
        topPercent: topPercent(orders.length, allCounts),
    };
}
