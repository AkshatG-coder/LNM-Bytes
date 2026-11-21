// Pure helpers for web push. No database or network access, so they can be unit-tested directly.
import { z } from "zod";
import { rejectionReasonText } from "./rejectReasons";
import type { RejectReasonCode } from "./rejectReasons";

// ─── Which push services we are willing to send to ───────────────────────────
// The endpoint URL comes from the browser, so without a check a user could make the
// server send requests to any address. Browsers only ever give out these hosts.
const ALLOWED_PUSH_HOSTS = [
    "fcm.googleapis.com",
    "android.googleapis.com",
    "updates.push.services.mozilla.com",
    "push.services.mozilla.com",
    "web.push.apple.com",
    "push.apple.com",
    "notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
    let url: URL;
    try {
        url = new URL(endpoint);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

// ─── Subscription body from the browser ──────────────────────────────────────
const SubscriptionSchema = z.object({
    endpoint: z.string().max(1000),
    keys: z.object({
        p256dh: z.string().min(20).max(200).regex(/^[A-Za-z0-9_-]+={0,2}$/),
        auth: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+={0,2}$/),
    }),
});

export type ParsedSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };

export function parseSubscriptionBody(body: unknown): { ok: true; subscription: ParsedSubscription } | { ok: false; error: string } {
    const sub = (body as any)?.subscription;
    const result = SubscriptionSchema.safeParse(sub);
    if (!result.success) return { ok: false, error: "Invalid push subscription" };
    if (!isAllowedPushEndpoint(result.data.endpoint)) return { ok: false, error: "Unsupported push service" };
    return { ok: true, subscription: result.data };
}

// ─── What the student sees ───────────────────────────────────────────────────
export interface PushMessage {
    title: string;
    body: string;
    /** Page opened when the notification is tapped. */
    url: string;
    /** Same tag replaces an older notification for the same order. */
    tag: string;
    /** Keeps the notification on screen until dismissed (used for "ready"). */
    urgent: boolean;
}

/**
 * Turns an order event into a push message, or null for events that should stay quiet.
 * Only "ready" and a canteen rejection are pushed. The pickup QR is never included.
 */
export function buildOrderPush(payload: any): PushMessage | null {
    if (!payload || typeof payload !== "object") return null;
    const num = payload.orderNumber ? ` #${payload.orderNumber}` : "";
    const orderKey = String(payload.orderId ?? payload.orderNumber ?? "order");

    if (payload.type === "orderReady") {
        return {
            title: `Order${num} is ready`,
            body: "Show your pickup QR at the counter.",
            url: "/orders",
            tag: `order-${orderKey}`,
            urgent: true,
        };
    }

    if (payload.type === "orderCancelled" && payload.rejected === true) {
        const reason = rejectionReasonText((payload.reason ?? null) as RejectReasonCode | null, String(payload.note ?? ""));
        return {
            title: `Order${num} was declined`,
            body: `${reason}.${payload.refunded ? " Your refund has started." : ""}`,
            url: "/orders",
            tag: `order-${orderKey}`,
            urgent: false,
        };
    }

    return null;
}
