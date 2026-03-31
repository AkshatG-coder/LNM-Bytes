import asyncHandler from "../utils/AsyncHandler";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { OwnerModel } from "../Models/Owner.model";
import { Store } from "../Models/Store.model";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_change_this";

// ─── Helper: sign JWT ─────────────────────────────────────────────────────────
function signToken(ownerId: string, storeId: string): string {
  return jwt.sign({ ownerId, storeId }, JWT_SECRET, { expiresIn: 60 * 60 * 24 * 7 });
}

// ─── POST /auth/register ──────────────────────────────────────────────────────
// Body: { name, email, password, storeName }
// Creates a NEW store + registers the owner linked to it in one shot.
const RegisterOwner = asyncHandler(async (req, res) => {
  const { name, email, password, storeName } = req.body;

  if (!name || !email || !password || !storeName) {
    return res.status(400).json(new ApiError("name, email, password and storeName are required", 400));
  }
  if (password.length < 6) {
    return res.status(400).json(new ApiError("Password must be at least 6 characters", 400));
  }

  // Check email uniqueness
  const emailTaken = await OwnerModel.findOne({ email: email.toLowerCase() });
  if (emailTaken) {
    return res.status(409).json(new ApiError("Email already in use.", 409));
  }

  // Create the store with sensible defaults — owner updates details from Settings later
  const store = await Store.create({
    name: storeName.trim(),
    description: "Welcome to " + storeName.trim(),
    phone: "0000000000",
    ownerName: name.trim(),
    location: "Campus",
    operationTime: { openTime: "08:00", closeTime: "22:00" },
    status: "open",
    foodType: "veg",
    isOnlineOrderAvailable: true,
    isActive: true,
  });

  // Create the owner linked to the new store
  const owner = await OwnerModel.create({ name, email, password, storeId: store._id });

  const token = signToken(owner._id.toString(), store._id.toString());

  return res.status(201).json(
    new ApiResponse(201, true, "Account created successfully", {
      token,
      owner: { _id: owner._id, name: owner.name, email: owner.email, storeId: store._id },
      store: { _id: store._id, name: store.name, status: store.status },
    })
  );
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
// Body: { email, password }
const LoginOwner = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json(new ApiError("email and password are required", 400));
  }

  // Fetch owner including hashed password (select: false on schema)
  const owner = await OwnerModel.findOne({ email: email.toLowerCase() }).select("+password").populate("storeId");
  if (!owner) {
    return res.status(401).json(new ApiError("Invalid email or password", 401));
  }

  const isMatch = await (owner as any).comparePassword(password);
  if (!isMatch) {
    return res.status(401).json(new ApiError("Invalid email or password", 401));
  }

  const store = owner.storeId as any; // populated
  const token = signToken(owner._id.toString(), store._id.toString());

  return res.json(
    new ApiResponse(200, true, "Login successful", {
      token,
      owner: { _id: owner._id, name: owner.name, email: owner.email, storeId: store._id },
      store: { _id: store._id, name: store.name, status: store.status },
    })
  );
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
// Validates Bearer token and returns current owner + store info
const GetMe = asyncHandler(async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json(new ApiError("No token provided", 401));
  }
  const token = auth.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { ownerId: string; storeId: string };
    const owner = await OwnerModel.findById(decoded.ownerId).populate("storeId");
    if (!owner) {
      return res.status(401).json(new ApiError("Owner not found", 401));
    }
    const store = owner.storeId as any;
    return res.json(
      new ApiResponse(200, true, "Auth valid", {
        owner: { _id: owner._id, name: owner.name, email: owner.email, storeId: store._id },
        store: { _id: store._id, name: store.name, status: store.status },
      })
    );
  } catch {
    return res.status(401).json(new ApiError("Invalid or expired token", 401));
  }
});

export { RegisterOwner, LoginOwner, GetMe };
