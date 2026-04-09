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
    VerifyOrderQR,     
    GetOrderQR 
} from "../Controller/Order_Controller";

const Order_Router = Router();

// ─── Order Creation ─────────────────────────────────────
Order_Router.post("/create", CreateOrder);

// ─── User & Store Orders ────────────────────────────────
Order_Router.get("/user/:userId", GetUserAll_Orders);
Order_Router.get("/store/:storeId", GetOwnerAll_Orders);

// ─── Tracking & Details ─────────────────────────────────
Order_Router.get("/track/:orderId", TrackOrderStatus);
Order_Router.get("/:order_id", GetSingleOrder_Details);

// ─── QR Related (NEW 🔥) ────────────────────────────────
Order_Router.post("/verify-qr", VerifyOrderQR);          // scan & verify
Order_Router.get("/:orderId/qr", GetOrderQR);            // fetch QR again

// ─── Order Actions ──────────────────────────────────────
Order_Router.patch("/cancel/:order_id/:userId", CancelOrder);
Order_Router.patch("/accept/:orderId", AcceptOrder);
Order_Router.patch("/reject/:orderId", RejectOrder);
Order_Router.patch("/preparing/:orderId", MarkPreparing);
Order_Router.patch("/ready/:orderId", MarkReady);        // now generates QR

export { Order_Router };