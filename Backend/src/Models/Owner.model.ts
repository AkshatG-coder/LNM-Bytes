import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";

// ─── Owner schema — one owner per store ──────────────────────────────────────
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
      select: false,          // never returned by default
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Stores",
      required: true,
      unique: true,           // one owner per store
    },
  },
  { timestamps: true }
);

// Hash password before saving
OwnerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password helper
OwnerSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

export const OwnerModel = mongoose.model("Owner", OwnerSchema);
