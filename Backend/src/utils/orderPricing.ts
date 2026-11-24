// Server-side pricing: the client's prices and total are never trusted.

export interface PricingMenuItem {
    _id: any;
    name: string;
    price: number;
    hasHalf?: boolean;
    halfPrice?: number | null;
    isAvailable?: boolean;
    storeId: any;
}

export interface RequestedItem {
    menuItemId?: unknown;
    quantity?: unknown;
    portionSize?: unknown;
}

export type PricingResult =
    | { ok: true; items: { menuItemId: any; name: string; quantity: number; price: number; portionSize: "full" | "half" }[]; subtotal: number; deliveryCharge: number; total: number }
    | { ok: false; message: string };

const round2 = (n: number) => Math.round(n * 100) / 100;
export const MAX_QTY_PER_ITEM = 20;
export const MAX_LINES = 40;

export function priceOrder(
    requested: RequestedItem[],
    menu: PricingMenuItem[],
    storeId: string,
    night: { isNight: boolean; charge: number },
): PricingResult {
    if (!Array.isArray(requested) || requested.length === 0) return { ok: false, message: "Your cart is empty" };
    if (requested.length > MAX_LINES) return { ok: false, message: "Too many items in one order" };

    const byId = new Map(menu.map(m => [String(m._id), m]));
    const items: { menuItemId: any; name: string; quantity: number; price: number; portionSize: "full" | "half" }[] = [];
    let subtotal = 0;

    for (const r of requested) {
        const m = byId.get(String(r.menuItemId));
        if (!m || String(m.storeId) !== String(storeId)) return { ok: false, message: "An item in your cart is no longer on this canteen's menu" };
        if (m.isAvailable === false) return { ok: false, message: `${m.name} is not available right now` };

        const qty = Number(r.quantity);
        if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) return { ok: false, message: `Invalid quantity for ${m.name}` };

        const portion: "full" | "half" = r.portionSize === "half" ? "half" : "full";
        let price = m.price;
        if (portion === "half") {
            if (!m.hasHalf || m.halfPrice == null) return { ok: false, message: `${m.name} has no half portion` };
            price = m.halfPrice;
        }
        subtotal += price * qty;
        items.push({ menuItemId: m._id, name: m.name, quantity: qty, price, portionSize: portion });
    }

    const deliveryCharge = night.isNight ? Math.max(0, Number(night.charge) || 0) : 0;
    return { ok: true, items, subtotal: round2(subtotal), deliveryCharge, total: round2(subtotal + deliveryCharge) };
}
