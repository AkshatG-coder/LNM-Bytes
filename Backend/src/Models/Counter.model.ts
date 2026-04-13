import mongoose, { Schema } from "mongoose";

/**
 * Counter model — provides atomic, race-condition-free sequence generation.
 * Used for unique human-readable order numbers (e.g. 1001, 1002, …).
 *
 * Usage:
 *   const doc = await CounterModel.findOneAndUpdate(
 *     { _id: "orderNumber" },
 *     { $inc: { seq: 1 } },
 *     { upsert: true, new: true }
 *   );
 *   const nextOrderNumber = doc.seq + 1000; // offset so first order is 1001
 */
const CounterSchema = new Schema({
    _id:  { type: String, required: true },  // e.g. "orderNumber"
    seq:  { type: Number, default: 0 },
});

export const CounterModel = mongoose.model("Counter", CounterSchema);
