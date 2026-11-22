// Pure helpers for "order again" and "your favourites". No database access here.
import { clampInt, idOf, MAX_QTY_PER_ITEM, orderability, type MenuDocLike, type Portion, type StoreLike } from "./bitebotHelpers";

export interface PastOrderItem {
    menuItemId?: any;
    name: string;
    quantity: number;
    price: number;
    portionSize?: string;
}

export interface ReorderLine {
    menuItemId: string;
    name: string;
    quantity: number;
    portionSize: Portion;
    /** Today's price for this portion. */
    price: number;
    /** What the student paid last time. */
    previousPrice: number;
    isVeg: boolean;
}

export interface ReorderPlan {
    storeId: string;
    storeName: string;
    /** False when the canteen is closed or paused. The lines are still listed. */
    canOrder: boolean;
    closedReason?: string;
    lines: ReorderLine[];
    /** Names of items that are sold out or no longer on the menu. */
    unavailable: string[];
    notes: string[];
    priceChanged: boolean;
}

/** Works out what can be ordered again from a past order, using the live menu and canteen status. */
export function planReorder(
    pastItems: PastOrderItem[],
    menuDocs: MenuDocLike[],
    store: StoreLike | undefined,
    storeIdFallback: string,
    now: Date = new Date(),
): ReorderPlan {
    const byId = new Map(menuDocs.map((d) => [idOf(d._id), d]));
    const lines: ReorderLine[] = [];
    const unavailable: string[] = [];
    const notes: string[] = [];

    for (const item of pastItems) {
        const doc = byId.get(idOf(item.menuItemId));
        if (!doc || doc.isAvailable === false) {
            unavailable.push(item.name);
            continue;
        }
        let portion: Portion = item.portionSize === "half" ? "half" : "full";
        let price = doc.price;
        if (portion === "half") {
            if (doc.hasHalf && doc.halfPrice) {
                price = doc.halfPrice;
            } else {
                portion = "full";
                notes.push(`${doc.name} no longer has a half portion, so the full portion was added.`);
            }
        }
        lines.push({
            menuItemId: idOf(doc._id),
            name: doc.name,
            quantity: clampInt(item.quantity, 1, MAX_QTY_PER_ITEM, 1),
            portionSize: portion,
            price,
            previousPrice: item.price,
            isVeg: doc.isVeg !== false,
        });
    }

    const priceChanged = lines.some((l) => l.price !== l.previousPrice);

    if (!store) {
        return {
            storeId: storeIdFallback, storeName: "This canteen", canOrder: false,
            closedReason: "This canteen is no longer available.",
            lines: [], unavailable: pastItems.map((i) => i.name), notes, priceChanged: false,
        };
    }

    const check = orderability(store, "pickup", now);
    return {
        storeId: idOf(store._id),
        storeName: store.name,
        canOrder: check.ok && lines.length > 0,
        closedReason: check.ok ? undefined : check.reason,
        lines,
        unavailable,
        notes,
        priceChanged,
    };
}

export interface FavoriteItem {
    id: string;
    name: string;
    price: number;
    halfPrice: number | null;
    hasHalf: boolean;
    isVeg: boolean;
    storeId: string;
    storeName: string;
    timesOrdered: number;
    /** False when the canteen is closed or paused right now. */
    canOrder: boolean;
    closedReason?: string;
}

/** Joins the student's most-ordered items with live menu and canteen data. Sold-out items are dropped. */
export function buildFavorites(
    counts: { menuItemId: any; timesOrdered: number }[],
    menuDocs: MenuDocLike[],
    storeMap: Map<string, StoreLike>,
    limit: number,
    now: Date = new Date(),
): FavoriteItem[] {
    const byId = new Map(menuDocs.map((d) => [idOf(d._id), d]));
    const out: FavoriteItem[] = [];
    for (const c of counts) {
        const doc = byId.get(idOf(c.menuItemId));
        if (!doc || doc.isAvailable === false) continue;
        const store = storeMap.get(idOf(doc.storeId));
        if (!store || store.isActive === false) continue;
        const check = orderability(store, "pickup", now);
        out.push({
            id: idOf(doc._id),
            name: doc.name,
            price: doc.price,
            halfPrice: doc.hasHalf && doc.halfPrice ? doc.halfPrice : null,
            hasHalf: !!(doc.hasHalf && doc.halfPrice),
            isVeg: doc.isVeg !== false,
            storeId: idOf(store._id),
            storeName: store.name,
            timesOrdered: c.timesOrdered,
            canOrder: check.ok,
            closedReason: check.ok ? undefined : check.reason,
        });
    }
    out.sort((a, b) => b.timesOrdered - a.timesOrdered);
    return out.slice(0, limit);
}
