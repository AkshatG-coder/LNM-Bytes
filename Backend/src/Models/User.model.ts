import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // Only allow lnmiit.ac.in emails
      validate: {
        validator: (v: string) => v.endsWith("@lnmiit.ac.in"),
        message: "Only @lnmiit.ac.in email addresses are allowed.",
      },
    },
    phone: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      required: true,
      unique: true,
    },
    picture: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ["student", "superadmin"],
      default: "student",
    },
    // Saved food preferences used by BiteBot
    preferences: {
      vegOnly: { type: Boolean, default: false },
      budget: { type: Number, default: null, min: 10, max: 2000 },
      notes: { type: String, default: "", maxlength: 120 },
    },
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", UserSchema);
