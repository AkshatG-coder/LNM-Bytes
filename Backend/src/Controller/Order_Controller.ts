import { OrderModel } from "../Models/Order_Schema.model";
import { CounterModel } from "../Models/Counter.model";
import { UserModel } from "../Models/User.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import mongoose from "mongoose";
import producer from "../kafka/producer";
import { TOPICS, OrderEvent, NotificationEvent } from "../kafka/topics";
import QRCode from "qrcode";
import crypto from "crypto";
import logger from "../utils/logger";
import { Store } from "../Models/Store.model";
import { parseRejectReason, rejectionMessage } from "../utils/rejectReasons";
import { pushOrderEvent } from "../utils/pushService";
import { parseStars, addRatingPipeline } from "../utils/ratingHelpers";
import { MenuItemModel } from "../Models/Menu_Item.model";
import appCache from "../utils/cache";
import { buildDemandHints, DEMAND_WINDOW_DAYS } from "../utils/demandHelpers";
import { buildInsights, INSIGHT_RANGES } from "../utils/insightsHelpers";
import { startOfIstDay, NOT_SALES_STATUSES } from "../utils/copilotHelpers";
import { planReorder, buildFavorites } from "../utils/reorderHelpers";
import { priceOrder } from "../utils/orderPricing";
import { buildRush, HISTORY_DAYS } from "../utils/rushHelpers";
import { buildWrapped, periodFor } from "../utils/wrappedHelpers";
import { toPaise, verifyCheckoutSignature, verifyWebhookSignature, judgePayment, pickSettlingPayment } from "../utils/razorpayHelpers";
import {
    isRazorpayConfigured, razorpayKeyId, razorpayKeySecret, createRazorpayOrder,
    fetchRazorpayPayment, fetchOrderPayments, captureRazorpayPayment, refundRazorpayPayment,
} from "../services/razorpay.service";


const fail = (res: any, code: number, msg: string) =>
    res.status(code).json({ success: false, message: msg });

// Publish an order lifecycle event + push a WebSocket notification via Kafka
const emitOrderEvent = (
    type: OrderEvent["type"],
    order: any,
    wsReceiverId: string,
    wsPayload: Record<string, unknown>
) => {
    const orderEvent: OrderEvent = {
        type,
        orderId:     order._id.toString(),
        storeId:     order.storeId.toString(),
        userId:      order.userId.toString(),
        orderNumber: order.orderNumber,
        paymentType: order.paymentType,
        userName:    order.userName,
        totalAmount: order.totalAmount,
        timestamp:   new Date().toISOString(),
    };
    // Fire-and-forget — these are non-blocking and won't slow down the HTTP response
    producer.publish(TOPICS.ORDER_EVENTS, orderEvent);
    producer.publish(TOPICS.NOTIFICATION_EVENTS, {
        type: "PUSH_WEBSOCKET",
        receiverId: wsReceiverId,
        payload: wsPayload,
    } satisfies NotificationEvent);

    // Phone / browser notification for the student ("ready", "declined"). Sent here, once per event,
    // so it works the same whether Kafka is on or the in-memory fallback is used.
    pushOrderEvent(wsReceiverId, wsPayload);
};

// ─── Create Order ─────────────────────────────────────────────────────────────
const CreateOrder = asyncHandler(async (req, res) => {
    const { userId, storeId, items, paymentType, orderNote, deliveryType } = req.body;

    if (!userId || !storeId || !Array.isArray(items) || items.length === 0 || !paymentType)
        return fail(res, 400, "All fields are required");

    // A student can only order for themselves
    const tokenUser = (req as any).user;
    if (!tokenUser || String(userId) !== String(tokenUser.userId))
        return fail(res, 403, "Unauthorized: You can only place orders for your own account.");

    // Validate ObjectIds before hitting Mongoose (prevents CastError 500)
    if (!mongoose.Types.ObjectId.isValid(userId))
        return fail(res, 400, "Invalid userId format");
    if (!mongoose.Types.ObjectId.isValid(storeId))
        return fail(res, 400, "Invalid storeId format");

    // Run user lookup, store lookup, and atomic counter increment in parallel
    const [user, store, counterDoc] = await Promise.all([
        UserModel.findById(userId).lean(),
        Store.findById(storeId).lean(),
        // Atomic counter — safe under any level of concurrent requests
        CounterModel.findOneAndUpdate(
            { _id: "orderNumber" },
            { $inc: { seq: 1 } },
            { upsert: true, new: true }
        ),
    ]);

    if (!user) return fail(res, 404, "User not found");
    if (!store) return fail(res, 404, "Store not found");
    if (paymentType !== "cash" && paymentType !== "online") return fail(res, 400, "Invalid payment type");

    if (store.status !== "open" || !store.isActive) {
        return fail(res, 400, "Sorry, this store is currently closed manually by the owner.");
    }

    if (!(store as any).isOnlineOrderAvailable) {
        return fail(res, 400, "App ordering is currently paused by this canteen. Please try again later or visit the counter.");
    }

    if (deliveryType === "night_delivery" && !(store as any).nightDelivery) {
        return fail(res, 400, "This store does not offer night delivery.");
    }

    // Validate Real Time based on Store operating hours (IST)
    const operationTime = (store as any).operationTime;
    // Bypass operating hours check ONLY for Night Delivery orders if the store supports it
    const isNightDeliveryOrder = deliveryType === "night_delivery";

    if (!isNightDeliveryOrder && operationTime && operationTime.openTime && operationTime.closeTime) {
        // Get current time in IST (HH:MM format)
        const nowIST = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata", hour12: false, hour: '2-digit', minute: '2-digit' });
        const { openTime, closeTime } = operationTime;

        let isDuringHours = false;
        if (closeTime < openTime) {
            // Store stays open past midnight (e.g., open 20:00, close 02:00)
            isDuringHours = nowIST >= openTime || nowIST <= closeTime;
        } else {
            // Normal operating hours (e.g., open 08:00, close 22:00)
            isDuringHours = nowIST >= openTime && nowIST <= closeTime;
        }

        if (!isDuringHours) {
            return fail(res, 400, `This store operates outside current hours (${openTime} to ${closeTime}). Please order when open!`);
        }
    }

    // Price everything on the server from the menu; the client total is only a stale-price check
    const menu = await MenuItemModel.find({ _id: { $in: items.map((i: any) => i?.menuItemId).filter((id: any) => mongoose.Types.ObjectId.isValid(String(id))) } }).lean();
    const priced = priceOrder(items, menu as any, String(storeId), { isNight: isNightDeliveryOrder, charge: (store as any).nightDeliveryCharge ?? 10 });
    if (!priced.ok) return fail(res, 400, priced.message);
    const totalAmount = priced.total;
    if (typeof req.body.totalAmount === "number" && Math.abs(req.body.totalAmount - totalAmount) > 0.01) {
        return fail(res, 409, "Prices have changed since you added these items. Please refresh your cart and try again.");
    }

    // If an earlier online payment of this student went through but was never confirmed (tab closed,
    // network drop), settle it now instead of letting them pay twice for the same food.
    if (paymentType === "online" && isRazorpayConfigured()) {
        try {
            const stale = await OrderModel.find({
                userId, status: "payment_pending", razorpayOrderId: { $ne: null },
                createdAt: { $gte: new Date(Date.now() - 6 * 60 * 60 * 1000) },
            }).sort({ createdAt: -1 }).limit(3);
            for (const prev of stale) {
                const done = await confirmWithRazorpay(prev, undefined).catch(() => null);
                if (done && done.ok) {
                    await settlePaidOrder(prev, done.paymentId);
                    return fail(res, 409, `Your earlier payment for order #${(prev as any).orderNumber} went through. Check My Orders instead of paying again.`);
                }
            }
        } catch (e: any) {
            logger.warn({ err: e?.message }, "Stale payment check failed; continuing");
        }
    }

    const nextOrderNumber = (counterDoc?.seq ?? 0) + 1000; // orders start at 1001

    const initialStatus = paymentType === "online" ? "payment_pending" : "pending";
    const newOrder = await OrderModel.create({
        orderNumber: nextOrderNumber,
        userId,
        userName:  user.name,
        userEmail: user.email,
        userPhone: (user as any).phone || null,
        storeId,
        items: priced.items,
        totalAmount,
        paymentType,
        paymentStatus: "pending",
        orderNote: orderNote || "",
        deliveryType: deliveryType || "pickup",
        status: initialStatus,
    });

    if (paymentType === "online") {
        if (!isRazorpayConfigured()) {
            logger.error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
            return fail(res, 503, "Online payments are not set up yet. Please pay at the counter.");
        }
        if (toPaise(totalAmount) < 100) return fail(res, 400, "Online payment needs an order of at least ₹1");

        try {
            const rzpOrder = await createRazorpayOrder(totalAmount, `ord_${nextOrderNumber}`, {
                orderId: newOrder._id.toString(),
                orderNumber: String(nextOrderNumber),
                storeId: storeId.toString(),
            });

            newOrder.razorpayOrderId = rzpOrder.id;
            await newOrder.save();
            logger.info({ razorpayOrderId: rzpOrder.id, orderId: newOrder._id }, "Razorpay order created");

            // The order only goes to the canteen after payment is confirmed (verify-payment or webhook)
            return res.status(201).json(new ApiResponse(201, true, "Order created. Pending payment", {
                ...newOrder.toJSON(),
                razorpay: {
                    keyId: razorpayKeyId(),
                    orderId: rzpOrder.id,
                    amount: rzpOrder.amount,
                    currency: rzpOrder.currency,
                    storeName: (store as any).name,
                    prefill: { name: user.name, email: user.email, contact: (user as any).phone ? String((user as any).phone).replace(/\D/g, "").slice(-10) : "" },
                },
            }));
        } catch (error: any) {
            const rzpErr = error.response?.data?.error;
            logger.error({ rzpErr, status: error.response?.status, message: error.message }, "Razorpay order creation failed");
            // Keep the order in payment_pending so the student can try again
            return fail(res, 502, `Payment gateway error: ${rzpErr?.description || error.message || "Unknown error"}`);
        }
    }

    // Cash order — publish event to Kafka instead of direct WebSocket
    emitOrderEvent("ORDER_CREATED", newOrder, storeId.toString(), {
        type: "newOrder",
        orderId: newOrder._id,
        orderNumber: (newOrder as any).orderNumber,
        message: `New order #${(newOrder as any).orderNumber} from ${user.name}${paymentType === 'online' ? ' (PAID ONLINE)' : ''}!`,
        paymentType,
    });

    return res.status(201).json(new ApiResponse(201, true, "Order created successfully", newOrder));
});

// ─── Payment confirmation ─────────────────────────────────────────────────────
// Three paths end here: the checkout callback (signature), a status lookup (student returns to
// /orders), and the Razorpay webhook (student closed the tab after paying). All are idempotent.
async function settlePaidOrder(order: any, paymentId: string) {
    // Atomic: when the checkout callback and the webhook arrive together, only one of them wins,
    // so the canteen gets a single "new order" alert.
    const won = await OrderModel.findOneAndUpdate(
        { _id: order._id, paymentStatus: { $ne: "paid" }, status: "payment_pending" },
        { $set: { status: "pending", paymentStatus: "paid", razorpayPaymentId: paymentId } },
        { new: true },
    );
    if (!won) return false;
    order.status = won.status;
    order.paymentStatus = won.paymentStatus;
    order.razorpayPaymentId = won.razorpayPaymentId;

    emitOrderEvent("ORDER_CREATED", won, won.storeId.toString(), {
        type: "newOrder",
        orderId: won._id,
        orderNumber: (won as any).orderNumber,
        message: `New order #${(won as any).orderNumber} from ${won.userName}${won.paymentType === 'online' ? ' (PAID ONLINE)' : ''}!`,
        paymentType: won.paymentType,
    });
    return true;
}

/** Looks the payment up at Razorpay, captures it if needed, and checks order id and amount. */
async function confirmWithRazorpay(order: any, paymentId?: string): Promise<{ ok: true; paymentId: string } | { ok: false; reason: string }> {
    const rzpOrderId = order.razorpayOrderId as string;
    const expected = toPaise(order.totalAmount);

    let settling: { payment: { id: string; amount: number }; verdict: "captured" | "needs_capture" } | null = null;
    if (paymentId) {
        const p = await fetchRazorpayPayment(paymentId);
        const v = judgePayment(p, expected, rzpOrderId);
        if (v === "captured" || v === "needs_capture") settling = { payment: p, verdict: v };
        else return { ok: false, reason: v === "mismatch" ? "Payment does not match this order" : `Payment is ${p.status}` };
    } else {
        settling = pickSettlingPayment(await fetchOrderPayments(rzpOrderId), expected, rzpOrderId);
        if (!settling) return { ok: false, reason: "Payment is still pending" };
    }
    if (settling.verdict === "needs_capture") await captureRazorpayPayment(settling.payment.id, expected);
    return { ok: true, paymentId: settling.payment.id };
}

const VerifyPayment = asyncHandler(async (req, res) => {
    const orderId = String(req.params.orderId);
    if (!mongoose.Types.ObjectId.isValid(orderId)) return fail(res, 400, "Invalid order id");

    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");

    const user = (req as any).user;
    if (user && String(order.userId) !== String(user.userId)) return fail(res, 403, "Unauthorized: This order belongs to someone else.");

    if (order.paymentStatus === "paid") {
        return res.json(new ApiResponse(200, true, "Payment already verified", order));
    }
    if (!order.razorpayOrderId) return fail(res, 400, "This order has no online payment to verify");
    if (!isRazorpayConfigured()) return fail(res, 503, "Online payments are not set up");

    const { razorpay_payment_id, razorpay_signature } = req.body || {};

    try {
        let paymentId: string | undefined;
        if (razorpay_payment_id || razorpay_signature) {
            // Coming straight from Razorpay Checkout: the signature proves the payment belongs to this order
            if (!verifyCheckoutSignature(order.razorpayOrderId, String(razorpay_payment_id || ""), String(razorpay_signature || ""), razorpayKeySecret())) {
                logger.warn({ orderId }, "Razorpay signature check failed");
                return fail(res, 400, "Payment signature is not valid");
            }
            paymentId = String(razorpay_payment_id);
        }

        const confirmed = await confirmWithRazorpay(order, paymentId);
        if (!confirmed.ok) return fail(res, 400, confirmed.reason);

        await settlePaidOrder(order, confirmed.paymentId);
        return res.json(new ApiResponse(200, true, "Payment completed successfully", order));
    } catch (err: any) {
        logger.error({ err: err.response?.data || err.message, orderId }, "Razorpay verification error");
        return fail(res, 500, "Error verifying payment with Razorpay");
    }
});

// ─── Razorpay webhook (needs the raw body, see app.ts) ────────────────────────
// Dashboard setup: Settings > Webhooks, URL https://<backend>/order/razorpay-webhook,
// events payment.captured and order.paid, secret = RAZORPAY_WEBHOOK_SECRET.
const RazorpayWebhook = asyncHandler(async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const raw: Buffer | undefined = (req as any).rawBody;
    const signature = String(req.headers["x-razorpay-signature"] || "");
    if (!secret || !raw || !verifyWebhookSignature(raw, signature, secret)) {
        return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = req.body?.event as string | undefined;
    const payment = req.body?.payload?.payment?.entity;
    const rzpOrderId: string | undefined = payment?.order_id || req.body?.payload?.order?.entity?.id;

    if ((event === "payment.captured" || event === "order.paid") && rzpOrderId) {
        const order = await OrderModel.findOne({ razorpayOrderId: rzpOrderId });
        if (order && order.paymentStatus !== "paid") {
            try {
                const confirmed = await confirmWithRazorpay(order, payment?.id);
                if (confirmed.ok) await settlePaidOrder(order, confirmed.paymentId);
            } catch (err: any) {
                logger.error({ err: err.response?.data || err.message, rzpOrderId }, "Webhook confirmation failed");
                return res.status(500).json({ success: false }); // Razorpay retries on non-2xx
            }
        }
    }
    return res.json({ success: true });
});

// ─── Rush Radar: how busy a canteen is now, and when it usually gets quiet ────
const RUSH_LIVE_SECONDS = 20;
const RUSH_HISTORY_SECONDS = 30 * 60;
const QUEUE_STATUSES = ["pending", "accepted", "preparing"];

const GetRush = asyncHandler(async (req, res) => {
    const storeId = String(req.params.storeId);
    if (!mongoose.isValidObjectId(storeId)) return fail(res, 400, "Invalid store id");

    const sid = new mongoose.Types.ObjectId(storeId);
    const liveKey = `rush_live_${storeId}`;
    const histKey = `rush_hist_${storeId}`;

    let active = appCache.get<number>(liveKey);
    let history = appCache.get<{ date: string; hour: number; count: number }[]>(histKey);
    let hours = appCache.get<{ openTime?: string; closeTime?: string }>(`rush_hours_${storeId}`);

    const [freshActive, freshHistory, store] = await Promise.all([
        active === undefined
            ? OrderModel.countDocuments({
                storeId: sid,
                status: { $in: QUEUE_STATUSES },
                createdAt: { $gte: new Date(Date.now() - 3 * 60 * 60 * 1000) }, // an order stuck for hours is not a queue
            })
            : Promise.resolve(active),
        history === undefined
            ? OrderModel.aggregate([
                { $match: { storeId: sid, createdAt: { $gte: startOfIstDay(new Date(), HISTORY_DAYS) }, status: { $nin: NOT_SALES_STATUSES } } },
                { $group: {
                    _id: {
                        d: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
                        h: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } },
                    },
                    count: { $sum: 1 },
                } },
            ]).then((rows: any[]) => rows.map((r) => ({ date: r._id.d, hour: r._id.h, count: r.count })))
            : Promise.resolve(history),
        hours === undefined ? Store.findById(sid).select("operationTime").lean() : Promise.resolve(null),
    ]);

    active = freshActive;
    history = freshHistory;
    if (hours === undefined) {
        hours = { openTime: (store as any)?.operationTime?.openTime, closeTime: (store as any)?.operationTime?.closeTime };
        appCache.set(`rush_hours_${storeId}`, hours, RUSH_HISTORY_SECONDS);
    }
    appCache.set(liveKey, active, RUSH_LIVE_SECONDS);
    appCache.set(histKey, history, RUSH_HISTORY_SECONDS);

    return res.json(new ApiResponse(200, true, "Rush radar", buildRush({ activeOrders: active, history, ...hours })));
});

// ─── LNM Bytes Wrapped: a student's semester in food ──────────────────────────
const WRAPPED_COUNTS_SECONDS = 10 * 60;

const GetWrapped = asyncHandler(async (req, res) => {
    const userId = String((req as any).user?.userId || "");
    if (!mongoose.isValidObjectId(userId)) return fail(res, 401, "Please sign in");

    const period = periodFor(String(req.query.period || "semester"));
    const uid = new mongoose.Types.ObjectId(userId);
    const range = { $gte: period.from, $lt: period.to };

    const countsKey = `wrapped_counts_${period.id}_${period.from.getTime()}`;
    let allCounts = appCache.get<number[]>(countsKey);

    const [orders, counts] = await Promise.all([
        OrderModel.find({ userId: uid, createdAt: range, status: { $nin: NOT_SALES_STATUSES } })
            .select("storeId totalAmount createdAt deliveryType items.name items.quantity")
            .limit(5000)
            .lean(),
        allCounts === undefined
            ? OrderModel.aggregate([
                { $match: { createdAt: range, status: { $nin: NOT_SALES_STATUSES } } },
                { $group: { _id: "$userId", n: { $sum: 1 } } },
            ]).then((rows: any[]) => rows.map((r) => r.n as number))
            : Promise.resolve(allCounts),
    ]);
    allCounts = counts;
    appCache.set(countsKey, allCounts, WRAPPED_COUNTS_SECONDS);

    const wrapped = buildWrapped(orders as any[], period, allCounts);
    let topStoreName: string | null = null;
    if (wrapped.topStoreId && mongoose.isValidObjectId(wrapped.topStoreId)) {
        const st: any = await Store.findById(wrapped.topStoreId).select("name").lean();
        topStoreName = st?.name ?? null;
    }
    const user: any = await UserModel.findById(userId).select("name").lean();

    return res.json(new ApiResponse(200, true, "Wrapped", { ...wrapped, topStoreName, firstName: String(user?.name || "").split(" ")[0] || "there" }));
});

// ─── Get All Orders for a User ────────────────────────────────────────────────
const GetUserAll_Orders = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId) return fail(res, 400, "UserId is missing");

    const user = (req as any).user;
    if (user && userId !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot fetch orders of another user.");
    }

    // Covered by index: { userId: 1, createdAt: -1 }
    const order = await OrderModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
        {
            $lookup: {
                from: "stores",
                localField: "storeId",
                foreignField: "_id",
                as: "storeDetails"
            }
        },
        { $unwind: { path: "$storeDetails", preserveNullAndEmptyArrays: true } },
        { 
            $addFields: { 
                pendingPriority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] },
                storeName: { $ifNull: ["$storeDetails.name", "Unknown Store"] }
            } 
        },
        { $sort: { pendingPriority: 1, createdAt: -1 } },
        { $project: { pendingPriority: 0, storeDetails: 0 } },
    ]);
    return res.json(new ApiResponse(200, true, "User Orders fetched Successfully", order));
});

// ─── Get All Orders for a Store ───────────────────────────────────────────────
const GetOwnerAll_Orders = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const status = req.query.status as string | undefined;
    if (!storeId) return fail(res, 400, "storeId is missing");

    const owner = (req as any).owner;
    if (owner && owner.role === "owner" && String(storeId) !== String(owner.storeId)) {
        return fail(res, 403, "Unauthorized: Cannot access orders of another shop");
    }

    // Covered by index: { storeId: 1, status: 1, createdAt: -1 }
    const matchStage: any = { storeId: new mongoose.Types.ObjectId(String(storeId)) };
    // Unpaid online orders (payment_pending) are not real orders yet, so the canteen never sees them
    matchStage.status = status ? status : { $ne: "payment_pending" };
    if (status === "payment_pending") matchStage.status = { $ne: "payment_pending" };

    const orders = await OrderModel.aggregate([
        { $match: matchStage },
        { $addFields: { priority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
        { $sort: { priority: 1, createdAt: -1 } },
        { $project: { priority: 0 } },
    ]);
    return res.json(new ApiResponse(200, true, "Store Orders fetched Successfully", orders));
});

// ─── Get Single Order ─────────────────────────────────────────────────────────
const GetSingleOrder_Details = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    if (!order_id) return fail(res, 400, "OrderId is missing");
    const order = await OrderModel.findById(order_id).lean();
    if (!order) return fail(res, 404, "Order not found");

    const user = (req as any).user;
    if (user && String(order.userId) !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot access order of another user.");
    }

    return res.json(new ApiResponse(200, true, "Order Details Fetched Successfully", order));
});

// ─── Order again: re-checks a past order against today's menu and canteen status ──
const STORE_STATUS_FIELDS =
    "name location foodType operationTime nightDelivery nightDeliveryCharge isOnlineOrderAvailable status isActive";

const GetReorderPlan = asyncHandler(async (req, res) => {
    const orderId = String(req.params.orderId);
    if (!mongoose.Types.ObjectId.isValid(orderId)) return fail(res, 400, "Invalid order id");

    const order: any = await OrderModel.findById(orderId).select("userId storeId items").lean();
    if (!order) return fail(res, 404, "Order not found");

    const user = (req as any).user;
    if (!user || String(order.userId) !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot reorder another user's order.");
    }

    const ids = (order.items || []).map((i: any) => i.menuItemId).filter(Boolean);
    const [menuDocs, store] = await Promise.all([
        MenuItemModel.find({ _id: { $in: ids } })
            .select("name price hasHalf halfPrice isAvailable isVeg storeId")
            .lean(),
        Store.findById(order.storeId).select(STORE_STATUS_FIELDS).lean(),
    ]);

    const plan = planReorder(order.items || [], menuDocs as any[], (store as any) || undefined, String(order.storeId));
    return res.json(new ApiResponse(200, true, "Reorder plan ready", plan));
});

// ─── Favourites: the student's most-ordered items that can still be ordered ───
const GetFavorites = asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.userId) return fail(res, 401, "Unauthorized");

    const grouped: any[] = await OrderModel.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(String(user.userId)),
                status: { $nin: ["cancelled", "payment_pending"] },
            },
        },
        { $unwind: "$items" },
        { $match: { "items.menuItemId": { $ne: null } } },
        { $group: { _id: "$items.menuItemId", timesOrdered: { $sum: "$items.quantity" } } },
        { $sort: { timesOrdered: -1 } },
        { $limit: 20 },
    ]);
    if (grouped.length === 0) return res.json(new ApiResponse(200, true, "No favourites yet", []));

    const menuDocs: any[] = await MenuItemModel.find({ _id: { $in: grouped.map((g) => g._id) } })
        .select("name price hasHalf halfPrice isAvailable isVeg storeId")
        .lean();
    const stores: any[] = await Store.find({ _id: { $in: [...new Set(menuDocs.map((m) => String(m.storeId)))] } })
        .select(STORE_STATUS_FIELDS)
        .lean();
    const storeMap = new Map<string, any>(stores.map((s) => [String(s._id), s]));

    const favorites = buildFavorites(
        grouped.map((g) => ({ menuItemId: g._id, timesOrdered: g.timesOrdered })),
        menuDocs,
        storeMap,
        8,
    );
    return res.json(new ApiResponse(200, true, "Favourites fetched", favorites));
});

// ─── Cancel Order (User) ─────────────────────────────────────────────────────
const CancelOrder = asyncHandler(async (req, res) => {
    const { order_id, userId } = req.params;
    if (!order_id || !userId) return fail(res, 400, "orderId and userId are required");

    const user = (req as any).user;
    if (user && userId !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot cancel order of another user.");
    }

    const order = await OrderModel.findOne({ _id: order_id, userId });
    if (!order) return fail(res, 404, "Order not found");
    if (order.status !== "pending") return fail(res, 400, "Order has already started preparation");

    order.status = "cancelled";

    // A paid online order is refunded in full when the student cancels it before the kitchen starts
    if (order.paymentType === "online" && order.paymentStatus === "paid") {
        try {
            if (!(order as any).razorpayPaymentId) throw new Error("No Razorpay payment id on this order");
            await refundRazorpayPayment((order as any).razorpayPaymentId, order.totalAmount, {
                orderId: order._id.toString(),
                reason: "Order cancelled by student",
            });
            order.paymentStatus = "refunded";
        } catch (error: any) {
            logger.error({ err: error.response?.data || error.message, orderId: order._id }, "Refund on student cancel failed");
            order.paymentStatus = "failed"; // order stays cancelled; needs manual refund
        }
    }
    await order.save();

    emitOrderEvent("ORDER_CANCELLED", order, order.userId.toString(), {
        type: "orderCancelled",
        orderId: order._id,
        message: order.paymentStatus === "refunded"
            ? "Your order has been cancelled and your payment will be refunded in 5-7 working days."
            : "Your order has been cancelled.",
    });

    return res.json(new ApiResponse(200, true, "Order cancelled successfully", order));
});

// ─── Accept → Preparing directly (skip "accepted" state) ─────────────────────
const AcceptOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");

    const owner = (req as any).owner;
    const orderStoreId = order.storeId.toString();
    const ownerStoreId = String(owner?.storeId || "");

    if (owner && owner.role === "owner" && orderStoreId !== ownerStoreId) {
        return fail(res, 403, "Unauthorized: This order belongs to a different shop");
    }

    if (order.status !== "pending") return fail(res, 400, "Only pending orders can be accepted");

    order.status = "preparing";
    await order.save();

    emitOrderEvent("ORDER_ACCEPTED", order, order.userId.toString(), {
        type: "orderPreparing",
        orderId: order._id,
        orderNumber: (order as any).orderNumber,
        message: `🍳 Order #${(order as any).orderNumber} accepted and is now being prepared!`,
    });

    return res.json(new ApiResponse(200, true, "Order accepted and now preparing", order));
});

// ─── Mark Ready + Generate QR code ───────────────────────────────────────────
const MarkReady = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");

    const owner = (req as any).owner;
    const orderStoreId = order.storeId.toString();
    const ownerStoreId = String(owner?.storeId || "");

    if (owner && owner.role === "owner" && orderStoreId !== ownerStoreId) {
        return fail(res, 403, "Unauthorized: This order belongs to a different shop");
    }

    if (order.status !== "preparing") return fail(res, 400, "Order must be in preparing state");

    // Generate one-time QR token
    const token     = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    order.status               = "ready";
    (order as any).qrToken     = token;
    (order as any).qrExpiresAt = expiresAt;
    (order as any).qrVerified  = false;
    await order.save();

    const qrData = JSON.stringify({ token, orderId: order._id });
    const qrCode = await QRCode.toDataURL(qrData);

    // Push QR via Kafka → notification consumer → WebSocket
    emitOrderEvent("ORDER_READY", order, order.userId.toString(), {
        type: "orderReady",
        orderId: order._id,
        orderNumber: (order as any).orderNumber,
        message: `🛎️ Order #${(order as any).orderNumber} is ready for pickup!`,
        qrCode,
    });

    return res.json(new ApiResponse(200, true, "Order ready + QR generated", { order, qrCode }));
});

// ─── Get QR for an order (re-fetch) ──────────────────────────────────────────
const GetOrderQR = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    // .lean() — read-only, no need for Mongoose document overhead
    const order = await OrderModel.findById(orderId).lean();
    if (!order || !(order as any).qrToken) return fail(res, 404, "QR not available for this order");

    const user = (req as any).user;
    if (user && String(order.userId) !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot fetch QR code of another user's order.");
    }

    if ((order as any).qrExpiresAt && new Date() > (order as any).qrExpiresAt)
        return fail(res, 400, "QR code has expired");

    const qrData  = JSON.stringify({ token: (order as any).qrToken, orderId: order._id });
    const qrImage = await QRCode.toDataURL(qrData);

    return res.json(new ApiResponse(200, true, "QR fetched", { qrCode: qrImage, orderNumber: (order as any).orderNumber }));
});

// ─── Verify QR (owner scans student's QR at counter) ─────────────────────────
const VerifyOrderQR = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) return fail(res, 400, "QR token is required");

    // Covered by sparse index on qrToken
    const order = await OrderModel.findOne({ qrToken: token });
    if (!order)                    return fail(res, 400, "Invalid QR code");

    const owner = (req as any).owner;
    const orderStoreId = order.storeId.toString();
    const ownerStoreId = String(owner?.storeId || "");

    if (owner && owner.role === "owner" && orderStoreId !== ownerStoreId) {
        return fail(res, 403, "Unauthorized: This order belongs to a different shop");
    }

    if ((order as any).qrVerified) return fail(res, 400, "This QR has already been used");
    if ((order as any).qrExpiresAt && new Date() > (order as any).qrExpiresAt)
        return fail(res, 400, "QR code has expired (1 hour limit)");

    (order as any).qrVerified   = true;
    (order as any).qrVerifiedAt = new Date();
    order.status                = "delivered";
    await order.save();

    emitOrderEvent("ORDER_DELIVERED", order, order.userId.toString(), {
        type: "orderDelivered",
        orderId: order._id,
        orderNumber: (order as any).orderNumber,
        message: `✅ Order #${(order as any).orderNumber} picked up successfully!`,
    });

    return res.json(new ApiResponse(200, true, "Order verified and marked as delivered", order));
});

// ─── Reject Order ─────────────────────────────────────────────────────────────
const RejectOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");

    const owner = (req as any).owner;
    const orderStoreId = order.storeId.toString();
    const ownerStoreId = String(owner?.storeId || "");

    if (owner && owner.role === "owner" && orderStoreId !== ownerStoreId) {
        return fail(res, 403, "Unauthorized: This order belongs to a different shop");
    }

    if (order.status !== "pending") return fail(res, 400, "Only pending orders can be rejected");

    // The reason is optional (older owner apps send none) but must be valid when present
    const parsedReason = parseRejectReason(req.body);
    if (!parsedReason.ok) return fail(res, 400, parsedReason.error);

    // 1. Mark order as cancelled internally
    order.status = "cancelled";
    order.rejectionReason = parsedReason.code;
    order.rejectionNote = parsedReason.note;

    // 2. If it was paid online, refund the payment through Razorpay
    if (order.paymentType === "online" && order.paymentStatus === "paid") {
        try {
            if (!(order as any).razorpayPaymentId) throw new Error("No Razorpay payment id on this order (paid before the Razorpay switch?)");
            await refundRazorpayPayment((order as any).razorpayPaymentId, order.totalAmount, {
                orderId: order._id.toString(),
                reason: "Order cancelled by canteen owner",
            });
            order.paymentStatus = "refunded";
            logger.info({ orderId: order._id }, "Razorpay refund initiated successfully");
        } catch (error: any) {
            logger.error({
                err: error.response?.data || error.message,
                orderId: order._id
            }, "Failed to initiate Razorpay refund");
            // The order is still cancelled; the refund needs manual follow-up
            order.paymentStatus = "failed";
        }
    }

    await order.save();

    // 3. Notify the user via Kafka → WebSocket
    emitOrderEvent("ORDER_REJECTED", order, order.userId.toString(), {
        type: "orderCancelled",
        orderId: order._id,
        message: rejectionMessage(parsedReason.code, parsedReason.note, order.paymentStatus === "refunded"),
        orderNumber: (order as any).orderNumber,
        rejected: true,
        reason: parsedReason.code,
        note: parsedReason.note,
        refunded: order.paymentStatus === "refunded",
    });

    return res.json(new ApiResponse(200, true, "Order rejected and refund processed", order));
});

// ─── Demand hints for the owner dashboard ────────────────────────────────────
// "Tuesday lunch you usually sell about 40 rolls", from the same weekday and meal over the last 8 weeks.
const DEMAND_CACHE_SECONDS = 600;

export async function loadDemandHints(storeId: string) {
    const cacheKey = `demand_${storeId}`;
    const cached = appCache.get<unknown>(cacheKey);
    if (cached) return cached;

    const since = startOfIstDay(new Date(), DEMAND_WINDOW_DAYS);
    const orders = await OrderModel.find({
        storeId: new mongoose.Types.ObjectId(storeId),
        createdAt: { $gte: since },
        status: { $nin: ["cancelled", "payment_pending"] },
    })
        .select("status createdAt items.name items.quantity")
        .limit(50000)
        .lean();

    const result = { hints: buildDemandHints(orders as any[]), windowWeeks: DEMAND_WINDOW_DAYS / 7 };
    appCache.set(cacheKey, result, DEMAND_CACHE_SECONDS);
    return result;
}

const GetDemandHints = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) return fail(res, 400, "Invalid store id");

    const owner = (req as any).owner;
    if (owner && owner.role === "owner" && String(storeId) !== String(owner.storeId)) {
        return fail(res, 403, "Unauthorized: Cannot access another shop's data");
    }

    return res.json(new ApiResponse(200, true, "Demand hints", await loadDemandHints(String(storeId))));
});

// ─── Detailed insights for the owner Insights page ───────────────────────────
const INSIGHTS_CACHE_SECONDS = 300;

const GetInsights = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    if (!mongoose.isValidObjectId(storeId)) return fail(res, 400, "Invalid store id");

    const owner = (req as any).owner;
    if (owner && owner.role === "owner" && String(storeId) !== String(owner.storeId)) {
        return fail(res, 403, "Unauthorized: Cannot access another shop's data");
    }

    const requested = Number(req.query.days);
    const days = (INSIGHT_RANGES as readonly number[]).includes(requested) ? requested : 30;

    const cacheKey = `insights_${storeId}_${days}`;
    const cached = appCache.get<unknown>(cacheKey);
    if (cached) return res.json(new ApiResponse(200, true, "Insights", cached));

    const sid = new mongoose.Types.ObjectId(String(storeId));
    // Two periods of the same length, so the page can compare with the one before
    const since = startOfIstDay(new Date(), 2 * days - 1);
    const [orders, menu] = await Promise.all([
        OrderModel.find({ storeId: sid, createdAt: { $gte: since } })
            .select("status createdAt totalAmount paymentType userId userName qrVerifiedAt rating rejectionReason items.menuItemId items.name items.quantity items.price")
            .limit(100000)
            .lean(),
        MenuItemModel.find({ storeId: sid }).select("name category isAvailable rating ratingCount").lean(),
    ]);

    const result = buildInsights(
        orders as any[],
        (menu as any[]).map((m) => ({
            id: String(m._id),
            name: m.name,
            category: m.category || "other",
            isAvailable: m.isAvailable !== false,
            rating: m.rating ?? 0,
            ratingCount: m.ratingCount ?? 0,
        })),
        days,
    );
    appCache.set(cacheKey, result, INSIGHTS_CACHE_SECONDS);
    return res.json(new ApiResponse(200, true, "Insights", result));
});

// ─── Rate an order after pickup ──────────────────────────────────────────────
// One tap from the student. Counts once per order and feeds each item's star rating.
const RateOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    if (!mongoose.isValidObjectId(orderId)) return fail(res, 400, "Invalid order id");

    const parsed = parseStars(req.body);
    if (!parsed.ok) return fail(res, 400, parsed.error);

    const userId = String((req as any).user.userId);

    // The condition makes this atomic: only a delivered, unrated order of this student matches.
    const order = await OrderModel.findOneAndUpdate(
        { _id: orderId, userId, status: "delivered", rating: null },
        { rating: parsed.stars, ratedAt: new Date() },
        { new: true },
    ).select("items storeId rating orderNumber").lean();

    if (!order) {
        const existing = await OrderModel.findOne({ _id: orderId, userId }).select("status rating").lean();
        if (!existing) return fail(res, 404, "Order not found");
        if (existing.rating) return fail(res, 409, "You have already rated this order");
        return fail(res, 400, "You can rate an order after you pick it up");
    }

    const itemIds = Array.from(new Set((order.items || []).map((i: any) => String(i.menuItemId))));
    try {
        await MenuItemModel.updateMany({ _id: { $in: itemIds } }, addRatingPipeline(parsed.stars));
        appCache.del(`menu_${order.storeId}`);
    } catch (err) {
        // The student's rating is saved on the order; only the menu average missed this one.
        logger.error({ err, orderId }, "Could not update item ratings");
    }

    return res.json(new ApiResponse(200, true, "Thanks for rating your order", { rating: order.rating }));
});

// ─── Track Order Status ───────────────────────────────────────────────────────
const TrackOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId)
        .select("userId status paymentStatus paymentType totalAmount orderNumber createdAt updatedAt storeId userName userEmail userPhone items rejectionReason rejectionNote")
        .lean();
    if (!order) return fail(res, 404, "Order not found");

    // Tracking shows the student's name, email and phone, so only the student who
    // placed the order may see it
    const user = (req as any).user;
    if (!user || String(order.userId) !== String(user.userId)) {
        return fail(res, 403, "Unauthorized: Cannot track order of another user.");
    }
    return res.json(new ApiResponse(200, true, "Order status fetched", order));
});

// ─── Daily Sales for a Store (server-side aggregation, not client-side JS) ───
const GetDailySales = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    if (!storeId) return fail(res, 400, "storeId is required");

    const owner = (req as any).owner;
    if (owner && owner.role === "owner" && String(storeId) !== String(owner.storeId)) {
        return fail(res, 403, "Unauthorized: Cannot access daily sales of another shop");
    }

    // "Today" is the IST calendar day, whatever timezone the server runs in. Totals count real
    // sales only (not rejected or unpaid orders), the same as Insights and the Copilot.
    const startOfDay = startOfIstDay();
    const endOfDay   = new Date(startOfDay.getTime() + 24 * 3600 * 1000 - 1);

    // Heavy lifting done in MongoDB (index: storeId + createdAt)
    const [aggResult, todayOrders] = await Promise.all([
        OrderModel.aggregate([
            {
                $match: {
                    storeId:   new mongoose.Types.ObjectId(String(storeId)),
                    createdAt: { $gte: startOfDay, $lte: endOfDay },
                    status:    { $nin: NOT_SALES_STATUSES },
                }
            },
            {
                $group: {
                    _id:           null,
                    totalRevenue:  { $sum: "$totalAmount" },
                    orderCount:    { $sum: 1 },
                    itemsSold:     { $push: "$items" },
                },
            },
        ]),
        // Fetch raw list (for the table in the dashboard) — selective fields only
        OrderModel.find({
            storeId:   new mongoose.Types.ObjectId(String(storeId)),
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        })
            .select("_id orderNumber status totalAmount paymentType userName userPhone createdAt items")
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    const agg           = aggResult[0] ?? { totalRevenue: 0, orderCount: 0, itemsSold: [] };
    const avgOrderValue = agg.orderCount > 0 ? Math.round(agg.totalRevenue / agg.orderCount) : 0;

    // Flatten items and find top-selling item
    const itemMap = new Map<string, { name: string; qty: number }>();
    for (const group of (agg.itemsSold as any[][])) {
        for (const item of group) {
            const prev = itemMap.get(item.name) ?? { name: item.name, qty: 0 };
            itemMap.set(item.name, { name: item.name, qty: prev.qty + item.quantity });
        }
    }
    const topItem = itemMap.size > 0
        ? [...itemMap.values()].sort((a, b) => b.qty - a.qty)[0]
        : null;

    return res.json(new ApiResponse(200, true, "Daily sales fetched", {
        totalRevenue: agg.totalRevenue,
        orderCount:   agg.orderCount,
        avgOrderValue,
        topItem,
        orders: todayOrders,
    }));
});

const MarkPreparing = asyncHandler(async (req, res) => {
    return fail(res, 400, "Preparing state is set automatically when accepting an order.");
});

export {
    RazorpayWebhook,
    GetRush,
    GetWrapped,
    CreateOrder,
    GetUserAll_Orders,
    GetOwnerAll_Orders,
    GetSingleOrder_Details,
    CancelOrder,
    AcceptOrder,
    MarkPreparing,
    MarkReady,
    RejectOrder,
    TrackOrderStatus,
    GetReorderPlan,
    GetFavorites,
    GetOrderQR,
    VerifyOrderQR,
    GetDailySales,
    VerifyPayment,
    RateOrder,
    GetDemandHints,
    GetInsights,
};