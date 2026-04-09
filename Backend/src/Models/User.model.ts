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
  },
  { timestamps: true }
);

export const UserModel = mongoose.model("User", UserSchema);
