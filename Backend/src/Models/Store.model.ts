import mongoose, { Schema } from "mongoose";
const CanteenSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },
    ownerName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    location: {
      type: String,
      required: true, 
      default:"Cafeteria"
    },
    operationTime: {
      openTime: {
        type: String,
        required: true,
      },
      closeTime: {
        type: String,
        required: true,
      },
    },
    nightDelivery: {
      type: Boolean,
      default: false,
    },
    foodType: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      default: "veg",
    },
    isOnlineOrderAvailable: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Store=mongoose.model("Stores",CanteenSchema)