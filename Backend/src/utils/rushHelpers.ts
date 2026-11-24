// Rush Radar: how busy a canteen is right now, and when it usually gets quiet.
// Pure helpers, no database or network access, so they can be unit-tested directly.
import { istDateKey } from "./copilotHelpers";

const IST_OFFSET_MS = 330 * 60 * 1000;

export const HISTORY_DAYS = 28;      // four weeks of history
export const MIN_WEEKDAY_DAYS = 2;   // same-weekday days needed for a weekday forecast
export const MIN_ANY_DAYS = 3;       // otherwise this many days of any weekday
export const LOOKAHEAD_HOURS = 6;    // the strip shows now and the next five hours
export const MINUTES_PER_QUEUED_ORDER = 2; // rough kitchen speed: a queue of 5 is about a 10 minute wait

// Queue size right now (orders waiting or being cooked)
export const QUIET_MAX_ACTIVE = 3;
export const BUSY_MIN_ACTIVE = 8;

export type RushLevel = "quiet" | "moderate" | "busy";

export interface HourlyRow {
    date: string;   // YYYY-MM-DD in IST
    hour: number;   // 0-23 in IST
    count: number;  // orders placed in that hour
}

export interface RushHour {
    hour: number;
    label: string;       // "1 pm"
    typical: number;     // average orders in that hour (one decimal)
    level: RushLevel;
    isNow: boolean;
}

export interface RushRadar {
    level: RushLevel;
    activeOrders: number;
    waitMin: number;                       // 0 when nobody is waiting
    hours: RushHour[];                     // empty when there is not enough history
    bestHour: { hour: number; label: string } | null;
    nowIsBest: boolean;
    basedOnDays: number;                   // how many past days the forecast comes from
}

export function hourLabel(hour: number): string {
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12} ${hour < 12 ? "am" : "pm"}`;
}

export function liveLevel(activeOrders: number): RushLevel {
    if (activeOrders >= BUSY_MIN_ACTIVE) return "busy";
    if (activeOrders > QUIET_MAX_ACTIVE) return "moderate";
    return "quiet";
}

/** About how long a new order waits. Rounded up to 5 minutes so it does not look falsely exact. */
export function estimateWaitMin(activeOrders: number): number {
    if (activeOrders <= 0) return 0;
    return Math.max(5, Math.ceil((activeOrders * MINUTES_PER_QUEUED_ORDER) / 5) * 5);
}

function minutesOf(hhmm: string | undefined): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Is any part of this hour inside the opening hours? Handles stores open past midnight. */
export function hourIsOpen(hour: number, openTime?: string, closeTime?: string): boolean {
    const open = minutesOf(openTime);
    const close = minutesOf(closeTime);
    if (open === null || close === null) return true; // no hours set: treat the whole day as open
    const start = hour * 60;
    const end = start + 59;
    if (close >= open) return end >= open && start < close;
    return end >= open || start < close; // overnight (e.g. 20:00 to 02:00)
}

function istNowParts(now: Date) {
    const shifted = new Date(now.getTime() + IST_OFFSET_MS);
    return { weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
}

function weekdayOfKey(dateKey: string): number {
    return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** Average orders per hour of the day from past days. Days with no orders at all (closed, holiday) are skipped. */
export function typicalByHour(rows: HourlyRow[], now: Date): { byHour: number[]; days: number } | null {
    const today = istDateKey(now);
    const { weekday } = istNowParts(now);

    const perDay = new Map<string, number[]>();
    for (const r of rows) {
        if (r.date >= today) continue; // only finished days; today is still being counted
        if (!Number.isInteger(r.hour) || r.hour < 0 || r.hour > 23 || !(r.count > 0)) continue;
        const arr = perDay.get(r.date) ?? new Array(24).fill(0);
        arr[r.hour] += r.count;
        perDay.set(r.date, arr);
    }

    const sameWeekday = Array.from(perDay.entries()).filter(([d]) => weekdayOfKey(d) === weekday);
    let used: number[][];
    if (sameWeekday.length >= MIN_WEEKDAY_DAYS) used = sameWeekday.map(([, v]) => v);
    else if (perDay.size >= MIN_ANY_DAYS) used = Array.from(perDay.values());
    else return null;

    const byHour = new Array(24).fill(0);
    for (const day of used) for (let h = 0; h < 24; h++) byHour[h] += day[h];
    return { byHour: byHour.map((v) => v / used.length), days: used.length };
}

export interface RushInput {
    activeOrders: number;
    history: HourlyRow[];
    openTime?: string;
    closeTime?: string;
    now?: Date;
}

export function buildRush(input: RushInput): RushRadar {
    const now = input.now ?? new Date();
    const active = Math.max(0, Math.floor(input.activeOrders) || 0);
    const base: RushRadar = {
        level: liveLevel(active),
        activeOrders: active,
        waitMin: estimateWaitMin(active),
        hours: [],
        bestHour: null,
        nowIsBest: false,
        basedOnDays: 0,
    };

    const typical = typicalByHour(input.history, now);
    if (!typical) return base;

    const { hour: nowHour } = istNowParts(now);
    const open = (h: number) => hourIsOpen(h, input.openTime, input.closeTime);
    const dayPeak = Math.max(...typical.byHour.filter((_, h) => open(h)), 0);
    if (dayPeak <= 0) return { ...base, basedOnDays: typical.days };

    const levelOf = (v: number): RushLevel => {
        const share = v / dayPeak; // compared with this canteen's own busiest hour
        if (share >= 0.75) return "busy";
        if (share >= 0.4) return "moderate";
        return "quiet";
    };

    const hours: RushHour[] = [];
    for (let i = 0; i < LOOKAHEAD_HOURS; i++) {
        const h = (nowHour + i) % 24;
        if (!open(h)) continue;
        const v = typical.byHour[h];
        hours.push({ hour: h, label: hourLabel(h), typical: Math.round(v * 10) / 10, level: levelOf(v), isNow: i === 0 });
    }

    // Suggest the quietest hour that is clearly quieter than now; if now is the quietest, say so
    let bestHour: RushRadar["bestHour"] = null;
    let nowIsBest = false;
    if (hours.length >= 2) {
        const nowRow = hours.find((h) => h.isNow);
        const later = hours.filter((h) => !h.isNow);
        const quietest = later.reduce((a, b) => (b.typical < a.typical ? b : a));
        if (nowRow) {
            if (nowRow.typical <= quietest.typical) nowIsBest = true;
            else if (quietest.typical <= nowRow.typical * 0.7) bestHour = { hour: quietest.hour, label: quietest.label };
        } else {
            bestHour = { hour: quietest.hour, label: quietest.label };
        }
    }

    return { ...base, hours, bestHour, nowIsBest, basedOnDays: typical.days };
}
