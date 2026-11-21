import webpush from "web-push";
import mongoose from "mongoose";
import logger from "./logger";
import { PushSubscriptionModel } from "../Models/PushSubscription.model";
import { buildOrderPush } from "./pushHelpers";
import type { PushMessage } from "./pushHelpers";

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
// Push services need a contact: a mailto: address or an https URL.
const SUBJECT = process.env.VAPID_SUBJECT || "https://www.lnmbytes.me";

let configured = false;

/** True when both VAPID keys are set. Without them, push is simply switched off. */
export function isPushEnabled(): boolean {
    if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
    if (!configured) {
        try {
            webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
            configured = true;
        } catch (err: any) {
            logger.error({ err: err.message }, "Invalid VAPID keys, push is disabled");
            return false;
        }
    }
    return true;
}

export const getVapidPublicKey = () => (isPushEnabled() ? PUBLIC_KEY : null);

/** Sends one message to every browser the student subscribed. Never throws. */
export async function sendPushToUser(userId: string, message: PushMessage): Promise<void> {
    try {
        if (!isPushEnabled() || !mongoose.Types.ObjectId.isValid(userId)) return;

        const subs = await PushSubscriptionModel.find({ userId: new mongoose.Types.ObjectId(userId) }).limit(10).lean();
        if (subs.length === 0) return;

        const body = JSON.stringify(message);
        await Promise.allSettled(
            subs.map(async (s) => {
                if (!s.keys?.p256dh || !s.keys?.auth) return;
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
                        body,
                        { TTL: 30 * 60, urgency: message.urgent ? "high" : "normal", timeout: 8000 },
                    );
                } catch (err: any) {
                    // 404 / 410 mean the browser removed the subscription for good
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await PushSubscriptionModel.deleteOne({ _id: s._id });
                    } else {
                        logger.warn({ status: err?.statusCode, msg: err?.message }, "Push send failed");
                    }
                }
            }),
        );
    } catch (err: any) {
        logger.warn({ err: err?.message }, "Push dispatch failed");
    }
}

/** Called for every order event: pushes only the ones a student should be pinged about. */
export function pushOrderEvent(receiverId: string, payload: unknown): void {
    const message = buildOrderPush(payload);
    if (message) void sendPushToUser(receiverId, message);
}
