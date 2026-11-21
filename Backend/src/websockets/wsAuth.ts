import jwt from "jsonwebtoken";

/**
 * Works out which "room" a WebSocket may listen to, from its login token.
 * Students listen to their own user id. Owners listen to their store id.
 * Anything the client claims about who it is gets ignored: only the signed token counts.
 */
export function roomFromToken(token: unknown, secret: string | undefined): string | null {
    if (typeof token !== "string" || !token || !secret) return null;
    try {
        const decoded = jwt.verify(token, secret) as Record<string, unknown>;
        if (decoded.ownerId) {
            // Owner token: the store's new-order events
            return typeof decoded.storeId === "string" && decoded.storeId ? decoded.storeId : null;
        }
        return typeof decoded.userId === "string" && decoded.userId ? decoded.userId : null;
    } catch {
        return null;
    }
}

export const WS_AUTH_FAILED_CODE = 4401;
export const WS_REGISTER_DEADLINE_MS = 10_000;
