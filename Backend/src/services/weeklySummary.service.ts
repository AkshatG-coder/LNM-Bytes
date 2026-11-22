import mongoose from "mongoose";
import { OwnerModel } from "../Models/Owner.model";
import { OrderModel } from "../Models/Order_Schema.model";
import { MenuItemModel } from "../Models/Menu_Item.model";
import { Store } from "../Models/Store.model";
import { buildInsights } from "../utils/insightsHelpers";
import { buildSummaryEmail, isSummaryDue, lastScheduledSend, reportWindow } from "../utils/weeklySummary";
import { isEmailConfigured, sendSummaryEmail } from "./email.service";
import logger from "../utils/logger";

/** Builds last week's email for one canteen. Covers the 7 whole days before today (IST). */
export async function composeSummary(storeId: unknown, ownerName: string | undefined, now: Date = new Date()) {
    const sid = new mongoose.Types.ObjectId(String(storeId));
    const win = reportWindow(now);
    const [orders, menu, store] = await Promise.all([
        OrderModel.find({ storeId: sid, createdAt: { $gte: win.fetchFrom, $lt: win.end } })
            .select("status createdAt totalAmount paymentType userId userName qrVerifiedAt rating rejectionReason items.menuItemId items.name items.quantity items.price")
            .limit(100000)
            .lean(),
        MenuItemModel.find({ storeId: sid }).select("name category isAvailable rating ratingCount").lean(),
        Store.findById(sid).select("name").lean(),
    ]);
    const insights = buildInsights(
        orders as any[],
        (menu as any[]).map((m) => ({
            id: String(m._id),
            name: m.name,
            category: m.category || "other",
            isAvailable: m.isAvailable !== false,
            rating: m.rating ?? 0,
            ratingCount: m.ratingCount ?? 0,
        })),
        7,
        win.asOf,
    );
    return buildSummaryEmail(insights, (store as any)?.name || "Your canteen", ownerName);
}

/** Sends the summary to one owner right now. Does not touch the weekly schedule. */
export async function sendSummaryNow(owner: { email: string; name?: string; storeId: unknown }): Promise<void> {
    const mail = await composeSummary(owner.storeId, owner.name);
    await sendSummaryEmail(owner.email, mail);
}

/**
 * Sends the weekly email to every owner who is owed one. Safe to call often and from more than one
 * place: each owner is claimed with an atomic update before sending, so nobody gets it twice.
 */
export async function runDueSummaries(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
    const result = { sent: 0, failed: 0 };
    if (!isEmailConfigured()) return result;

    const scheduled = lastScheduledSend(now);
    const candidates: any[] = await OwnerModel.find({
        role: "owner",
        isApproved: true,
        "weeklySummary.enabled": true,
    })
        .select("name email storeId weeklySummary")
        .lean();

    for (const owner of candidates) {
        const ws = owner.weeklySummary ?? {};
        if (!isSummaryDue(true, ws.enabledAt, ws.lastSentAt, now)) continue;

        // Claim this owner. If another run got there first, nothing is modified.
        const claim = await OwnerModel.updateOne(
            {
                _id: owner._id,
                "weeklySummary.enabled": true,
                $or: [{ "weeklySummary.lastSentAt": null }, { "weeklySummary.lastSentAt": { $lt: scheduled } }],
            },
            { $set: { "weeklySummary.lastSentAt": now } },
        );
        if (claim.modifiedCount !== 1) continue;

        try {
            await sendSummaryNow(owner);
            result.sent += 1;
        } catch (e) {
            result.failed += 1;
            logger.error({ err: e, ownerId: String(owner._id) }, "Weekly summary failed");
            // Give the claim back so the next run retries
            await OwnerModel.updateOne({ _id: owner._id }, { $set: { "weeklySummary.lastSentAt": ws.lastSentAt ?? null } });
        }
    }
    if (result.sent || result.failed) logger.info(result, "Weekly summaries done");
    return result;
}

const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Checks twice an hour whether any summary is due. This only runs while the server is awake, so on a
 * host that sleeps it can also be triggered from outside (POST /summary/run with the cron secret).
 */
export function startWeeklySummaryJob(): void {
    const tick = () => {
        runDueSummaries().catch((e) => logger.error({ err: e }, "Weekly summary check failed"));
    };
    setTimeout(tick, 60_000).unref();
    setInterval(tick, CHECK_EVERY_MS).unref();
}
