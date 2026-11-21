// Demand hints for owners: "On Tuesday lunch you usually sell about 40 rolls".
// Pure helpers, no database or network access, so they can be unit-tested directly.
import { startOfIstDay, istDateKey, NOT_SALES_STATUSES } from "./copilotHelpers";

const IST_OFFSET_MS = 330 * 60 * 1000;

export const DEMAND_WINDOW_DAYS = 56;   // 8 weeks of history
export const MIN_SAMPLE_DAYS = 2;       // fewer matching weekdays than this is a guess, not a hint
const TOP_ITEMS = 5;

export type SlotId = "late_night" | "breakfast" | "lunch" | "snacks" | "dinner";

// In order through the day, hours in IST
const SLOTS: { id: SlotId; label: string; from: number; to: number }[] = [
    { id: "late_night", label: "late night", from: 0, to: 5 },
    { id: "breakfast", label: "breakfast", from: 5, to: 11 },
    { id: "lunch", label: "lunch", from: 11, to: 16 },
    { id: "snacks", label: "evening snacks", from: 16, to: 19 },
    { id: "dinner", label: "dinner", from: 19, to: 24 },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface DemandOrderLike {
    status: string;
    createdAt: Date | string;
    items?: Array<{ name: string; quantity: number }>;
}

export interface DemandHint {
    slot: SlotId;
    slotLabel: string;
    weekday: string;          // "Tuesday"
    isNow: boolean;           // true for the slot happening now, false for the next one
    sampleDays: number;       // how many past matching days the numbers come from
    typicalOrders: number;    // rounded
    items: { name: string; qty: number }[];   // rounded, biggest first
    peakHour: string | null;  // "1 pm"
}

function istParts(date: Date) {
    const shifted = new Date(date.getTime() + IST_OFFSET_MS);
    return { weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

function slotIndexOfHour(hour: number): number {
    return SLOTS.findIndex((s) => hour >= s.from && hour < s.to);
}

/** Plain-number rounding that reads naturally: 7, 35, 40, 120. */
export function roundDemand(n: number): number {
    if (n <= 0) return 0;
    if (n < 10) return Math.max(1, Math.round(n));
    if (n < 100) return Math.round(n / 5) * 5;
    return Math.round(n / 10) * 10;
}

export function hourLabel(hour: number): string {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12} ${hour < 12 ? "am" : "pm"}`;
}

/** The slot happening at `now` and the one after it (dinner is followed by tomorrow's late night). */
export function targetSlots(now: Date): { slot: SlotId; weekday: number; isNow: boolean }[] {
    const { weekday, hour } = istParts(now);
    const i = slotIndexOfHour(hour);
    const current = { slot: SLOTS[i].id, weekday, isNow: true };
    const next =
        i === SLOTS.length - 1
            ? { slot: SLOTS[0].id, weekday: (weekday + 1) % 7, isNow: false }
            : { slot: SLOTS[i + 1].id, weekday, isNow: false };
    return [current, next];
}

/** Average demand for one weekday and slot over past matching days. Returns null when history is too thin. */
export function demandFor(
    orders: DemandOrderLike[],
    slot: SlotId,
    weekday: number,
    now: Date = new Date(),
): Omit<DemandHint, "isNow"> | null {
    const slotDef = SLOTS.find((s) => s.id === slot)!;
    const todayKey = istDateKey(now);
    const windowStart = startOfIstDay(now, DEMAND_WINDOW_DAYS).getTime();

    // A day counts as "open" if the store had any order that day. Closed days should not pull the average down.
    const openDays = new Set<string>();
    const itemTotals = new Map<string, number>();
    const hourOrders = new Map<number, number>();
    let slotOrders = 0;

    for (const o of orders) {
        if (NOT_SALES_STATUSES.includes(o.status)) continue;
        const created = new Date(o.createdAt);
        if (created.getTime() < windowStart) continue;
        const key = istDateKey(created);
        if (key === todayKey) continue; // today is still incomplete
        const parts = istParts(created);
        if (parts.weekday !== weekday) continue;

        openDays.add(key);
        if (parts.hour < slotDef.from || parts.hour >= slotDef.to) continue;

        slotOrders += 1;
        hourOrders.set(parts.hour, (hourOrders.get(parts.hour) ?? 0) + 1);
        for (const item of o.items ?? []) {
            itemTotals.set(item.name, (itemTotals.get(item.name) ?? 0) + item.quantity);
        }
    }

    const sampleDays = openDays.size;
    if (sampleDays < MIN_SAMPLE_DAYS || slotOrders === 0) return null;

    const items = [...itemTotals.entries()]
        .map(([name, total]) => ({ name, qty: roundDemand(total / sampleDays) }))
        .filter((i) => i.qty >= 1)
        .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name))
        .slice(0, TOP_ITEMS);

    let peak: number | null = null;
    let peakCount = 0;
    for (const [hour, count] of hourOrders) {
        if (count > peakCount || (count === peakCount && peak !== null && hour < peak)) {
            peak = hour;
            peakCount = count;
        }
    }

    return {
        slot,
        slotLabel: slotDef.label,
        weekday: WEEKDAYS[weekday],
        sampleDays,
        typicalOrders: roundDemand(slotOrders / sampleDays),
        items,
        peakHour: peak === null ? null : hourLabel(peak),
    };
}

/** Hints for the slot happening now and the next one. Slots without enough history are left out. */
export function buildDemandHints(orders: DemandOrderLike[], now: Date = new Date()): DemandHint[] {
    const hints: DemandHint[] = [];
    for (const t of targetSlots(now)) {
        const d = demandFor(orders, t.slot, t.weekday, now);
        if (d) hints.push({ ...d, isNow: t.isNow });
    }
    return hints;
}

/** One sentence for each hint: "Tuesday lunch: you usually sell about 40 Veg Roll, 25 Samosa." */
export function describeHint(h: DemandHint): string {
    const items = h.items.map((i) => `${i.qty} ${i.name}`).join(", ");
    const peak = h.peakHour ? ` Busiest around ${h.peakHour}.` : "";
    return `${h.weekday} ${h.slotLabel}: you usually sell about ${items} (around ${h.typicalOrders} orders, based on the last ${h.sampleDays} ${h.weekday}s).${peak}`;
}
