import crypto from "crypto";
import asyncHandler from "../utils/AsyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { OwnerModel } from "../Models/Owner.model";
import { isEmailConfigured } from "../services/email.service";
import { runDueSummaries, sendSummaryNow } from "../services/weeklySummary.service";
import { lastScheduledSend } from "../utils/weeklySummary";
import logger from "../utils/logger";

const fail = (res: any, status: number, message: string) =>
    res.status(status).json(new ApiResponse(status, false, message, null));

const TEST_COOLDOWN_MS = 60_000;
const lastTest = new Map<string, number>();

async function currentOwner(req: any) {
    const id = req.owner?.ownerId;
    return id ? OwnerModel.findById(id).select("name email storeId weeklySummary").lean() : null;
}

const settingsPayload = (owner: any) => ({
    enabled: !!owner.weeklySummary?.enabled,
    lastSentAt: owner.weeklySummary?.lastSentAt ?? null,
    email: owner.email,
    emailConfigured: isEmailConfigured(),
});

// GET /summary/settings
export const GetSummarySettings = asyncHandler(async (req, res) => {
    const owner: any = await currentOwner(req);
    if (!owner) return fail(res, 404, "Owner not found");
    return res.json(new ApiResponse(200, true, "Settings", settingsPayload(owner)));
});

// PUT /summary/settings { enabled }
export const SaveSummarySettings = asyncHandler(async (req, res) => {
    if (typeof req.body?.enabled !== "boolean") return fail(res, 400, "enabled must be true or false");
    const owner: any = await currentOwner(req);
    if (!owner) return fail(res, 404, "Owner not found");

    const enabled: boolean = req.body.enabled;
    if (enabled && !isEmailConfigured()) {
        return fail(res, 503, "Email is not set up on the server yet, so the summary cannot be sent.");
    }
    const was = !!owner.weeklySummary?.enabled;
    const set: Record<string, unknown> = { "weeklySummary.enabled": enabled };
    // The first email is for the next full Monday, never for a week that ended before they opted in
    if (enabled && !was) set["weeklySummary.enabledAt"] = new Date();
    await OwnerModel.updateOne({ _id: (owner as any)._id }, { $set: set });

    owner.weeklySummary = { ...(owner.weeklySummary ?? {}), enabled };
    return res.json(new ApiResponse(200, true, enabled ? "Weekly email is on" : "Weekly email is off", settingsPayload(owner)));
});

// POST /summary/send-now — emails last week's summary to the owner as a preview
export const SendSummaryNow = asyncHandler(async (req, res) => {
    if (!isEmailConfigured()) return fail(res, 503, "Email is not set up on the server yet.");
    const owner: any = await currentOwner(req);
    if (!owner) return fail(res, 404, "Owner not found");

    const key = String(owner._id);
    const wait = (lastTest.get(key) ?? 0) + TEST_COOLDOWN_MS - Date.now();
    if (wait > 0) return fail(res, 429, `Please wait ${Math.ceil(wait / 1000)} seconds before sending another.`);
    lastTest.set(key, Date.now());

    try {
        await sendSummaryNow(owner);
    } catch (e) {
        lastTest.delete(key);
        logger.error({ err: e }, "Summary test email failed");
        return fail(res, 502, "The email could not be sent. Check the SMTP settings on the server.");
    }
    return res.json(new ApiResponse(200, true, `Sent to ${owner.email}`, { email: owner.email }));
});

// POST /summary/run — for an outside scheduler (cron-job.org, Render cron). Needs the shared secret.
export const RunDueSummaries = asyncHandler(async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const given = String(req.headers["x-cron-secret"] ?? "");
    const a = Buffer.from(given);
    const b = Buffer.from(secret ?? "");
    if (!secret || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return fail(res, 401, "Not allowed");
    }
    const result = await runDueSummaries();
    return res.json(new ApiResponse(200, true, "Done", { ...result, scheduledFor: lastScheduledSend().toISOString() }));
});
