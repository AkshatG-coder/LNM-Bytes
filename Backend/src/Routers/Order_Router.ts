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
} from "../Controller/Order_Controller";

const Order_Router = Router();

Order_Router.post("/create", CreateOrder);
Order_Router.get("/user/:userId", GetUserAll_Orders);
Order_Router.get("/store/:storeId", GetOwnerAll_Orders);
Order_Router.get("/track/:orderId", TrackOrderStatus);
Order_Router.get("/:order_id", GetSingleOrder_Details);
Order_Router.patch("/cancel/:order_id/:userId", CancelOrder);
Order_Router.patch("/accept/:orderId", AcceptOrder);
Order_Router.patch("/reject/:orderId", RejectOrder);
Order_Router.patch("/preparing/:orderId", MarkPreparing);
Order_Router.patch("/ready/:orderId", MarkReady);

export { Order_Router };
