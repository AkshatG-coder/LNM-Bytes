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
    // ─── Unique human-readable order number (e.g. LNM-1042) ──────────────────
    orderNumber: {
        type: Number,
        unique: true,
    },

    // ─── User info (denormalized so owner sees student details) ───────────────
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    userName:  { type: String, required: true },
    userEmail: { type: String, required: true },
    userPhone: { type: String, default: null  },

    // ─── Store ────────────────────────────────────────────────────────────────
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

    // ─── Status ───────────────────────────────────────────────────────────────
    status: {
        type: String,
        enum: ["pending", "accepted", "preparing", "ready", "delivered", "cancelled"],
        default: "pending",
    },

    // ─── Payment ──────────────────────────────────────────────────────────────
    paymentType:   { type: String, enum: ["online", "cash"], required: true, default: "cash" },
    paymentStatus: { type: String, enum: ["pending", "paid", "failed"],       default: "pending" },
    cashfreeOrderId: { type: String, default: null },

    // ─── Misc ─────────────────────────────────────────────────────────────────
    orderNote:    { type: String, default: "" },
    deliveryType: { type: String, enum: ["pickup"], default: "pickup" },

    // ─── QR Code (generated when order is marked Ready) ──────────────────────
    qrToken:      { type: String, default: null },
    qrExpiresAt:  { type: Date,   default: null },
    qrVerified:   { type: Boolean, default: false },
    qrVerifiedAt: { type: Date,   default: null },

}, { timestamps: true })

// ─── Performance Indexes ─────────────────────────────────────────────────────
// Owner dashboard: filter by store + status, sorted by newest first
OrderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
// User "My Orders" page: all orders for a user, newest first
OrderSchema.index({ userId: 1, createdAt: -1 });
// QR verification: lookup by qrToken (sparse — only indexed docs that have a token)
OrderSchema.index({ qrToken: 1 }, { sparse: true });
// Daily sales analytics: filter by store + date range
OrderSchema.index({ storeId: 1, createdAt: -1 });

export const OrderModel = mongoose.model("Orders", OrderSchema);