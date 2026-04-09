import { OrderModel } from "../Models/Order_Schema.model";
import { UserModel } from "../Models/User.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import mongoose from "mongoose";
import { sendNotification } from "../websockets/notify";

// ─── Create Order ─────────────────────────────────────────────────────────────
// POST /order/create
// Body: { userId, storeId, items[{menuItemId,name,quantity,price,portionSize}], totalAmount, paymentType, orderNote? }
const CreateOrder = asyncHandler(async (req, res) => {
    const { userId, storeId, items, totalAmount, paymentType, orderNote } = req.body;

    if (!userId || !storeId || !items || items.length === 0 || !totalAmount || !paymentType) {
        return res.status(400).json(new ApiError("All fields are required", 400));
    }

    // Fetch user info to denormalize into order
    const user = await UserModel.findById(userId);
    if (!user) {
        return res.status(404).json(new ApiError("User not found", 404));
    }

    const newOrder = await OrderModel.create({
        userId,
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phone || null,
        storeId,
        items,
        totalAmount,
        paymentType,
        paymentStatus: paymentType === "cash" ? "pending" : "pending",
        orderNote: orderNote || "",
        deliveryType: "pickup",
        status: "pending",
    });

    // Notify store owner via WebSocket
    sendNotification(storeId.toString(), {
        type: "newOrder",
        orderId: newOrder._id,
        message: `New order from ${user.name}!`,
        paymentType,
    });

    return res.status(201).json(new ApiResponse(201, true, "Order created successfully", newOrder));
});

// ─── Get All Orders for a User ────────────────────────────────────────────────
// GET /order/user/:userId
const GetUserAll_Orders = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json(new ApiError("UserId is missing", 400));
    }
    const order = await OrderModel.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId as string) } },
        { $addFields: { pendingPriority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
        { $sort: { pendingPriority: 1, createdAt: -1 } }
    ]);
    return res.json(new ApiResponse(200, true, "User Orders fetched Successfully", order));
});

// ─── Get All Orders for a Store (Owner Dashboard) ────────────────────────────
// GET /order/store/:storeId
const GetOwnerAll_Orders = asyncHandler(async (req, res) => {
    const { storeId } = req.params;
    const status = req.query.status as string | undefined;

    if (!storeId) {
        return res.status(400).json(new ApiError("storeId is missing", 400));
    }

    const matchStage: any = {
        storeId: new mongoose.Types.ObjectId(storeId as string)
    };
    if (status) matchStage.status = status;

    const orders = await OrderModel.aggregate([
        { $match: matchStage },
        { $addFields: { priority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
        { $sort: { priority: 1, createdAt: -1, totalAmount: -1 } },
        { $project: { priority: 0 } }
    ]);

    return res.json(new ApiResponse(200, true, "Store Orders fetched Successfully", orders));
});

// ─── Get Single Order ─────────────────────────────────────────────────────────
const GetSingleOrder_Details = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    if (!order_id) return res.status(400).json(new ApiError("OrderId is missing", 400));
    const order_detail = await OrderModel.findById(order_id);
    if (!order_detail) return res.status(404).json(new ApiError("Order not found", 404));
    return res.json(new ApiResponse(200, true, "Order Details Fetched Successfully", order_detail));
});

// ─── Cancel Order (User) ─────────────────────────────────────────────────────
const CancelOrder = asyncHandler(async (req, res) => {
    const { order_id, userId } = req.params;
    if (!order_id || !userId) return res.status(400).json(new ApiError("orderId and userId are required", 400));

    const order = await OrderModel.findOne({ _id: order_id, userId });
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    if (order.status !== "pending") return res.status(400).json(new ApiError("Order has already started preparation", 400));

    order.status = "cancelled";
    await order.save();
    return res.json(new ApiResponse(200, true, "Order cancelled successfully", order));
});

// ─── Status Transitions (Owner) ───────────────────────────────────────────────
const AcceptOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    if (order.status !== "pending") return res.status(400).json(new ApiError("Order cannot be accepted", 400));
    order.status = "accepted";
    await order.save();
    sendNotification(order.userId.toString(), { type: "orderAccepted", orderId: order._id, message: "Your order has been accepted!" });
    return res.json(new ApiResponse(200, true, "Order accepted", order));
});

const MarkPreparing = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    if (order.status !== "accepted") return res.status(400).json(new ApiError("Order must be accepted first", 400));
    order.status = "preparing";
    await order.save();
    sendNotification(order.userId.toString(), { type: "orderPreparing", orderId: order._id, message: "Your order is being prepared!" });
    return res.json(new ApiResponse(200, true, "Order is now preparing", order));
});

const MarkReady = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    if (order.status !== "preparing") return res.status(400).json(new ApiError("Order must be preparing first", 400));
    order.status = "ready";
    await order.save();
    sendNotification(order.userId.toString(), { type: "orderReady", orderId: order._id, message: "Your order is ready for pickup! 🎉" });
    return res.json(new ApiResponse(200, true, "Order is ready for pickup", order));
});

const RejectOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId);
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    if (order.status !== "pending") return res.status(400).json(new ApiError("Order cannot be rejected", 400));
    order.status = "cancelled";
    await order.save();
    return res.json(new ApiResponse(200, true, "Order rejected", order));
});

const TrackOrderStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const order = await OrderModel.findById(orderId).select("status paymentStatus paymentType createdAt updatedAt storeId");
    if (!order) return res.status(404).json(new ApiError("Order not found", 404));
    return res.json(new ApiResponse(200, true, "Order status fetched", order));
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
};