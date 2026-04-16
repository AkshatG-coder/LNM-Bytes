import { OrderModel } from "../Models/Order_Schema.model";
import { CounterModel } from "../Models/Counter.model";
import { UserModel } from "../Models/User.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import mongoose from "mongoose";
import { sendNotification } from "../websockets/notify";
import QRCode from "qrcode";
import crypto from "crypto";
import logger from "../utils/logger";
import { Store } from "../Models/Store.model";
import axios from "axios";

const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID || "";
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY || "";
const CASHFREE_ENV = process.env.CASHFREE_ENV || "TEST";
const CASHFREE_BASE_URL = CASHFREE_ENV === "PRODUCTION" 
    ? "https://api.cashfree.com/pg/orders" 
    : "https://sandbox.cashfree.com/pg/orders";
const CASHFREE_API_VERSION = "2023-08-01"; // using the latest API version corresponding to fresh keys

const fail = (res: any, code: number, msg: string) =>
    res.status(code).json({ success: false, message: msg });

// ─── Create Order ─────────────────────────────────────────────────────────────
const CreateOrder = asyncHandler(async (req, res) => {
    const { userId, storeId, items, totalAmount, paymentType, orderNote, deliveryType } = req.body;

    if (!userId || !storeId || !items || items.length === 0 || !totalAmount || !paymentType)
        return fail(res, 400, "All fields are required");

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

    if (store.status !== "open" || !store.isActive) {
        return fail(res, 400, "Sorry, this store is currently closed manually by the owner.");
    }

    if (!(store as any).isOnlineOrderAvailable) {
        return fail(res, 400, "App ordering is currently paused by this canteen. Please try again later or visit the counter.");
    }

    // Validate Real Time based on Store operating hours (IST)
    const operationTime = (store as any).operationTime;
    if (operationTime && operationTime.openTime && operationTime.closeTime) {
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

    if (deliveryType === "night_delivery" && !(store as any).nightDelivery) {
        return fail(res, 400, "This store does not offer night delivery.");
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
        items,
        totalAmount,
        paymentType,
        paymentStatus: "pending",
        orderNote: orderNote || "",
        deliveryType: deliveryType || "pickup",
        status: initialStatus,
    });

    if (paymentType === "online") {
        try {
            // Cashfree requires order_id to be alphanumeric with _ or - only (no ObjectId!)
            const cfOrderId = `ord_${nextOrderNumber}_${Date.now()}`;

            // Phone: Cashfree requires exactly 10 digits, no country code
            let customerPhone = (user as any).phone ? String((user as any).phone).replace(/\D/g, "") : "";
            if (customerPhone.length !== 10) customerPhone = "9999999999"; // fallback for test

            // customer_id: alphanumeric only
            const customerId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50);

            const payload: any = {
                order_id: cfOrderId,
                order_amount: parseFloat(totalAmount.toString()),  // MUST be float, not string
                order_currency: "INR",
                customer_details: {
                    customer_id:    customerId,
                    customer_name:  user.name,
                    customer_email: user.email,
                    customer_phone: customerPhone,
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders?order_id=${newOrder._id.toString()}`
                }
            };

            // NOTE: vendor_splits/order_splits requires Easy Split to be enabled on your
            // Cashfree merchant account.
            if ((store as any).upiId) {
                // Cashfree strictly requires vendor_id to be alphanumeric with _ or - only
                const cleanVendorId = String((store as any).upiId).replace(/[^a-zA-Z0-9_-]/g, "");
                
                if (cleanVendorId) {
                    payload.order_splits = [{ vendor_id: cleanVendorId, percentage: 100 }];
                }
            }

            logger.info({ cfOrderId, amount: payload.order_amount }, "Creating Cashfree order");

            const cfRes = await axios.post(CASHFREE_BASE_URL, payload, {
                headers: {
                    "x-client-id":     process.env.CASHFREE_APP_ID,
                    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
                    "x-api-version":   CASHFREE_API_VERSION,
                    "Content-Type":    "application/json"
                }
            });

            const paymentSessionId = cfRes.data.payment_session_id;
            if (!paymentSessionId) {
                logger.error({ cfRes: cfRes.data }, "Cashfree returned no payment_session_id");
                return fail(res, 502, "Cashfree returned no session. Try again.");
            }

            newOrder.cashfreeOrderId = cfOrderId;
            (newOrder as any).paymentSessionId = paymentSessionId;
            await newOrder.save();

            logger.info({ cfOrderId, paymentSessionId }, "Cashfree order created OK");

            // Return immediately without pushing WebSocket — atomic!
            return res.status(201).json(new ApiResponse(201, true, "Order created. Pending payment", {
                ...newOrder.toJSON(),
                payment_session_id: paymentSessionId
            }));

        } catch (error: any) {
            const cfErr  = error.response?.data;
            const cfMsg  = cfErr?.message || cfErr?.error || error.message || "Unknown Cashfree error";
            const cfCode = error.response?.status;
            
            const usedId = process.env.CASHFREE_APP_ID || "undefined";
            logger.error({ 
                cfErr, 
                cfCode,
                usedAppIdStart: usedId.substring(0, 8) 
            }, "Cashfree API error");
            
            // Keep order in payment_pending so user can retry
            return fail(res, 502, `Payment gateway error (${cfCode}): ${cfMsg} (Using AppID starting with ${usedId.substring(0, 8)})`);
        }
    }

    // Standard cash order — trigger WebSocket
    sendNotification(storeId.toString(), {
        type: "newOrder",
        orderId:     newOrder._id,
        orderNumber: (newOrder as any).orderNumber,
        message:     `New order #${(newOrder as any).orderNumber} from ${user.name}!`,
        paymentType,
    });

    return res.status(201).json(new ApiResponse(201, true, "Order created successfully", newOrder));
});

// ─── Verify Payment (Webhook / Callback) ──────────────────────────────────────
const VerifyPayment = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");

    if (order.paymentStatus === "paid") {
        return res.json(new ApiResponse(200, true, "Payment already verified", order));
    }

    try {
        // IMPORTANT: must use the Cashfree-assigned order ID, not our MongoDB _id
        const cfLookupId = order.cashfreeOrderId || order._id.toString();
        const cfRes = await axios.get(`${CASHFREE_BASE_URL}/${cfLookupId}`, {
            headers: {
                "x-client-id": CASHFREE_APP_ID,
                "x-client-secret": CASHFREE_SECRET_KEY,
                "x-api-version": "2023-08-01",
            }
        });

        const orderStatus = cfRes.data.order_status;

        if (orderStatus === "PAID") {
            order.status = "pending";
            order.paymentStatus = "paid";
            await order.save();

            // Atomic WebSocket notification
            sendNotification(order.storeId.toString(), {
                type: "newOrder",
                orderId:     order._id,
                orderNumber: (order as any).orderNumber,
                message:     `New order #${(order as any).orderNumber} from ${order.userName} (PAID ONLINE)!`,
                paymentType: order.paymentType,
            });

            return res.json(new ApiResponse(200, true, "Payment completed successfully", order));
        } else if (orderStatus === "FAILED" || orderStatus === "TERMINATED" || orderStatus === "USER_DROPPED") {
            order.status = "cancelled";
            order.paymentStatus = "failed";
            await order.save();
            return fail(res, 400, `Payment was ${orderStatus.toLowerCase()}`);
        } else {
            return fail(res, 400, "Payment is still " + orderStatus);
        }

    } catch (err: any) {
        console.error("Cashfree Verification Error:", err.response?.data || err.message);
        return fail(res, 500, "Error verifying payment with Cashfree");
    }
});

// ─── Get All Orders for a User ────────────────────────────────────────────────
const GetUserAll_Orders = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId) return fail(res, 400, "UserId is missing");

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

    // Covered by index: { storeId: 1, status: 1, createdAt: -1 }
    const matchStage: any = { storeId: new mongoose.Types.ObjectId(String(storeId)) };
    if (status) matchStage.status = status;

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
    return res.json(new ApiResponse(200, true, "Order Details Fetched Successfully", order));
});

// ─── Cancel Order (User) ─────────────────────────────────────────────────────
const CancelOrder = asyncHandler(async (req, res) => {
    const { order_id, userId } = req.params;
    if (!order_id || !userId) return fail(res, 400, "orderId and userId are required");

    const order = await OrderModel.findOne({ _id: order_id, userId });
    if (!order) return fail(res, 404, "Order not found");
    if (order.status !== "pending") return fail(res, 400, "Order has already started preparation");

    order.status = "cancelled";
    await order.save();

    sendNotification(order.userId.toString(), {
        type: "orderCancelled",
        orderId: order._id,
        message: "Your order has been cancelled.",
    });

    return res.json(new ApiResponse(200, true, "Order cancelled successfully", order));
});

// ─── Accept → Preparing directly (skip "accepted" state) ─────────────────────
const AcceptOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");
    if (order.status !== "pending") return fail(res, 400, "Only pending orders can be accepted");

    order.status = "preparing";
    await order.save();

    sendNotification(order.userId.toString(), {
        type: "orderPreparing",
        orderId:     order._id,
        orderNumber: (order as any).orderNumber,
        message:     `🍳 Order #${(order as any).orderNumber} accepted and is now being prepared!`,
    });

    return res.json(new ApiResponse(200, true, "Order accepted and now preparing", order));
});

// ─── Mark Ready + Generate QR code ───────────────────────────────────────────
const MarkReady = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");
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

    sendNotification(order.userId.toString(), {
        type:        "orderReady",
        orderId:     order._id,
        orderNumber: (order as any).orderNumber,
        message:     `🛎️ Order #${(order as any).orderNumber} is ready for pickup!`,
        qrCode,      // Push QR directly via WebSocket — no extra HTTP round-trip needed
    });

    return res.json(new ApiResponse(200, true, "Order ready + QR generated", { order, qrCode }));
});

// ─── Get QR for an order (re-fetch) ──────────────────────────────────────────
const GetOrderQR = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    // .lean() — read-only, no need for Mongoose document overhead
    const order = await OrderModel.findById(orderId).lean();
    if (!order || !(order as any).qrToken) return fail(res, 404, "QR not available for this order");

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
    if ((order as any).qrVerified) return fail(res, 400, "This QR has already been used");
    if ((order as any).qrExpiresAt && new Date() > (order as any).qrExpiresAt)
        return fail(res, 400, "QR code has expired (30 min limit)");

    (order as any).qrVerified   = true;
    (order as any).qrVerifiedAt = new Date();
    order.status                = "delivered";
    await order.save();

    sendNotification(order.userId.toString(), {
        type:        "orderDelivered",
        orderId:     order._id,
        orderNumber: (order as any).orderNumber,
        message:     `✅ Order #${(order as any).orderNumber} picked up successfully!`,
    });

    return res.json(new ApiResponse(200, true, "Order verified and marked as delivered", order));
});

// ─── Reject Order ─────────────────────────────────────────────────────────────
const RejectOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return fail(res, 404, "Order not found");
    if (order.status !== "pending") return fail(res, 400, "Only pending orders can be rejected");

    // 1. Mark order as cancelled internally
    order.status = "cancelled";

    // 2. If it was paid online, issue a Cashfree Refund
    if (order.paymentType === "online" && order.paymentStatus === "paid") {
        try {
            const refundPayload = {
                refund_amount: order.totalAmount,
                refund_id: `rfnd_${order._id.toString()}_${Date.now()}`,
                refund_note: "Order cancelled by canteen owner"
            };
            
            await axios.post(`${CASHFREE_BASE_URL}/${order._id.toString()}/refunds`, refundPayload, {
                headers: {
                    "x-client-id": process.env.CASHFREE_APP_ID || CASHFREE_APP_ID,
                    "x-client-secret": process.env.CASHFREE_SECRET_KEY || CASHFREE_SECRET_KEY,
                    "x-api-version": CASHFREE_API_VERSION,
                    "Content-Type": "application/json"
                }
            });
            order.paymentStatus = "refunded";
            logger.info({ orderId: order._id }, "Cashfree refund initiated successfully");
        } catch (error: any) {
            logger.error({ 
                err: error.response?.data || error.message, 
                orderId: order._id 
            }, "Failed to initiate Cashfree refund");
            // We still cancel the order, but keep paymentStatus as 'paid' or mark as 'refund_failed'
            order.paymentStatus = "failed"; // For simplicity, though manual intervention might be needed.
            // Ideally: order.paymentStatus = "refund_pending" or flag for manual.
        }
    }

    await order.save();

    // 3. Notify the user
    sendNotification(order.userId.toString(), {
        type:    "orderCancelled",
        orderId: order._id,
        message: order.paymentStatus === "refunded" 
            ? "❌ Sorry, your order was rejected. A full refund has been initiated to your account."
            : "❌ Sorry, your order was rejected by the canteen.",
    });

    return res.json(new ApiResponse(200, true, "Order rejected and refund processed", order));
});

// ─── Track Order Status ───────────────────────────────────────────────────────
const TrackOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId)
        .select("status paymentStatus paymentType totalAmount orderNumber createdAt updatedAt storeId userName userEmail userPhone items")
        .lean();
    if (!order) return fail(res, 404, "Order not found");
    return res.json(new ApiResponse(200, true, "Order status fetched", order));
});

// ─── Daily Sales for a Store (server-side aggregation, not client-side JS) ───
const GetDailySales = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    if (!storeId) return fail(res, 400, "storeId is required");

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

    // Heavy lifting done in MongoDB (index: storeId + createdAt)
    const [aggResult, todayOrders] = await Promise.all([
        OrderModel.aggregate([
            {
                $match: {
                    storeId:   new mongoose.Types.ObjectId(String(storeId)),
                    createdAt: { $gte: startOfDay, $lte: endOfDay },
                    status:    { $ne: "cancelled" },
                },
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

// ─── MarkPreparing stub (not used in UI) ─────────────────────────────────────
const MarkPreparing = asyncHandler(async (req, res) => {
    return fail(res, 400, "Preparing state is set automatically when accepting an order.");
});

export {
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
    GetOrderQR,
    VerifyOrderQR,
    GetDailySales,
    VerifyPayment,
};