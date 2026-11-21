// Numbers for the owner "Insights" page. Pure helpers, no database or network access.
import { startOfIstDay, istDateKey, NOT_SALES_STATUSES } from "./copilotHelpers";
import { REJECT_REASONS } from "./rejectReasons";
import { hourLabel } from "./demandHelpers";

const IST_OFFSET_MS = 330 * 60 * 1000;
export const INSIGHT_RANGES = [7, 14, 30, 60, 90] as const;

export interface InsightOrder {
    status: string;
    createdAt: Date | string;
    totalAmount: number;
    paymentType: string;
    userId: unknown;
    userName?: string;
    qrVerifiedAt?: Date | string | null;
    rating?: number | null;
    rejectionReason?: string | null;
    items?: Array<{ menuItemId?: unknown; name: string; quantity: number; price: number }>;
}

export interface InsightMenuItem {
    id: string;
    name: string;
    category: string;
    isAvailable: boolean;
    rating: number;
    ratingCount: number;
}

export interface PeriodKpis {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    students: number;
    repeatRate: number;      // share of students who ordered 2+ times, 0 to 100
    rejectionRate: number;   // share of orders the canteen rejected, 0 to 100
    avgRating: number | null;
    ratingCount: number;
    medianPickupMinutes: number | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istParts(date: Date) {
    const s = new Date(date.getTime() + IST_OFFSET_MS);
    return { weekday: s.getUTCDay(), hour: s.getUTCHours() };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function median(values: number[]): number | null {
    if (!values.length) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const isRejected = (o: InsightOrder) => o.status === "cancelled" && !!o.rejectionReason;
const isSale = (o: InsightOrder) => !NOT_SALES_STATUSES.includes(o.status);

/** The headline numbers for one set of orders. */
export function periodKpis(orders: InsightOrder[]): PeriodKpis {
    const sales = orders.filter(isSale);
    const rejected = orders.filter(isRejected).length;
    const revenue = sales.reduce((s, o) => s + o.totalAmount, 0);

    const perStudent = new Map<string, number>();
    for (const o of sales) perStudent.set(String(o.userId), (perStudent.get(String(o.userId)) ?? 0) + 1);
    const repeaters = [...perStudent.values()].filter((n) => n >= 2).length;

    const rated = sales.filter((o) => o.rating);
    const pickups = sales
        .filter((o) => o.status === "delivered" && o.qrVerifiedAt)
        .map((o) => (new Date(o.qrVerifiedAt as Date).getTime() - new Date(o.createdAt).getTime()) / 60_000)
        .filter((m) => m >= 0 && m < 180);
    const medianPickup = median(pickups);

    return {
        revenue,
        orders: sales.length,
        avgOrderValue: sales.length ? Math.round(revenue / sales.length) : 0,
        students: perStudent.size,
        repeatRate: perStudent.size ? round1((repeaters / perStudent.size) * 100) : 0,
        rejectionRate: sales.length + rejected ? round1((rejected / (sales.length + rejected)) * 100) : 0,
        avgRating: rated.length ? round2(rated.reduce((s, o) => s + (o.rating as number), 0) / rated.length) : null,
        ratingCount: rated.length,
        medianPickupMinutes: medianPickup === null ? null : Math.round(medianPickup),
    };
}

export function buildInsights(
    orders: InsightOrder[],
    menu: InsightMenuItem[],
    days: number,
    now: Date = new Date(),
) {
    const span = Math.min(90, Math.max(1, Math.floor(days) || 30));
    const start = startOfIstDay(now, span - 1).getTime();
    const prevStart = startOfIstDay(now, 2 * span - 1).getTime();

    const current = orders.filter((o) => new Date(o.createdAt).getTime() >= start);
    const previous = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= prevStart && t < start;
    });

    const sales = current.filter(isSale);
    const menuById = new Map(menu.map((m) => [m.id, m]));

    // ─── Per day ─────────────────────────────────────────────────────────────
    const dayMap = new Map<string, { revenue: number; orders: number }>();
    for (const o of sales) {
        const key = istDateKey(new Date(o.createdAt));
        const d = dayMap.get(key) ?? { revenue: 0, orders: 0 };
        d.revenue += o.totalAmount;
        d.orders += 1;
        dayMap.set(key, d);
    }
    const perDay: { date: string; label: string; revenue: number; orders: number }[] = [];
    for (let i = span - 1; i >= 0; i--) {
        const dayStart = startOfIstDay(now, i);
        const key = istDateKey(dayStart);
        const d = dayMap.get(key) ?? { revenue: 0, orders: 0 };
        perDay.push({ date: key, label: WEEKDAYS[istParts(new Date(dayStart.getTime() + 60_000)).weekday], ...d });
    }

    // ─── Busiest times: weekday x hour ───────────────────────────────────────
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const o of sales) {
        const p = istParts(new Date(o.createdAt));
        heatmap[p.weekday][p.hour] += 1;
    }
    let peak: { weekday: string; hour: string; orders: number } | null = null;
    for (let w = 0; w < 7; w++)
        for (let h = 0; h < 24; h++)
            if (heatmap[w][h] > (peak?.orders ?? 0)) peak = { weekday: WEEKDAYS[w], hour: hourLabel(h), orders: heatmap[w][h] };

    // ─── Items and categories ────────────────────────────────────────────────
    const itemMap = new Map<string, { name: string; qty: number; revenue: number; category: string }>();
    const categoryMap = new Map<string, { revenue: number; qty: number }>();
    for (const o of sales) {
        for (const it of o.items ?? []) {
            const menuItem = menuById.get(String(it.menuItemId));
            const category = menuItem?.category ?? "other";
            const key = menuItem?.id ?? `name:${it.name}`;
            const row = itemMap.get(key) ?? { name: menuItem?.name ?? it.name, qty: 0, revenue: 0, category };
            row.qty += it.quantity;
            row.revenue += it.price * it.quantity;
            itemMap.set(key, row);
            const c = categoryMap.get(category) ?? { revenue: 0, qty: 0 };
            c.revenue += it.price * it.quantity;
            c.qty += it.quantity;
            categoryMap.set(category, c);
        }
    }
    const itemsRanked = [...itemMap.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
    const topItems = itemsRanked.slice(0, 8);

    // Menu items that barely sell, including ones nobody ordered
    const soldByName = new Map(itemsRanked.map((i) => [i.name, i]));
    const slowItems = menu
        .filter((m) => m.isAvailable)
        .map((m) => ({ name: m.name, qty: soldByName.get(m.name)?.qty ?? 0, revenue: soldByName.get(m.name)?.revenue ?? 0 }))
        .sort((a, b) => a.qty - b.qty || a.name.localeCompare(b.name))
        .slice(0, 5);

    const categories = [...categoryMap.entries()]
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue);

    // ─── Payments ────────────────────────────────────────────────────────────
    const payments = {
        cash: { orders: 0, revenue: 0 },
        online: { orders: 0, revenue: 0 },
    };
    for (const o of sales) {
        const p = o.paymentType === "online" ? payments.online : payments.cash;
        p.orders += 1;
        p.revenue += o.totalAmount;
    }

    // ─── Ratings ─────────────────────────────────────────────────────────────
    const distribution = [0, 0, 0, 0, 0];
    for (const o of sales) if (o.rating && o.rating >= 1 && o.rating <= 5) distribution[o.rating - 1] += 1;
    const lowRated = menu
        .filter((m) => m.ratingCount >= 3 && m.rating > 0)
        .sort((a, b) => a.rating - b.rating)
        .slice(0, 3)
        .map((m) => ({ name: m.name, rating: m.rating, count: m.ratingCount }));

    // ─── Rejections ──────────────────────────────────────────────────────────
    const reasonCounts = new Map<string, number>();
    for (const o of current.filter(isRejected)) reasonCounts.set(o.rejectionReason as string, (reasonCounts.get(o.rejectionReason as string) ?? 0) + 1);
    const rejections = [...reasonCounts.entries()]
        .map(([code, count]) => ({ code, label: (REJECT_REASONS as Record<string, string>)[code] ?? code, count }))
        .sort((a, b) => b.count - a.count);

    // ─── Regulars ────────────────────────────────────────────────────────────
    const students = new Map<string, { name: string; orders: number; spend: number }>();
    for (const o of sales) {
        const key = String(o.userId);
        const s = students.get(key) ?? { name: o.userName || "Student", orders: 0, spend: 0 };
        s.orders += 1;
        s.spend += o.totalAmount;
        students.set(key, s);
    }
    const regulars = [...students.values()].sort((a, b) => b.orders - a.orders || b.spend - a.spend).slice(0, 5);

    return {
        days: span,
        from: istDateKey(new Date(start)),
        to: istDateKey(now),
        kpis: periodKpis(current),
        previous: periodKpis(previous),
        hasPrevious: previous.length > 0,
        perDay,
        heatmap,
        peak,
        topItems,
        slowItems,
        categories,
        payments,
        ratings: { distribution, lowRated },
        rejections,
        regulars,
    };
}
