// Validation for the shop settings an owner can change. Pure helpers, no database or network access.

export const STORE_FOOD_TYPES = ["veg", "non-veg", "both"] as const;
export const NIGHT_CHARGE_MAX = 500;

// Fields an owner may change through PUT /store_handler/:id. Everything else (isActive, status,
// ownerName, ...) is ignored, so a request body can't flip fields the settings page doesn't own.
const OWNER_FIELDS = [
    "name", "description", "phone", "location", "operationTime",
    "nightDelivery", "nightDeliveryCharge", "foodType", "isOnlineOrderAvailable", "upiId",
] as const;
const SUPERADMIN_EXTRA_FIELDS = ["status", "isActive", "ownerName"] as const;

export type StoreUpdate = Record<string, unknown>;
export type ParsedStoreUpdate = { ok: true; update: StoreUpdate } | { ok: false; error: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const UPI = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;

function cleanText(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

/** Keeps only the 10 digits of an Indian mobile number ("+91 98765 43210" -> "9876543210"). */
export function normalizePhone(value: unknown): string | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    let digits = String(value).replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
    return digits.length === 10 ? digits : null;
}

export function parseStoreUpdate(body: unknown, role: string | undefined): ParsedStoreUpdate {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Nothing to update" };
    const input = body as Record<string, unknown>;
    const allowed: readonly string[] = role === "superadmin" ? [...OWNER_FIELDS, ...SUPERADMIN_EXTRA_FIELDS] : OWNER_FIELDS;
    const update: StoreUpdate = {};

    for (const key of allowed) {
        if (!(key in input)) continue;
        const v = input[key];

        switch (key) {
            case "name": {
                const t = cleanText(v);
                if (t.length < 2 || t.length > 60) return { ok: false, error: "Shop name must be 2 to 60 characters" };
                update.name = t; break;
            }
            case "description": {
                const t = cleanText(v);
                if (t.length < 1 || t.length > 200) return { ok: false, error: "Description must be 1 to 200 characters" };
                update.description = t; break;
            }
            case "location": {
                const t = cleanText(v);
                if (t.length < 2 || t.length > 80) return { ok: false, error: "Location must be 2 to 80 characters" };
                update.location = t; break;
            }
            case "phone": {
                const p = normalizePhone(v);
                if (!p) return { ok: false, error: "Phone number must be exactly 10 digits" };
                update.phone = p; break;
            }
            case "upiId": {
                const t = cleanText(v).toLowerCase();
                if (!UPI.test(t)) return { ok: false, error: "UPI ID looks wrong. It should look like name@bank" };
                update.upiId = t; break;
            }
            case "operationTime": {
                const o = v as { openTime?: unknown; closeTime?: unknown } | null;
                if (!o || typeof o.openTime !== "string" || typeof o.closeTime !== "string" || !HHMM.test(o.openTime) || !HHMM.test(o.closeTime)) {
                    return { ok: false, error: "Opening and closing time must be valid times" };
                }
                if (o.openTime === o.closeTime) return { ok: false, error: "Opening and closing time can't be the same" };
                update.operationTime = { openTime: o.openTime, closeTime: o.closeTime }; break;
            }
            case "nightDeliveryCharge": {
                const n = typeof v === "number" ? v : Number(v);
                if (!Number.isFinite(n) || n < 0 || n > NIGHT_CHARGE_MAX) return { ok: false, error: `Night delivery charge must be between 0 and ${NIGHT_CHARGE_MAX}` };
                update.nightDeliveryCharge = Math.round(n); break;
            }
            case "foodType": {
                if (typeof v !== "string" || !(STORE_FOOD_TYPES as readonly string[]).includes(v)) return { ok: false, error: "Food type must be veg, non-veg or both" };
                update.foodType = v; break;
            }
            case "nightDelivery":
            case "isOnlineOrderAvailable":
            case "isActive": {
                if (typeof v !== "boolean") return { ok: false, error: `${key} must be true or false` };
                update[key] = v; break;
            }
            case "status": {
                if (v !== "open" && v !== "closed") return { ok: false, error: "Status must be open or closed" };
                update.status = v; break;
            }
            case "ownerName": {
                const t = cleanText(v);
                if (t.length < 2 || t.length > 60) return { ok: false, error: "Owner name must be 2 to 60 characters" };
                update.ownerName = t; break;
            }
        }
    }

    if (Object.keys(update).length === 0) return { ok: false, error: "Nothing to update" };
    return { ok: true, update };
}
