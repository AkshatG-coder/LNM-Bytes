import asyncHandler from "../utils/AsyncHandler";
import { ApiResponse } from "../utils/ApiResponse";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../Models/User.model";
import { OwnerModel } from "../Models/Owner.model";
import { Store } from "../Models/Store.model";
import { sendOtp, verifyOtp } from "../services/otp.service";
import { sendOtpEmail } from "../services/email.service";

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

    // Atomic upsert — single DB round-trip instead of find + conditional create
    const user = await UserModel.findOneAndUpdate(
        { googleId },
        {
            $setOnInsert: {
                name:    name || email.split("@")[0],
                email,
                googleId,
                picture: picture || null,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const token = jwt.sign(
        { userId: user!._id, email: user!.email, role: (user as any).role },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );

    return res.json(new ApiResponse(200, true, "Login successful", {
        token,
        user: {
            id:      user!._id.toString(),   // must be a plain string — ObjectId breaks localStorage round-trip
            name:    user!.name,
            email:   user!.email,
            phone:   (user as any).phone ?? null,
            picture: user!.picture,
            role:    (user as any).role ?? "user",
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
        // Development fallback — log only in development
        if (process.env.NODE_ENV !== "production") {
            console.log(`[DEV MODE] OTP for ${phone}: 123456`);
        }
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
    const { name, email, password, storeName, phone, upiId } = req.body;

    if (!name || !email || !password || !storeName || !phone)
        return err(res, 400, "All fields are required — name, phone, email, password, and store name");

    if (!/^\d{10}$/.test(phone))
        return err(res, 400, "Phone number must be exactly 10 digits");

    if (password.length < 6)
        return err(res, 400, "Password must be at least 6 characters long");

    const existing = await OwnerModel.findOne({ email });
    if (existing)
        return err(res, 409, `An account with ${email} already exists. Please sign in instead.`);

    const store = await Store.create({
        name: storeName,
        description: `${storeName} - LNMIIT Canteen`,
        phone,           // Use owner's real phone number for store contact
        ownerName: name,
        location: "LNMIIT Campus",
        operationTime: { openTime: "08:00", closeTime: "22:00" },
        isActive: false,
        status: "closed",
        ...(upiId ? { upiId: upiId.trim() } : {}),
    });

    const owner = await OwnerModel.create({
        name,
        email,
        password,
        phone,           // Also save on owner record for profile editing later
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
        owner: { id: owner._id, name: owner.name, email: owner.email, role: owner.role, phone: (owner as any).phone || null },
        store: { _id: store._id, name: store.name, status: store.status },
    }));
});

// ─── Super Admin: Get All Owners ─────────────────────────────────────────────
const getAllOwners = asyncHandler(async (req, res) => {
    const owners = await OwnerModel.find({})
        .populate("storeId", "name status location")
        .select("-password")
        .lean();
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

// ─── Super Admin: Reject Owner ───────────────────────────────────────────────
const rejectOwner = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;
    const owner = await OwnerModel.findByIdAndDelete(ownerId);
    if (!owner) return err(res, 404, "Owner not found");
    if (owner.storeId) {
        await Store.findByIdAndDelete(owner.storeId);
    }
    return res.json(new ApiResponse(200, true, "Owner request rejected and deleted successfully", owner));
});

// ─── Owner: Reset Password ──────────────────────────────────────────────────
// PATCH /auth/owner/reset-password
// Body: { email, currentPassword, newPassword }
const resetOwnerPassword = asyncHandler(async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword)
        return err(res, 400, "Email, current password, and new password are all required.");

    if (newPassword.length < 6)
        return err(res, 400, "New password must be at least 6 characters.");

    if (currentPassword === newPassword)
        return err(res, 400, "New password must be different from the current password.");

    const owner = await OwnerModel.findOne({ email }).select("+password");
    if (!owner)
        return err(res, 404, `No account found with email: ${email}.`);

    const isMatch = await (owner as any).comparePassword(currentPassword);
    if (!isMatch)
        return err(res, 401, "Current password is incorrect. Please try again.");

    // Assign new password — the pre-save hook in Owner.model.ts will hash it
    owner.password = newPassword;
    await owner.save();

    return res.json(new ApiResponse(200, true, "Password reset successfully. Please log in with your new password.", null));
});

// ─── Owner: Update Phone ──────────────────────────────────────────────────────
// PATCH /auth/owner/phone/:ownerId
const updateOwnerPhone = asyncHandler(async (req, res) => {
    const { ownerId } = req.params;
    const { phone }   = req.body;

    if (!phone || !/^\d{10}$/.test(phone))
        return err(res, 400, "Phone number must be exactly 10 digits");

    const owner = await OwnerModel.findByIdAndUpdate(
        ownerId, { phone }, { new: true }
    ).select("-password");
    if (!owner) return err(res, 404, "Owner not found");

    // Keep Store.phone in sync so the customer-facing card shows the right number
    await Store.findByIdAndUpdate(owner.storeId, { phone });

    return res.json(new ApiResponse(200, true, "Phone updated successfully", {
        id:    owner._id,
        phone: (owner as any).phone,
    }));
});

// ─── Owner: Forgot Password — Step 1: Send OTP to email ────────────────────
// POST /auth/owner/forgot/send-otp
// Body: { email }
const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return err(res, 400, "Email is required.");

    const owner = await OwnerModel.findOne({ email })
        .select("+passwordResetOtp +passwordResetExpiry");
    if (!owner)
        return err(res, 404, `No account found with email: ${email}.`);

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    owner.passwordResetOtp    = hashedOtp;
    owner.passwordResetExpiry = expiry;
    await owner.save({ validateBeforeSave: false });

    try {
        await sendOtpEmail(email, otp, owner.name);
    } catch (e) {
        // Rollback OTP if email fails
        owner.passwordResetOtp    = null as any;
        owner.passwordResetExpiry = null as any;
        await owner.save({ validateBeforeSave: false });
        return err(res, 500, "Failed to send OTP email. Please check the SMTP configuration.");
    }

    return res.json(new ApiResponse(200, true,
        `OTP sent to ${email}. It expires in 10 minutes.`, { email }));
});

// ─── Owner: Forgot Password — Step 2: Verify OTP ─────────────────────────────
// POST /auth/owner/forgot/verify-otp
// Body: { email, otp }
const forgotPasswordVerifyOtp = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return err(res, 400, "Email and OTP are required.");

    const owner = await OwnerModel.findOne({ email })
        .select("+passwordResetOtp +passwordResetExpiry");

    if (!owner || !owner.passwordResetOtp || !owner.passwordResetExpiry)
        return err(res, 400, "No OTP request found. Please request a new OTP.");

    if (owner.passwordResetExpiry < new Date())
        return err(res, 400, "OTP has expired. Please request a new one.");

    const isValid = await bcrypt.compare(otp, owner.passwordResetOtp);
    if (!isValid)
        return err(res, 400, "Incorrect OTP. Please try again.");

    // Issue a short-lived reset token (10 min) — frontend sends this in step 3
    const resetToken = jwt.sign(
        { ownerId: owner._id, purpose: "pw-reset" },
        process.env.JWT_SECRET as string,
        { expiresIn: "10m" }
    );

    return res.json(new ApiResponse(200, true, "OTP verified successfully.", { resetToken }));
});

// ─── Owner: Forgot Password — Step 3: Set New Password ───────────────────────
// POST /auth/owner/forgot/reset
// Body: { resetToken, newPassword }
const forgotPasswordReset = asyncHandler(async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return err(res, 400, "Reset token and new password are required.");

    if (newPassword.length < 6)
        return err(res, 400, "Password must be at least 6 characters.");

    let payload: any;
    try {
        payload = jwt.verify(resetToken, process.env.JWT_SECRET as string);
    } catch {
        return err(res, 401, "Reset link has expired or is invalid. Please start again.");
    }

    if (payload.purpose !== "pw-reset")
        return err(res, 401, "Invalid reset token.");

    const owner = await OwnerModel.findById(payload.ownerId)
        .select("+password +passwordResetOtp +passwordResetExpiry");
    if (!owner) return err(res, 404, "Owner not found.");

    // Set new password — pre-save hook will hash it
    owner.password            = newPassword;
    owner.passwordResetOtp    = null as any;
    owner.passwordResetExpiry = null as any;
    await owner.save();

    return res.json(new ApiResponse(200, true,
        "Password updated successfully. Please log in with your new password.", null));
});

export {
    googleLogin,
    updatePhone,
    sendPhoneOtp,
    verifyPhoneOtp,
    ownerRegister,
    ownerLogin,
    resetOwnerPassword,
    updateOwnerPhone,
    getAllOwners,
    approveOwner,
    revokeOwner,
    rejectOwner,
    forgotPasswordSendOtp,
    forgotPasswordVerifyOtp,
    forgotPasswordReset,
};
