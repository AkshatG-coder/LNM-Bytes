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
    GetReorderPlan,
    GetFavorites,
    GetOrderQR,
    VerifyOrderQR,
    GetDailySales,
    VerifyPayment,
    RazorpayWebhook,
    RateOrder,
    GetDemandHints,
    GetInsights,
} from "../Controller/Order_Controller";
import { verifyUserToken, verifyOwnerToken } from "../middleware/verifyToken";

const Order_Router = Router();

// ─── Create ───────────────────────────────────────────────────────────────────
Order_Router.post("/create", verifyUserToken, CreateOrder);
Order_Router.post("/verify-payment/:orderId", verifyUserToken, VerifyPayment);
// Called by Razorpay servers: no JWT, authenticated by HMAC signature of the raw body
Order_Router.post("/razorpay-webhook", RazorpayWebhook);

// ─── User & Store order lists ─────────────────────────────────────────────────
Order_Router.get("/user/:userId",          verifyUserToken, GetUserAll_Orders);
Order_Router.get("/store/:storeId",        verifyOwnerToken, GetOwnerAll_Orders);

// ─── Analytics (must come before /:order_id to avoid route clash) ─────────────
Order_Router.get("/sales/daily/:storeId",  verifyOwnerToken, GetDailySales);

Order_Router.get("/insights/:storeId",     verifyOwnerToken, GetInsights);
Order_Router.get("/demand/:storeId",       verifyOwnerToken, GetDemandHints);

// ─── Tracking ─────────────────────────────────────────────────────────────────
Order_Router.get("/track/:orderId",        verifyUserToken, TrackOrderStatus);

// ─── Order again and favourites (before /:order_id) ───────────────────────────
Order_Router.get("/favorites",             verifyUserToken, GetFavorites);
Order_Router.get("/:orderId/reorder",      verifyUserToken, GetReorderPlan);

// ─── QR code ──────────────────────────────────────────────────────────────────
Order_Router.post("/verify-qr",            verifyOwnerToken, VerifyOrderQR);   // owner scans student's QR
Order_Router.get("/:orderId/qr",           verifyUserToken, GetOrderQR);      // student re-fetches QR

// ─── Single order detail (keep after specific routes) ─────────────────────────
Order_Router.get("/:order_id",             verifyUserToken, GetSingleOrder_Details);

// ─── Status mutations ─────────────────────────────────────────────────────────
Order_Router.post("/:orderId/rate",          verifyUserToken, RateOrder);       // student rates after pickup
Order_Router.patch("/cancel/:order_id/:userId", verifyUserToken, CancelOrder);
Order_Router.patch("/accept/:orderId",          verifyOwnerToken, AcceptOrder);
Order_Router.patch("/reject/:orderId",          verifyOwnerToken, RejectOrder);
Order_Router.patch("/preparing/:orderId",       verifyOwnerToken, MarkPreparing);
Order_Router.patch("/ready/:orderId",           verifyOwnerToken, MarkReady);

export { Order_Router };
