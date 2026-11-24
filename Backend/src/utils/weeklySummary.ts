// Weekly summary email for canteen owners. Pure helpers, no database or network access.
import { startOfIstDay } from "./copilotHelpers";
import type { buildInsights } from "./insightsHelpers";

type Insights = ReturnType<typeof buildInsights>;

const IST_OFFSET_MS = 330 * 60 * 1000;
export const SEND_WEEKDAY = 1; // Monday
export const SEND_HOUR_IST = 8;

/** The most recent Monday 08:00 IST at or before `now`. */
export function lastScheduledSend(now: Date = new Date()): Date {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    const daysSinceMonday = (ist.getUTCDay() - SEND_WEEKDAY + 7) % 7;
    let at = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysSinceMonday, SEND_HOUR_IST) - IST_OFFSET_MS;
    if (at > now.getTime()) at -= 7 * 24 * 3600 * 1000; // it is Monday, but before 08:00
    return new Date(at);
}

/**
 * True when an owner is owed a summary. Catches up if the server was asleep on Monday morning,
 * but never sends for a week that ended before the owner switched the email on.
 */
export function isSummaryDue(
    enabled: boolean,
    enabledAt: Date | null | undefined,
    lastSentAt: Date | null | undefined,
    now: Date = new Date(),
): boolean {
    if (!enabled) return false;
    const scheduled = lastScheduledSend(now).getTime();
    const since = Math.max(enabledAt ? new Date(enabledAt).getTime() : 0, lastSentAt ? new Date(lastSentAt).getTime() : 0);
    return since < scheduled;
}

/** Where the report window ends: the start of today in IST, so it covers whole days only. */
export function reportWindow(now: Date = new Date()) {
    const end = startOfIstDay(now, 0);
    return {
        end,
        asOf: new Date(end.getTime() - 1),
        fetchFrom: startOfIstDay(new Date(end.getTime() - 1), 13), // this week and the one before
    };
}

export const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function pctChange(now: number, before: number): number | null {
    if (!before) return null;
    return Math.round(((now - before) / before) * 100);
}

function changeText(pct: number | null): string {
    if (pct === null) return "";
    if (pct === 0) return "same as the week before";
    return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on the week before`;
}

function dayRange(from: string, to: string): string {
    const f = (k: string) =>
        new Date(`${k}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    return `${f(from)} to ${f(to)}`;
}

export interface SummaryEmail {
    subject: string;
    text: string;
    html: string;
}

/** Plain facts from last week, in the order an owner would want them. */
const OWNER_REASON: Record<string, string> = {
    out_of_stock: "item out of stock",
    too_busy: "kitchen too busy",
    closing_soon: "closing soon",
    order_issue: "problem with the order",
    other: "other",
};

export function summaryFacts(ins: Insights): string[] {
    const k = ins.kpis;
    const facts: string[] = [];
    const rev = changeText(pctChange(k.revenue, ins.previous.revenue));
    facts.push(`Sales were ${inr(k.revenue)} from ${k.orders} order${k.orders === 1 ? "" : "s"}${rev && ins.hasPrevious ? `, ${rev}` : ""}.`);

    const best = [...ins.perDay].sort((a, b) => b.revenue - a.revenue)[0];
    if (best && best.revenue > 0) facts.push(`${best.label} was the best day, with ${inr(best.revenue)}.`);
    if (ins.peak) facts.push(`The busiest time was ${ins.peak.weekday} around ${ins.peak.hour}, with ${ins.peak.orders} order${ins.peak.orders === 1 ? "" : "s"}.`);

    if (ins.topItems.length) {
        facts.push(`Top sellers: ${ins.topItems.slice(0, 3).map((i) => `${i.name} (${i.qty})`).join(", ")}.`);
    }
    const slow = ins.slowItems.filter((i) => i.qty === 0).slice(0, 3);
    if (slow.length) facts.push(`Nobody ordered: ${slow.map((i) => i.name).join(", ")}. Consider a discount or taking them off the menu.`);

    if (k.students > 0) facts.push(`${k.students} students ordered, and ${k.repeatRate}% of them came back for more.`);
    if (k.avgRating !== null) facts.push(`Average rating was ${k.avgRating} from ${k.ratingCount} ratings.`);
    if (ins.rejections.length) {
        const total = ins.rejections.reduce((s, r) => s + r.count, 0);
        facts.push(`You rejected ${total} order${total === 1 ? "" : "s"}; the most common reason was ${OWNER_REASON[ins.rejections[0].code] ?? ins.rejections[0].label}.`);
    }
    return facts;
}

export function buildSummaryEmail(ins: Insights, storeName: string, ownerName?: string): SummaryEmail {
    const range = dayRange(ins.from, ins.to);
    const k = ins.kpis;
    const hello = `Hi ${ownerName ? ownerName.split(" ")[0] : "there"},`;

    if (k.orders === 0) {
        const text = `${hello}\n\nThere were no orders at ${storeName} from ${range}. Check that the canteen is marked open and the menu is up to date.\n\nTurn this email off in Insights > Weekly email.`;
        return {
            subject: `${storeName}: no orders last week`,
            text,
            html: wrap(storeName, range, `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(hello)}</p><p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">There were no orders from ${escapeHtml(range)}. Check that the canteen is marked open and the menu is up to date.</p>`),
        };
    }

    const facts = summaryFacts(ins);
    const pct = ins.hasPrevious ? pctChange(k.revenue, ins.previous.revenue) : null;
    const tiles: [string, string][] = [
        ["Sales", inr(k.revenue)],
        ["Orders", String(k.orders)],
        ["Average order", inr(k.avgOrderValue)],
    ];
    const tileHtml = tiles
        .map(([l, v]) => `<td width="33%" style="padding:14px 10px;background:#fff7ed;border-radius:12px;text-align:center;"><div style="font-size:11px;color:#9a3412;font-weight:700;">${l}</div><div style="font-size:22px;font-weight:800;color:#1e293b;margin-top:4px;">${escapeHtml(v)}</div></td>`)
        .join('<td width="8"></td>');
    const factHtml = facts
        .map((f) => `<li style="margin:0 0 8px;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(f)}</li>`)
        .join("");
    const body = `<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.6;">${escapeHtml(hello)} here is how last week went.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr>${tileHtml}</tr></table>
<ul style="margin:0;padding-left:20px;">${factHtml}</ul>`;

    const subject = `${storeName}: ${inr(k.revenue)} last week${pct !== null ? ` (${pct >= 0 ? "+" : ""}${pct}%)` : ""}`;
    const text = `${hello}\n\n${storeName}, ${range}\n\n${facts.map((f) => `- ${f}`).join("\n")}\n\nTurn this email off in Insights > Weekly email.`;
    return { subject, text, html: wrap(storeName, range, body) };
}

function wrap(storeName: string, range: string, body: string): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Weekly summary</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:100%;background:#ffffff;border-radius:20px;overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#f97316,#ef4444);padding:26px 32px;">
<div style="color:#ffffff;font-size:20px;font-weight:900;">${escapeHtml(storeName)}</div>
<div style="color:rgba(255,255,255,0.9);font-size:13px;margin-top:4px;">Weekly summary, ${escapeHtml(range)}</div></td></tr>
<tr><td style="padding:28px 32px;">${body}</td></tr>
<tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px;">
You get this every Monday because you turned it on. Turn it off in Insights, under Weekly email.</td></tr>
</table></td></tr></table></body></html>`;
}
