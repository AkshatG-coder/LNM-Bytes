import mongoose, { Schema } from "mongoose";

const StallSchema = new Schema(
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
    menuCardUrl: {
      type: String, 
    },

    stallType: {
      type: String,
      enum: ["food", "drinks", "games", "merch", "other"],
      default: "food",
    },

    foodType: {
      type: String,
      enum: ["veg", "non-veg", "both"],
      default: "veg",
    },

    nightDelivery: {
      type: Boolean,
      default: false,
    },
    isOnlineOrderAvailable: {
      type: Boolean,
      default: false,
    },
    event: {
      name: {
        type: String,
        required: true, 
      },
      type: {
        type: String,
        enum: ["fest", "concert", "sports", "seminar", "other"],
        default: "fest",
      },
    },

    eventDuration: {
      startDate: {
        type: Date,
        required: true,
      },
      endDate: {
        type: Date,
        required: true,
      },
    },

    location: {
      type: String,
      required: true, 
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    isTemporary: {
      type: Boolean,
      default: true, 
    },
  },
  { timestamps: true }
);

export const Stall_Model = mongoose.model("Stall", StallSchema);
