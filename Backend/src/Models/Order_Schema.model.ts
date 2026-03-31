import mongoose, { Schema } from "mongoose";
const OrderItemSchema = new Schema({
    menuItemId: {
        type: Schema.Types.ObjectId,
        ref: "MenuItem",
        required: true,
    },
    quantity: {
        type: Number,
        required:true,
        min:1
    },
    price:{
        type:Number,
        required:true,
        min:0
    }
})
const OrderSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    storeId: {
        type: Schema.Types.ObjectId,
        ref: "Stores",  
        required: true,
    },
    items:{
        type:[OrderItemSchema],
        required:true
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
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    orderNote: {
      type: String,
    },
    deliveryType: {
      type: String,
      enum: ["pickup", "night-delivery"],
      default: "pickup",
    },
},{timestamps:true})
export const OrderModel=mongoose.model("Orders",OrderSchema)