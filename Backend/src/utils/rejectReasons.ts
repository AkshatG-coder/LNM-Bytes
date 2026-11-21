// Reasons an owner can pick when rejecting an order. Pure helpers, no database or network access.

export const REJECT_REASONS = {
    out_of_stock: "An item in your order is out of stock",
    too_busy: "The kitchen is too busy right now",
    closing_soon: "The canteen is closing soon",
    order_issue: "There was a problem with the order",
    other: "The canteen could not take this order",
} as const;

export type RejectReasonCode = keyof typeof REJECT_REASONS;

export const REJECT_REASON_CODES = Object.keys(REJECT_REASONS) as RejectReasonCode[];
export const REJECT_NOTE_MAX = 120;

export type ParsedReject =
    | { ok: true; code: RejectReasonCode | null; note: string }
    | { ok: false; error: string };

/** Removes control characters and extra spaces, then trims and caps the length. */
export function cleanNote(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, REJECT_NOTE_MAX);
}

/**
 * Reads the optional reason from a reject request body.
 * An empty body is fine (older owner apps send none). An unknown reason is an error.
 */
export function parseRejectReason(body: unknown): ParsedReject {
    if (body === null || body === undefined || typeof body !== "object") return { ok: true, code: null, note: "" };

    const { reason, note } = body as { reason?: unknown; note?: unknown };
    const cleaned = cleanNote(note);

    if (reason === undefined || reason === null || reason === "") {
        // A note without a reason is stored as "other" so the student still sees it.
        return { ok: true, code: cleaned ? "other" : null, note: cleaned };
    }
    if (typeof reason !== "string" || !(REJECT_REASON_CODES as string[]).includes(reason)) {
        return { ok: false, error: `Reason must be one of: ${REJECT_REASON_CODES.join(", ")}` };
    }
    return { ok: true, code: reason as RejectReasonCode, note: cleaned };
}

/** Just the reason, for the order card: "An item in your order is out of stock (no samosa)". */
export function rejectionReasonText(code: RejectReasonCode | null, note: string): string {
    const base = code ? REJECT_REASONS[code] : "The canteen could not take this order";
    return note ? `${base} (${note})` : base;
}

/** The full sentence a student reads in the push message. */
export function rejectionMessage(code: RejectReasonCode | null, note: string, refunded: boolean): string {
    const refund = refunded ? " A full refund has been started." : "";
    return `Sorry, your order was rejected. ${rejectionReasonText(code, note)}.${refund}`;
}
