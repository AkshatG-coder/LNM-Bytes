// Pure helpers for the owner Copilot. No database or network access here,
// so everything in this file can be unit-tested directly.
import { resolveByName } from "./bitebotHelpers";
import type { MenuDocLike } from "./bitebotHelpers";

// ─── UI blocks sent to the owner dashboard next to the text reply ────────────
export interface OwnerUiOrder {
    id: string;
    orderNumber: number;
    status: string;
    userName: string;
    items: string;
    totalAmount: number;
    paymentType: string;
    paymentStatus?: string;
    deliveryType?: string;
    placedAt?: string;
}

export interface OwnerUiMenuItem {
    id: string;
    name: string;
    price: number;
    halfPrice: number | null;
    category: string;
    isVeg: boolean;
    isAvailable: boolean;
}

export interface OwnerUiStore {
    id: string;
    name: string;
    status: string;
    location: string;
    openTime: string;
    closeTime: string;
    nightDelivery: boolean;
    isOnlineOrderAvailable: boolean;
}

export interface DayRow {
    date: string;   // YYYY-MM-DD (IST)
    label: string;  // e.g. "Fri"
    revenue: number;
    orders: number;
}

export interface SalesSummary {
    days: number;
    periodLabel: string;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    activeOrders: number;
    cashOrders: number;
    onlineOrders: number;
    perDay: DayRow[];
    topItems: { name: string; qty: number }[];
}

export type OwnerUiBlock =
    | { type: "orders"; title: string; orders: OwnerUiOrder[]; hiddenCount: number }
    | { type: "sales"; sales: SalesSummary }
    | { type: "menu"; title: string; items: OwnerUiMenuItem[]; hiddenCount: number }
    | { type: "store"; store: OwnerUiStore };

// ─── India time (the server may run in UTC) ──────────────────────────────────
const IST_OFFSET_MS = 330 * 60 * 1000; // UTC+05:30, no daylight saving

/** 00:00 IST of the day `daysAgo` days before `now`, as a real Date. */
export function startOfIstDay(now: Date = new Date(), daysAgo = 0): Date {
    const shifted = new Date(now.getTime() + IST_OFFSET_MS);
    const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysAgo);
    return new Date(midnight - IST_OFFSET_MS);
}

/** YYYY-MM-DD of a moment in IST. */
export function istDateKey(date: Date): string {
    return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function weekdayLabel(dateKey: string): string {
    return new Date(`${dateKey}T12:00:00+05:30`).toLocaleDateString("en-IN", {
        weekday: "short",
        timeZone: "Asia/Kolkata",
    });
}

/** Orders in these states never count as sales. */
export const NOT_SALES_STATUSES = ["cancelled", "payment_pending"];

export interface SalesOrderLike {
    status: string;
    totalAmount: number;
    paymentType: string;
    createdAt: Date | string;
    items?: Array<{ name: string; quantity: number }>;
}

/** Turns a list of orders into the numbers shown on the sales card. */
export function summarizeSales(
    orders: SalesOrderLike[],
    days: number,
    activeOrders: number,
    now: Date = new Date(),
): SalesSummary {
    const span = Math.min(30, Math.max(1, Math.floor(days) || 1));
    const rangeStart = startOfIstDay(now, span - 1).getTime();

    const perDayMap = new Map<string, { revenue: number; orders: number }>();
    const itemMap = new Map<string, number>();
    let totalRevenue = 0;
    let totalOrders = 0;
    let cashOrders = 0;
    let onlineOrders = 0;

    for (const o of orders) {
        if (NOT_SALES_STATUSES.includes(o.status)) continue;
        const created = new Date(o.createdAt);
        if (created.getTime() < rangeStart) continue;

        totalRevenue += o.totalAmount;
        totalOrders += 1;
        if (o.paymentType === "online") onlineOrders += 1;
        else cashOrders += 1;

        const key = istDateKey(created);
        const day = perDayMap.get(key) ?? { revenue: 0, orders: 0 };
        day.revenue += o.totalAmount;
        day.orders += 1;
        perDayMap.set(key, day);

        for (const item of o.items ?? []) {
            itemMap.set(item.name, (itemMap.get(item.name) ?? 0) + item.quantity);
        }
    }

    const perDay: DayRow[] = [];
    for (let i = span - 1; i >= 0; i--) {
        const key = istDateKey(startOfIstDay(now, i));
        const day = perDayMap.get(key) ?? { revenue: 0, orders: 0 };
        perDay.push({ date: key, label: weekdayLabel(key), revenue: day.revenue, orders: day.orders });
    }

    const topItems = [...itemMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }));

    return {
        days: span,
        periodLabel: span === 1 ? "Today" : `Last ${span} days`,
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        activeOrders,
        cashOrders,
        onlineOrders,
        perDay,
        topItems,
    };
}

// ─── Safer item matching for write tools ─────────────────────────────────────
/** Picks exactly one menu item for a name, or explains why it could not. */
export function pickMenuItem(
    candidates: MenuDocLike[],
    name: string,
): { item?: MenuDocLike; error?: string } {
    const { match, ambiguous } = resolveByName(candidates, name);
    if (match) return { item: match };
    if (ambiguous) {
        const names = ambiguous.slice(0, 6).map((a) => a.name).join(", ");
        return { error: `"${name}" matches several items (${names}). Ask the owner which exact item they mean. Nothing was changed.` };
    }
    return { error: `Item "${name}" was not found in your menu. Nothing was changed.` };
}

export const MAX_PRICE = 10000;

/** Returns an error message if the price is not acceptable, otherwise null. */
export function validatePrice(value: unknown): string | null {
    const n = Number(value);
    if (value === null || value === undefined || value === "" || !Number.isFinite(n)) {
        return "The new price must be a number.";
    }
    if (n < 0) return "The price cannot be negative.";
    if (n > MAX_PRICE) return `The price cannot be more than ₹${MAX_PRICE}.`;
    return null;
}

// ─── Quick-reply chips shown under the Copilot's answer ──────────────────────
export function ownerSuggestionsFor(blockTypes: Set<string>): string[] {
    if (blockTypes.has("orders")) return ["Today's sales", "Show unavailable items", "Store status"];
    if (blockTypes.has("sales")) return ["Pending orders", "Show unavailable items", "Sales for the last 7 days"];
    if (blockTypes.has("menu")) return ["Show unavailable items", "Today's sales", "Pending orders"];
    if (blockTypes.has("store")) return ["Pending orders", "Today's sales", "Show unavailable items"];
    return ["Pending orders", "Today's sales", "Show unavailable items", "Store status"];
}
