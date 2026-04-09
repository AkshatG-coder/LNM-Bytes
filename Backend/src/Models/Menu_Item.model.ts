import mongoose, { Schema } from "mongoose";
const MenuItemSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image:{
      type:String,
      required:false
    },
    // 'price' always means the FULL portion price
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    // Half portion support
    hasHalf: {
      type: Boolean,
      default: false,
    },
    halfPrice: {
      type: Number,
      min: 0,
      default: null,
    },

    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    category: {
      type: String,
      enum: ["snacks", "drinks", "meals", "dessert", "other"],
      default: "snacks",
    },
    isVeg: {
      type: Boolean,
      default: true,
    },

    isAvailable: {
      type: Boolean,
      default: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Stores", 
      required: true,
    },
  },
  { timestamps: true }
);

export const MenuItemModel = mongoose.model("MenuItem", MenuItemSchema);

