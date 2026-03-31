import { OrderModel } from "../Models/Order_Schema.model";
import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import mongoose from "mongoose";
import { sendNotification } from "../websockets/notify";

// ─── GET all orders for a customer ───────────────────────────────────────────
const GetUserAll_Orders = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.json(new ApiError("UserId is missing", 404));
  }
  const order = await OrderModel.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId as string) } },
    { $addFields: { pendingPriority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] } } },
    { $sort: { pendingPriority: 1, createdAt: -1 } }
  ]);
  if (!order) {
    return res.json(new ApiError("Error in fetching the details", 500));
  }
  return res.json(new ApiResponse(200, true, "User Orders fetched Successfully", order));
});

// ─── GET all orders for a store (owner dashboard) ────────────────────────────
const GetOwnerAll_Orders = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const status = req.query.status as string | undefined;

  if (!storeId) {
    return res.json(new ApiError("storeId is missing", 404));
  }

  const matchStage: any = {
    storeId: new mongoose.Types.ObjectId(storeId as string)
  };
  if (status) matchStage.status = status;

  const orders = await OrderModel.aggregate([
    { $match: matchStage },
    // Populate each item's menuItemId with name & price from MenuItem collection
    {
      $lookup: {
        from: "menuitems",
        localField: "items.menuItemId",
        foreignField: "_id",
        as: "_menuItems"
      }
    },
    {
      $addFields: {
        priority: { $cond: [{ $eq: ["$status", "pending"] }, 0, 1] },
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              $mergeObjects: [
                "$$item",
                {
                  name: {
                    $let: {
                      vars: {
                        menuItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$_menuItems",
                                cond: { $eq: ["$$this._id", "$$item.menuItemId"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: { $ifNull: ["$$menuItem.name", "Unknown Item"] }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    { $sort: { priority: 1, createdAt: -1, totalAmount: -1 } },
    { $project: { priority: 0, _menuItems: 0 } }
  ]);

  // Return empty array instead of error when no orders
  return res.json(new ApiResponse(200, true, "Store Orders fetched Successfully", orders));
});

// ─── GET daily sales analytics for a store ────────────────────────────────────
const GetDailySales = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  if (!storeId) {
    return res.status(400).json(new ApiError("storeId is required", 400));
  }

  // Build start-of-day (IST = UTC+5:30, but MongoDB stores UTC timestamps)
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const storeObjectId = new mongoose.Types.ObjectId(storeId as string);

  // Overall stats for today (all non-cancelled orders)
  const [stats] = await OrderModel.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        createdAt: { $gte: startOfDay },
        status: { $nin: ["cancelled"] }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
        avgOrderValue: { $avg: "$totalAmount" }
      }
    }
  ]);

  // Top item by quantity sold today (non-cancelled)
  const topItemPipeline = await OrderModel.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        createdAt: { $gte: startOfDay },
        status: { $nin: ["cancelled"] }
      }
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.menuItemId",
        totalQty: { $sum: "$items.quantity" }
      }
    },
    { $sort: { totalQty: -1 } },
    { $limit: 1 },
    {
      $lookup: {
        from: "menuitems",
        localField: "_id",
        foreignField: "_id",
        as: "menuItem"
      }
    },
    { $unwind: { path: "$menuItem", preserveNullAndEmptyArrays: true } }
  ]);

  // Orders list for today (for display in table)
  const todayOrders = await OrderModel.aggregate([
    {
      $match: {
        storeId: storeObjectId,
        createdAt: { $gte: startOfDay }
      }
    },
    {
      $lookup: {
        from: "menuitems",
        localField: "items.menuItemId",
        foreignField: "_id",
        as: "_menuItems"
      }
    },
    {
      $addFields: {
        items: {
          $map: {
            input: "$items",
            as: "item",
            in: {
              $mergeObjects: [
                "$$item",
                {
                  name: {
                    $let: {
                      vars: {
                        menuItem: {
                          $arrayElemAt: [
                            {
                              $filter: {
                                input: "$_menuItems",
                                cond: { $eq: ["$$this._id", "$$item.menuItemId"] }
                              }
                            },
                            0
                          ]
                        }
                      },
                      in: { $ifNull: ["$$menuItem.name", "Unknown"] }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    { $sort: { createdAt: -1 } },
    { $project: { _menuItems: 0 } }
  ]);

  const topItem = topItemPipeline[0]
    ? { name: topItemPipeline[0].menuItem?.name ?? "N/A", qty: topItemPipeline[0].totalQty }
    : null;

  return res.json(new ApiResponse(200, true, "Daily sales fetched successfully", {
    totalRevenue: stats?.totalRevenue ?? 0,
    orderCount: stats?.orderCount ?? 0,
    avgOrderValue: stats ? Math.round(stats.avgOrderValue) : 0,
    topItem,
    orders: todayOrders
  }));
});

// ─── GET single order details ─────────────────────────────────────────────────
const GetSingleOrder_Details = asyncHandler(async (req, res) => {
  const { order_id } = req.params;
  if (!order_id) {
    return res.json(new ApiError("OrderId is missing", 404));
  }
  const order_detail = await OrderModel.findById(order_id);
  if (!order_detail) {
    return res.json(new ApiError("Order not found", 500));
  }
  return res.json(new ApiResponse(200, true, "Order Details Fetched Successfully", order_detail));
});

// ─── Customer: cancel own order (only if still pending) ──────────────────────
const CancelOrder = asyncHandler(async (req, res) => {
  const { order_id, userId } = req.params;
  if (!order_id || !userId) {
    return res.status(400).json(new ApiError("orderId and userId are required", 400));
  }
  const order_details = await OrderModel.findOne({ _id: order_id, userId });
  if (!order_details) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  if (order_details.status !== "pending") {
    return res.status(400).json(new ApiError("Order has already started preparation", 400));
  }
  order_details.status = "cancelled";
  await order_details.save();
  return res.json(new ApiResponse(200, true, "Order cancelled successfully", order_details));
});

// ─── Track order status ───────────────────────────────────────────────────────
const TrackOrderStatus = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json(new ApiError("OrderId is required", 400));
  }
  const order = await OrderModel.findById(orderId).select("status paymentStatus createdAt updatedAt storeId");
  if (!order) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  return res.json(new ApiResponse(200, true, "Order status fetched successfully", order));
});

// ─── Owner: accept order (pending → accepted) ─────────────────────────────────
const AcceptOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json(new ApiError("orderId is required", 400));
  }
  const order = await OrderModel.findById(orderId);
  if (!order) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  if (order.status !== "pending") {
    return res.status(400).json(new ApiError("Order cannot be accepted — it is not pending", 400));
  }
  order.status = "accepted";
  await order.save();
  sendNotification(order.userId.toString(), {
    type: "orderAccepted",
    orderId: order._id,
    message: "Your order has been accepted ✅"
  });
  return res.json(new ApiResponse(200, true, "Order accepted successfully", order));
});

// ─── Owner: reject order (pending → cancelled) ────────────────────────────────
const RejectOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json(new ApiError("orderId is required", 400));
  }
  const order = await OrderModel.findById(orderId);
  if (!order) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  if (order.status !== "pending") {
    return res.status(400).json(new ApiError("Order cannot be rejected — it is not pending", 400));
  }
  order.status = "cancelled";
  await order.save();
  return res.json(new ApiResponse(200, true, "Order rejected successfully", order));
});

// ─── Owner: mark as preparing (accepted → preparing) ─────────────────────────
const MarkPreparing = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json(new ApiError("orderId is required", 400));
  }
  const order = await OrderModel.findById(orderId);
  if (!order) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  if (order.status !== "accepted") {
    return res.status(400).json(new ApiError("Order must be accepted before marking as preparing", 400));
  }
  order.status = "preparing";
  await order.save();
  sendNotification(order.userId.toString(), {
    type: "orderPreparing",
    orderId: order._id,
    message: "Your order is being prepared 🍳"
  });
  return res.json(new ApiResponse(200, true, "Order marked as preparing", order));
});

// ─── Owner: mark as ready (preparing → ready) ────────────────────────────────
const MarkReady = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!orderId) {
    return res.status(400).json(new ApiError("orderId is required", 400));
  }
  const order = await OrderModel.findById(orderId);
  if (!order) {
    return res.status(404).json(new ApiError("Order not found", 404));
  }
  if (order.status !== "preparing") {
    return res.status(400).json(new ApiError("Order must be preparing before marking as ready", 400));
  }
  order.status = "ready";
  await order.save();
  sendNotification(order.userId.toString(), {
    type: "orderReady",
    orderId: order._id,
    message: "Your order is ready for pickup! 🎉"
  });
  return res.json(new ApiResponse(200, true, "Order marked as ready", order));
});

export {
  GetUserAll_Orders,
  GetOwnerAll_Orders,
  GetSingleOrder_Details,
  CancelOrder,
  TrackOrderStatus,
  AcceptOrder,
  RejectOrder,
  MarkPreparing,
  MarkReady,
  GetDailySales
};