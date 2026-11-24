// Pure Razorpay helpers (no network, no database) so the money rules can be unit tested.
import crypto from "crypto";

/** Rupees to paise, as the integer Razorpay requires. */
export function toPaise(rupees: number): number {
    return Math.round(Number(rupees) * 100);
}

function safeEqualHex(a: string, b: string): boolean {
    const x = Buffer.from(a, "utf8");
    const y = Buffer.from(b, "utf8");
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Checks the signature Razorpay Checkout returns: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret: string): boolean {
    if (!orderId || !paymentId || !signature || !secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
    return safeEqualHex(expected, signature);
}

/** Checks a webhook: HMAC_SHA256(raw request body, webhook_secret) sent in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string, secret: string): boolean {
    if (!rawBody || !signature || !secret) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return safeEqualHex(expected, signature);
}

export type RzpPayment = { id: string; status: string; amount: number; order_id?: string | null };
export type PaymentVerdict = "captured" | "needs_capture" | "failed" | "pending" | "mismatch";

/** Decides what one Razorpay payment means for one of our orders. Amount and order id must both match. */
export function judgePayment(p: RzpPayment, expectedPaise: number, expectedOrderId: string): PaymentVerdict {
    if (!p || p.order_id !== expectedOrderId || p.amount !== expectedPaise) return "mismatch";
    if (p.status === "captured") return "captured";
    if (p.status === "authorized") return "needs_capture";
    if (p.status === "failed") return "failed";
    return "pending"; // created, refunded and anything unknown never mark an order as paid
}

/** From the payments Razorpay lists for an order, the one that settles it (captured first, then authorized). */
export function pickSettlingPayment(
    payments: RzpPayment[], expectedPaise: number, expectedOrderId: string,
): { payment: RzpPayment; verdict: "captured" | "needs_capture" } | null {
    let authorized: RzpPayment | null = null;
    for (const p of payments || []) {
        const v = judgePayment(p, expectedPaise, expectedOrderId);
        if (v === "captured") return { payment: p, verdict: v };
        if (v === "needs_capture" && !authorized) authorized = p;
    }
    return authorized ? { payment: authorized, verdict: "needs_capture" } : null;
}
