import asyncHandler from "../utils/AsyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { UserModel } from "../Models/User.model";
import { OwnerModel } from "../Models/Owner.model";
import { Store } from "../Models/Store.model";
import { sendOtp, verifyOtp } from "../services/otp.service";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: always returns a JSON body with { success, message } so frontend can read it
const err = (res: any, statusCode: number, message: string) =>
    res.status(statusCode).json({ success: false, message });

// ─── User: Google Login ───────────────────────────────────────────────────────
const googleLogin = asyncHandler(async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return err(res, 400, "Google token is missing");

    let ticket;
    try {
        ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
    } catch {
        return err(res, 401, "Invalid or expired Google token. Please sign in again.");
    }

    const payload = ticket.getPayload();
    if (!payload) return err(res, 401, "Could not read Google account info");

    const { sub: googleId, email, name, picture } = payload;

    if (!email || !email.endsWith("@lnmiit.ac.in")) {
        return err(res, 403, "Only @lnmiit.ac.in email addresses are allowed. Please use your LNMIIT account.");
    }

    let user = await UserModel.findOne({ googleId });
    const isNewUser = !user;

    if (!user) {
        user = await UserModel.create({
            name: name || email.split("@")[0],
            email,
            googleId,
            picture: picture || null,
        });
    }

    const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );

    return res.json(new ApiResponse(200, true, "Login successful", {
        token,
        isNewUser,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            picture: user.picture,
            role: user.role,
        },
    }));
});

// ─── User: Send OTP to phone ─────────────────────────────────────────────────
// POST /auth/otp/send
// Body: { phone: string }
const sendPhoneOtp = asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone || !/^\d{10}$/.test(phone))
        return err(res, 400, "Please enter a valid 10-digit mobile number");

    // Check if Twilio Verify is configured
    if (!process.env.TWILIO_VERIFY_SID || !process.env.TWILIO_AUTH_TOKEN) {
        // Development fallback — no real SMS sent
        console.log(`[DEV MODE] OTP for ${phone}: 123456`);
        return res.json(new ApiResponse(200, true, "OTP sent (dev mode — use 123456)", { phone }));
    }

    try {
        await sendOtp(phone);
        return res.json(new ApiResponse(200, true, "OTP sent successfully to +91" + phone, { phone }));
    } catch (e: any) {
        return err(res, 500, "Failed to send OTP. Please check your phone number and try again.");
    }
});

// ─── User: Verify OTP + save phone ───────────────────────────────────────────
// POST /auth/otp/verify
// Body: { userId, phone, otp }
const verifyPhoneOtp = asyncHandler(async (req, res) => {
    const { userId, phone, otp } = req.body;
    if (!userId || !phone || !otp)
        return err(res, 400, "userId, phone, and otp are all required");

    // Dev mode bypass
    const isDev = !process.env.TWILIO_VERIFY_SID || !process.env.TWILIO_AUTH_TOKEN;
    const isValid = isDev ? otp === "123456" : verifyOtp(phone, otp);

    if (!isValid)
        return err(res, 400, "Incorrect or expired OTP. Please try again.");

    const user = await UserModel.findByIdAndUpdate(userId, { phone }, { new: true });
    if (!user) return err(res, 404, "User not found");

    return res.json(new ApiResponse(200, true, "Phone verified and saved successfully", {
        id: user._id,
        phone: user.phone,
    }));
});

// ─── User: Update Phone (direct, no OTP — kept for backward compat) ───────────
const updatePhone = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { phone } = req.body;

    if (!phone || !/^\d{10}$/.test(phone))
        return err(res, 400, "Please enter a valid 10-digit mobile number");

    const user = await UserModel.findByIdAndUpdate(userId, { phone }, { new: true });
    if (!user) return err(res, 404, "User not found");

    return res.json(new ApiResponse(200, true, "Phone updated successfully", {
        id: user._id,
        phone: user.phone,
    }));
});

// ─── Owner: Register ─────────────────────────────────────────────────────────
const ownerRegister = asyncHandler(async (req, res) => {
    const { name, email, password, storeName } = req.body;

    if (!name || !email || !password || !storeName)
        return err(res, 400, "All fields are required — name, email, password, and store name");

    if (password.length < 6)
        return err(res, 400, "Password must be at least 6 characters long");

    const existing = await OwnerModel.findOne({ email });
    if (existing)
        return err(res, 409, `An account with ${email} already exists. Please sign in instead.`);

    const store = await Store.create({
        name: storeName,
        description: `${storeName} - LNMIIT Canteen`,
        phone: "0000000000",
        ownerName: name,
        location: "LNMIIT Campus",
        operationTime: { openTime: "08:00", closeTime: "22:00" },
        isActive: false,
        status: "closed",
    });

    const owner = await OwnerModel.create({
        name,
        email,
        password,
        storeId: store._id,
        isApproved: false,
    });

    return res.status(201).json(new ApiResponse(201, true,
        "Registration successful! Your account is pending super admin approval.", {
        owner: { id: owner._id, name: owner.name, email: owner.email },
        store: { id: store._id, name: store.name },
    }));
});

// ─── Owner: Login ─────────────────────────────────────────────────────────────
const ownerLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return err(res, 400, "Email and password are required");

    // Find owner — include password field (it's excluded by default with select: false)
    const owner = await OwnerModel.findOne({ email }).select("+password");

    if (!owner)
        return err(res, 404, `No account found with email: ${email}. Please register first.`);

    // Compare password
    const isMatch = await (owner as any).comparePassword(password);
    if (!isMatch)
        return err(res, 401, "Incorrect password. Please try again.");

    // Fetch linked store
    const store = await Store.findById(owner.storeId);
    if (!store)
        return err(res, 500, "Your store record is missing. Please contact support.");

    const token = jwt.sign(
        { ownerId: owner._id, storeId: owner.storeId, role: owner.role, isApproved: owner.isApproved },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );

    return res.json(new ApiResponse(200, true, "Login successful", {
        token,
        isApproved: owner.isApproved,
        owner: { id: owner._id, name: owner.name, email: owner.email, role: owner.role },
        store: { _id: store._id, name: store.name, status: store.status },
    }));
});

// ─── Super Admin: Get All Owners ─────────────────────────────────────────────
const getAllOwners = asyncHandler(async (req, res) => {
    const owners = await OwnerModel.find({})
        .populate("storeId", "name status location")
        .select("-password");
    return res.json(new ApiResponse(200, true, "Owners fetched", owners));
});

// ─── Super Admin: Approve Owner ──────────────────────────────────────────────
const approveOwner = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;
    const owner = await OwnerModel.findByIdAndUpdate(
        ownerId, { isApproved: true }, { new: true }
    ).select("-password");
    if (!owner) return err(res, 404, "Owner not found");
    await Store.findByIdAndUpdate(owner.storeId, { isActive: true });
    return res.json(new ApiResponse(200, true, "Owner approved successfully", owner));
});

// ─── Super Admin: Revoke Owner ───────────────────────────────────────────────
const revokeOwner = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;
    const owner = await OwnerModel.findByIdAndUpdate(
        ownerId, { isApproved: false }, { new: true }
    ).select("-password");
    if (!owner) return err(res, 404, "Owner not found");
    await Store.findByIdAndUpdate(owner.storeId, { isActive: false, status: "closed" });
    return res.json(new ApiResponse(200, true, "Owner revoked successfully", owner));
});

export {
    googleLogin,
    updatePhone,
    sendPhoneOtp,
    verifyPhoneOtp,
    ownerRegister,
    ownerLogin,
    getAllOwners,
    approveOwner,
    revokeOwner,
};
