import mongoose, { Schema } from "mongoose";

const OrderItemSchema = new Schema({
    menuItemId: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
    },
    name: {
        type: String,
        required: true,  // denormalized item name for owner view
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    portionSize: {
        type: String,
        enum: ["full", "half"],
        default: "full",
    },
})

const OrderSchema = new Schema({
    // ─── User info (denormalized so owner sees student details) ────────────────
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    userName: {
        type: String,
        required: true,
    },
    userEmail: {
        type: String,
        required: true,
    },
    userPhone: {
        type: String,
        default: null,
    },
    // ──────────────────────────────────────────────────────────────────────────
    storeId: {
        type: Schema.Types.ObjectId,
        ref: "Stores",
        required: true,
    },
    items: {
        type: [OrderItemSchema],
        required: true
    },
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    status: {
        type: String,
        enum: [
            "pending",
            "accepted",
            "preparing",
            "ready",
            "delivered",
            "cancelled"
        ],
        default: "pending",
    },
    paymentType: {
        type: String,
        enum: ["online", "cash"],
        required: true,
        default: "cash",
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed"],
        default: "pending",
    },
    // For Cashfree integration (fill later)
    cashfreeOrderId: {
        type: String,
        default: null,
    },
    orderNote: {
        type: String,
    },
    deliveryType: {
        type: String,
        enum: ["pickup"],
        default: "pickup",
    },
}, { timestamps: true })

export const OrderModel = mongoose.model("Orders", OrderSchema)