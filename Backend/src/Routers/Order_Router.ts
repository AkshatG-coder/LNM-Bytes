import { Router } from "express";
import {
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
} from "../Controller/Order_Controller";
import { verifyUserToken, verifyOwnerToken } from "../middleware/verifyToken";

const Order_Router = Router();

// ─── Create ───────────────────────────────────────────────────────────────────
Order_Router.post("/create", verifyUserToken, CreateOrder);
Order_Router.post("/verify-payment/:orderId", verifyUserToken, VerifyPayment);

// ─── User & Store order lists ─────────────────────────────────────────────────
Order_Router.get("/user/:userId",          verifyUserToken, GetUserAll_Orders);
Order_Router.get("/store/:storeId",        verifyOwnerToken, GetOwnerAll_Orders);

// ─── Analytics (must come before /:order_id to avoid route clash) ─────────────
Order_Router.get("/sales/daily/:storeId",  verifyOwnerToken, GetDailySales);

// ─── Tracking ─────────────────────────────────────────────────────────────────
Order_Router.get("/track/:orderId",        TrackOrderStatus);

// ─── QR code ──────────────────────────────────────────────────────────────────
Order_Router.post("/verify-qr",            verifyOwnerToken, VerifyOrderQR);   // owner scans student's QR
Order_Router.get("/:orderId/qr",           verifyUserToken, GetOrderQR);      // student re-fetches QR

// ─── Single order detail (keep after specific routes) ─────────────────────────
Order_Router.get("/:order_id",             verifyUserToken, GetSingleOrder_Details);

// ─── Status mutations ─────────────────────────────────────────────────────────
Order_Router.patch("/cancel/:order_id/:userId", verifyUserToken, CancelOrder);
Order_Router.patch("/accept/:orderId",          verifyOwnerToken, AcceptOrder);
Order_Router.patch("/reject/:orderId",          verifyOwnerToken, RejectOrder);
Order_Router.patch("/preparing/:orderId",       verifyOwnerToken, MarkPreparing);
Order_Router.patch("/ready/:orderId",           verifyOwnerToken, MarkReady);

export { Order_Router };
