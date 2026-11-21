// Pure helpers for the BiteBot chat assistant. No database or network access here,
// so everything in this file can be unit-tested directly.

export type DeliveryType = "pickup" | "night_delivery";
export type Portion = "full" | "half";

export interface StoreLike {
    _id: any;
    name: string;
    status?: string;
    isActive?: boolean;
    isOnlineOrderAvailable?: boolean;
    nightDelivery?: boolean;
    nightDeliveryCharge?: number;
    location?: string;
    foodType?: string;
    operationTime?: { openTime?: string; closeTime?: string };
}

export interface MenuDocLike {
    _id: any;
    name: string;
    price: number;
    hasHalf?: boolean;
    halfPrice?: number | null;
    isAvailable?: boolean;
    isVeg?: boolean;
    category?: string;
    rating?: number;
    storeId: any;
}

// ─── UI blocks sent to the frontend next to the text reply ───────────────────
export interface UiMenuItem {
    id: string;
    name: string;
    price: number;
    halfPrice: number | null;
    hasHalf: boolean;
    isVeg: boolean;
    category: string;
    rating: number;
    storeId: string;
    storeName: string;
    storeOpen: boolean;
    onlineAvailable: boolean;
    timesOrdered?: number;
}

export interface UiStore {
    id: string;
    name: string;
    location: string;
    foodType: string;
    openTime: string;
    closeTime: string;
    nightDelivery: boolean;
    orderableNow: boolean;
    status: string;
}

export interface UiOrder {
    id: string;
    orderNumber: number;
    status: string;
    storeName: string;
    items: string;
    totalAmount: number;
    paymentType: string;
    paymentStatus?: string;
    placedAt?: string;
    /** Sentence explaining why the canteen rejected the order, when it did. */
    rejectionText?: string;
}

export interface DraftLine {
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    portionSize: Portion;
    isVeg?: boolean;
}

export interface OrderDraft {
    storeId: string;
    storeName: string;
    items: DraftLine[];
    subtotal: number;
    deliveryType: DeliveryType;
    deliveryCharge: number;
    total: number;
    nightDeliveryAvailable: boolean;
    nightDeliveryCharge: number;
    issues: string[]; // problems that stop the order being placed
    notes: string[];  // harmless info, e.g. "no half portion, using full"
    canPlace: boolean;
    createdAt: string;
}

export type UiBlock =
    | { type: "menu_items"; title?: string; items: UiMenuItem[]; hiddenCount?: number }
    | { type: "stores"; stores: UiStore[] }
    | { type: "orders"; orders: UiOrder[] }
    | { type: "order_draft"; draft: OrderDraft };

// ─── Small utilities ─────────────────────────────────────────────────────────
export function escapeRegExp(text: string): string {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

export const idOf = (value: any): string => (value == null ? "" : String(value));

// ─── Store hours / orderability (mirrors the checks in Order_Controller.CreateOrder) ───
export function istHHMM(now: Date = new Date()): string {
    const s = now.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
    });
    return s.replace(/^24/, "00"); // some runtimes print midnight as 24:xx
}

export function isWithinHours(openTime: string, closeTime: string, nowHHMM: string): boolean {
    if (closeTime < openTime) {
        // stays open past midnight, e.g. 20:00 -> 02:00
        return nowHHMM >= openTime || nowHHMM <= closeTime;
    }
    return nowHHMM >= openTime && nowHHMM <= closeTime;
}

export function orderability(
    store: StoreLike,
    deliveryType: DeliveryType = "pickup",
    now: Date = new Date(),
): { ok: boolean; reason?: string } {
    if (store.status !== "open" || store.isActive === false) {
        return { ok: false, reason: `${store.name} is currently closed.` };
    }
    if (store.isOnlineOrderAvailable === false) {
        return { ok: false, reason: `${store.name} has paused app orders right now.` };
    }
    if (deliveryType === "night_delivery") {
        if (!store.nightDelivery) return { ok: false, reason: `${store.name} does not offer night delivery.` };
        return { ok: true }; // night delivery skips the operating-hours check, like CreateOrder
    }
    const ot = store.operationTime;
    if (ot?.openTime && ot?.closeTime && !isWithinHours(ot.openTime, ot.closeTime, istHHMM(now))) {
        return { ok: false, reason: `${store.name} is outside its operating hours (${ot.openTime} to ${ot.closeTime}).` };
    }
    return { ok: true };
}

// ─── Mapping DB documents to UI shapes ───────────────────────────────────────
export function toUiMenuItem(item: MenuDocLike, store: StoreLike | undefined, timesOrdered?: number): UiMenuItem {
    return {
        id: idOf(item._id),
        name: item.name,
        price: item.price,
        halfPrice: item.hasHalf && item.halfPrice ? item.halfPrice : null,
        hasHalf: !!(item.hasHalf && item.halfPrice),
        isVeg: item.isVeg !== false,
        category: item.category || "other",
        rating: item.rating || 0,
        storeId: idOf(item.storeId),
        storeName: store?.name || "Unknown",
        storeOpen: !!store && store.status === "open" && store.isActive !== false,
        onlineAvailable: store?.isOnlineOrderAvailable !== false,
        ...(timesOrdered ? { timesOrdered } : {}),
    };
}

export function toUiStore(store: StoreLike, now: Date = new Date()): UiStore {
    return {
        id: idOf(store._id),
        name: store.name,
        location: store.location || "",
        foodType: store.foodType || "",
        openTime: store.operationTime?.openTime || "",
        closeTime: store.operationTime?.closeTime || "",
        nightDelivery: !!store.nightDelivery,
        orderableNow: orderability(store, "pickup", now).ok,
        status: store.status || "closed",
    };
}

// ─── Resolving an item the user typed by name ────────────────────────────────
export function resolveByName(
    candidates: MenuDocLike[],
    name: string,
): { match?: MenuDocLike; ambiguous?: MenuDocLike[] } {
    const q = name.trim().toLowerCase();
    if (!q) return {};
    const exact = candidates.filter((c) => c.name.trim().toLowerCase() === q);
    if (exact.length === 1) return { match: exact[0] };
    const pool = exact.length > 1 ? exact : candidates.filter((c) => c.name.toLowerCase().includes(q));
    if (pool.length === 1) return { match: pool[0] };
    if (pool.length > 1) return { ambiguous: pool };
    return {};
}

// ─── Building an order draft ─────────────────────────────────────────────────
export interface DraftLineInput {
    doc: MenuDocLike;
    quantity: number;
    portionSize: Portion;
}

export const MAX_QTY_PER_ITEM = 10;
export const MAX_LINES = 15;

export function assembleDraft(
    lines: DraftLineInput[],
    store: StoreLike,
    deliveryType: DeliveryType = "pickup",
    extraIssues: string[] = [],
    now: Date = new Date(),
): OrderDraft {
    const issues = [...extraIssues];
    const notes: string[] = [];
    const merged = new Map<string, DraftLine>();

    for (const line of lines) {
        const { doc } = line;
        if (doc.isAvailable === false) {
            issues.push(`${doc.name} is sold out right now.`);
            continue;
        }

        let portion: Portion = line.portionSize;
        let price = doc.price;
        if (portion === "half") {
            if (doc.hasHalf && doc.halfPrice) {
                price = doc.halfPrice;
            } else {
                portion = "full";
                notes.push(`${doc.name} has no half portion, so the full portion was used.`);
            }
        }

        const key = `${idOf(doc._id)}__${portion}`;
        const qty = clampInt(line.quantity, 1, MAX_QTY_PER_ITEM, 1);
        const existing = merged.get(key);
        if (existing) {
            existing.quantity = Math.min(MAX_QTY_PER_ITEM, existing.quantity + qty);
        } else {
            merged.set(key, {
                menuItemId: idOf(doc._id),
                name: doc.name,
                quantity: qty,
                price,
                portionSize: portion,
                isVeg: doc.isVeg !== false,
            });
        }
    }

    let items = [...merged.values()];
    if (items.length > MAX_LINES) {
        items = items.slice(0, MAX_LINES);
        notes.push(`Only the first ${MAX_LINES} different items were kept.`);
    }

    if (items.length === 0) issues.push("No available items to order.");

    const check = orderability(store, deliveryType, now);
    if (!check.ok && check.reason) issues.push(check.reason);

    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const nightCharge = store.nightDeliveryCharge ?? 10;
    const deliveryCharge = deliveryType === "night_delivery" && store.nightDelivery ? nightCharge : 0;

    return {
        storeId: idOf(store._id),
        storeName: store.name,
        items,
        subtotal,
        deliveryType,
        deliveryCharge,
        total: subtotal + deliveryCharge,
        nightDeliveryAvailable: !!store.nightDelivery,
        nightDeliveryCharge: nightCharge,
        issues,
        notes,
        canPlace: issues.length === 0 && items.length > 0,
        createdAt: now.toISOString(),
    };
}

// ─── Quick-reply chips shown under the bot's answer ──────────────────────────
export function suggestionsFor(blockTypes: Set<string>, usedTools: Set<string>): string[] {
    if (blockTypes.has("order_draft")) return [];
    if (usedTools.has("get_my_favorites")) {
        return ["Reorder my last order", "Suggest something new under ₹100", "What's open now?"];
    }
    if (blockTypes.has("orders")) {
        return ["Order my usual again", "What's open now?", "Best under ₹100"];
    }
    if (blockTypes.has("stores")) {
        return ["Best under ₹100", "Which stores deliver at night?", "Show my favourites"];
    }
    if (blockTypes.has("menu_items")) {
        return ["Only veg options", "What's the cheapest?", "Show my favourites"];
    }
    return ["What's open now?", "Best under ₹100", "Show my favourites", "Track my latest order"];
}
