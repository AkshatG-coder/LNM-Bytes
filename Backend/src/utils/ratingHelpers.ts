// Helpers for rating an order after pickup. No database or network access.

export type ParsedStars = { ok: true; stars: number } | { ok: false; error: string };

/** Accepts a whole number from 1 to 5, as a number or a numeric string. */
export function parseStars(body: unknown): ParsedStars {
    const raw = body && typeof body === "object" ? (body as { stars?: unknown }).stars : undefined;
    const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 5) {
        return { ok: false, error: "Rating must be a whole number from 1 to 5" };
    }
    return { ok: true, stars: n };
}

/** The new average after one more rating, rounded to 2 decimals. Used by tests and mirrors the database update. */
export function nextAverage(average: number, count: number, stars: number): number {
    const total = (average || 0) * (count || 0) + stars;
    return Math.round((total / ((count || 0) + 1)) * 100) / 100;
}

/**
 * Aggregation-pipeline update that adds one rating to a menu item atomically,
 * so two students rating at the same moment cannot overwrite each other.
 * Items created before ratings existed have no count, so a missing count is read as 0.
 */
export function addRatingPipeline(stars: number) {
    const count = { $ifNull: ["$ratingCount", 0] };
    const average = { $ifNull: ["$rating", 0] };
    return [
        {
            $set: {
                rating: {
                    $round: [
                        { $divide: [{ $add: [{ $multiply: [average, count] }, stars] }, { $add: [count, 1] }] },
                        2,
                    ],
                },
                ratingCount: { $add: [count, 1] },
            },
        },
    ];
}
