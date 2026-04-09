import { OrderModel } from "../Models/Order_Schema.model";
import { UserModel } from "../Models/User.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import mongoose from "mongoose";
import { sendNotification } from "../websockets/notify";
import QRCode from "qrcode";
import crypto from "crypto";

const fail = (res: any, code: number, msg: string) =>
    res.status(code).json({ success: false, message: msg });

// ─── Create Order ─────────────────────────────────────────────────────────────
const CreateOrder = asyncHandler(async (req, res) => {
    const { userId, storeId, items, totalAmount, paymentType, orderNote } = req.body;

    if (!userId || !storeId || !items || items.length === 0 || !totalAmount || !paymentType)
        return fail(res, 400, "All fields are required");

    const user = await UserModel.findById(userId);
    if (!user) return fail(res, 404, "User not found");

    const lastOrder = await OrderModel.findOne({}, { orderNumber: 1 }).sort({ orderNumber: -1 });
    const nextOrderNumber = ((lastOrder as any)?.orderNumber ?? 1000) + 1;

    const newOrder = await OrderModel.create({
        orderNumber: nextOrderNumber,
        userId,
        userName:  user.name,
        userEmail: user.email,
        userPhone: user.phone || null,
        storeId,
        items,
        totalAmount,
        paymentType,
        paymentStatus: "pending",
        orderNote: orderNote || "",
        deliveryType: "pickup",
        status: "pending",
    });

    sendNotification(storeId.toString(), {
        type: "newOrder",
        orderId:     newOrder._id,
        orderNumber: (newOrder as any).orderNumber,
        message:     `New order #${(newOrder as any).orderNumber} from ${user.name}!`,
        paymentType,
    });

    return res.status(201).json(new ApiResponse(201, true, "Order created successfully", newOrder));
});

// ─── Get All Orders for a User ────────────────────────────────────────────────
const GetUserAll_Orders = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId) return fail(res, 400, "UserId is missing");

    const order = await OrderModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(String(userId)) } },
        { $addFields: { pendingPriority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
        { $sort: { pendingPriority: 1, createdAt: -1 } }
    ]);
    return res.json(new ApiResponse(200, true, "User Orders fetched Successfully", order));
});

// ─── Get All Orders for a Store ───────────────────────────────────────────────
const GetOwnerAll_Orders = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const status = req.query.status as string | undefined;
    if (!storeId) return fail(res, 400, "storeId is missing");

    const matchStage: any = { storeId: new mongoose.Types.ObjectId(String(storeId)) };
    if (status) matchStage.status = status;

    const orders = await OrderModel.aggregate([
        { $match: matchStage },
        { $addFields: { priority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
        { $sort: { priority: 1, createdAt: -1 } },
        { $project: { priority: 0 } }
    ]);
    return res.json(new ApiResponse(200, true, "Store Orders fetched Successfully", orders));
});

// ─── Get Single Order ─────────────────────────────────────────────────────────
const GetSingleOrder_Details = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    if (!order_id) return fail(res, 400, "OrderId is missing");
    const order = await OrderModel.findById(order_id);
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

    order.status = "preparing";   // ← Accept jumps directly to preparing
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
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    order.status      = "ready";
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
        qrCode,      // Send QR directly via WebSocket so user sees it instantly
    });

    return res.json(new ApiResponse(200, true, "Order ready + QR generated", { order, qrCode }));
});

// ─── Get QR for an order (refetch) ───────────────────────────────────────────
const GetOrderQR = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
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

    const order = await OrderModel.findOne({ qrToken: token });
    if (!order)               return fail(res, 400, "Invalid QR code");
    if ((order as any).qrVerified) return fail(res, 400, "This QR has already been used");
    if ((order as any).qrExpiresAt && new Date() > (order as any).qrExpiresAt)
        return fail(res, 400, "QR code has expired (30 min limit)");

    (order as any).qrVerified    = true;
    (order as any).qrVerifiedAt  = new Date();
    order.status                 = "delivered";
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

    order.status = "cancelled";
    await order.save();

    sendNotification(order.userId.toString(), {
        type:    "orderCancelled",
        orderId: order._id,
        message: "❌ Sorry, your order was rejected by the canteen.",
    });

    return res.json(new ApiResponse(200, true, "Order rejected", order));
});

// ─── Track Order Status ───────────────────────────────────────────────────────
const TrackOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId)
        .select("status paymentStatus paymentType totalAmount orderNumber createdAt updatedAt storeId userName userEmail userPhone items");
    if (!order) return fail(res, 404, "Order not found");
    return res.json(new ApiResponse(200, true, "Order status fetched", order));
});

// ─── Daily Sales for a Store ──────────────────────────────────────────────────
const GetDailySales = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    if (!storeId) return fail(res, 400, "storeId is required");

    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay   = new Date(); endOfDay.setHours(23, 59, 59, 999);

    const orders = await OrderModel.find({
        storeId:   new mongoose.Types.ObjectId(String(storeId)),
        createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ createdAt: -1 });

    const completed    = orders.filter(o => o.status !== "cancelled");
    const totalRevenue = completed.reduce((sum, o) => sum + o.totalAmount, 0);
    const avgOrderValue = completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0;

    const itemMap = new Map<string, { name: string; qty: number }>();
    for (const order of completed) {
        for (const item of order.items as any[]) {
            const prev = itemMap.get(item.name) ?? { name: item.name, qty: 0 };
            itemMap.set(item.name, { name: item.name, qty: prev.qty + item.quantity });
        }
    }
    const topItem = itemMap.size > 0
        ? [...itemMap.values()].sort((a, b) => b.qty - a.qty)[0]
        : null;

    return res.json(new ApiResponse(200, true, "Daily sales fetched", {
        totalRevenue,
        orderCount: orders.length,
        avgOrderValue,
        topItem,
        orders: orders.map(o => ({
            _id:         o._id,
            orderNumber: (o as any).orderNumber,
            status:      o.status,
            totalAmount: o.totalAmount,
            paymentType: o.paymentType,
            userName:    o.userName,
            userPhone:   o.userPhone,
            createdAt:   o.createdAt,
            items:       o.items,
        })),
    }));
});

// ─── MarkPreparing kept for router completeness (not used in UI) ──────────────
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
};