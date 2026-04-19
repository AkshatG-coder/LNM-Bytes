import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

// Owner schema — separate from User (students). Owners are store operators.
const OwnerSchema = new Schema(
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
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false, // don't return password by default
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Stores",
      required: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    role: {
      type: String,
      enum: ["owner", "superadmin"],
      default: "owner",
    },
    // Super admin must approve before an owner can log in
    isApproved: {
      type: Boolean,
      default: false,
    },
    // ── Forgot-password OTP (temporary, cleared after reset) ──
    passwordResetOtp: {
      type: String,
      select: false,
      default: null,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
      default: null,
    },
  },
  { timestamps: true }
);

// Hash password before save
OwnerSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Method to compare passwords
OwnerSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const OwnerModel = mongoose.model("Owner", OwnerSchema);
