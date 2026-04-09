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
} from "../Controller/Order_Controller";

const Order_Router = Router();

// ─── Create ───────────────────────────────────────────────────────────────────
Order_Router.post("/create", CreateOrder);

// ─── User & Store order lists ─────────────────────────────────────────────────
Order_Router.get("/user/:userId",          GetUserAll_Orders);
Order_Router.get("/store/:storeId",        GetOwnerAll_Orders);

// ─── Analytics (must come before /:order_id to avoid route clash) ─────────────
Order_Router.get("/sales/daily/:storeId",  GetDailySales);

// ─── Tracking ─────────────────────────────────────────────────────────────────
Order_Router.get("/track/:orderId",        TrackOrderStatus);

// ─── QR code ──────────────────────────────────────────────────────────────────
Order_Router.post("/verify-qr",            VerifyOrderQR);   // owner scans student's QR
Order_Router.get("/:orderId/qr",           GetOrderQR);      // student re-fetches QR

// ─── Single order detail (keep after specific routes) ─────────────────────────
Order_Router.get("/:order_id",             GetSingleOrder_Details);

// ─── Status mutations ─────────────────────────────────────────────────────────
Order_Router.patch("/cancel/:order_id/:userId", CancelOrder);
Order_Router.patch("/accept/:orderId",          AcceptOrder);   // → preparing directly
Order_Router.patch("/reject/:orderId",          RejectOrder);
Order_Router.patch("/preparing/:orderId",       MarkPreparing); // legacy stub
Order_Router.patch("/ready/:orderId",           MarkReady);     // → QR generated

export { Order_Router };
