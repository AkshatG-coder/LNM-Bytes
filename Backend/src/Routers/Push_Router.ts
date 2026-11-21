import { Router } from "express";
import { verifyUserToken } from "../middleware/verifyToken";
import { PushSubscriptionModel } from "../Models/PushSubscription.model";
import { getVapidPublicKey } from "../utils/pushService";
import { parseSubscriptionBody } from "../utils/pushHelpers";
import asyncHandler from "../utils/AsyncHandler";
import mongoose from "mongoose";

const Push_Router = Router();
const MAX_SUBSCRIPTIONS_PER_USER = 5;

// The browser needs the public key to subscribe. Null means push is not set up on the server.
Push_Router.get("/public-key", (_req, res) => {
    res.json({ success: true, data: { publicKey: getVapidPublicKey() } });
});

Push_Router.post("/subscribe", verifyUserToken, asyncHandler(async (req, res) => {
    const parsed = parseSubscriptionBody(req.body);
    if (!parsed.ok) return res.status(400).json({ success: false, message: parsed.error });

    const userId = new mongoose.Types.ObjectId(String((req as any).user.userId));
    const { endpoint, keys } = parsed.subscription;

    // Same browser signing in as a different student moves the subscription to that student
    await PushSubscriptionModel.findOneAndUpdate(
        { endpoint },
        { userId, keys, userAgent: String(req.headers["user-agent"] || "").slice(0, 300) },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Keep only the newest few per student
    const all = await PushSubscriptionModel.find({ userId }).sort({ updatedAt: -1 }).select("_id").lean();
    if (all.length > MAX_SUBSCRIPTIONS_PER_USER) {
        await PushSubscriptionModel.deleteMany({ _id: { $in: all.slice(MAX_SUBSCRIPTIONS_PER_USER).map((s) => s._id) } });
    }

    return res.json({ success: true, message: "Order alerts are on" });
}));

Push_Router.post("/unsubscribe", verifyUserToken, asyncHandler(async (req, res) => {
    const endpoint = typeof req.body?.endpoint === "string" ? req.body.endpoint.slice(0, 1000) : "";
    if (!endpoint) return res.status(400).json({ success: false, message: "endpoint is required" });

    await PushSubscriptionModel.deleteOne({ endpoint, userId: new mongoose.Types.ObjectId(String((req as any).user.userId)) });
    return res.json({ success: true, message: "Order alerts are off" });
}));

export { Push_Router };
