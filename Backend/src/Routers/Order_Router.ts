import { Router } from "express";
import {
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
} from "../Controller/Order_Controller";

const OrderRouter = Router();

// ─── Customer routes ──────────────────────────────────────────────────────────
OrderRouter.get("/user/:userId",               GetUserAll_Orders);
OrderRouter.get("/track/:orderId",             TrackOrderStatus);
OrderRouter.post("/cancel/:order_id/:userId",  CancelOrder);

// ─── Owner routes ─────────────────────────────────────────────────────────────
OrderRouter.get("/store/:storeId",             GetOwnerAll_Orders);
OrderRouter.get("/sales/daily/:storeId",       GetDailySales);         // daily analytics — must be before catch-all
OrderRouter.get("/:order_id",                  GetSingleOrder_Details); // keep last (catch-all id)

OrderRouter.patch("/accept/:orderId",          AcceptOrder);      // pending   → accepted
OrderRouter.patch("/reject/:orderId",          RejectOrder);      // pending   → cancelled
OrderRouter.patch("/preparing/:orderId",       MarkPreparing);    // accepted  → preparing
OrderRouter.patch("/ready/:orderId",           MarkReady);        // preparing → ready

export { OrderRouter };
