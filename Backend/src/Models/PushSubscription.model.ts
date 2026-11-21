import mongoose from "mongoose";

// One browser (or installed app) that agreed to receive order alerts.
const PushSubscriptionSchema = new mongoose.Schema({
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint:  { type: String, required: true, unique: true },
    keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
    },
    userAgent: { type: String, default: "", maxlength: 300 },
}, { timestamps: true });

export const PushSubscriptionModel = mongoose.model("PushSubscription", PushSubscriptionSchema);
