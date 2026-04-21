import { Router } from "express";
import { authLimiter } from "../utils/limiter";
import {
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
} from "../Controller/Auth_Controller";


import { verifyUserToken, verifyOwnerToken } from "../middleware/verifyToken";

const Auth_Router = Router();

// ─── Student Auth (Google OAuth) ─────────────────────────────────────────────
Auth_Router.post("/google", googleLogin);
Auth_Router.patch("/phone/:userId", verifyUserToken, updatePhone);   // legacy direct update

// ─── Phone OTP Verification (Twilio) ────────────────────────────────────────────────────
// authLimiter here: OTP routes are brute-force sensitive (20 req / 15 min per IP)
Auth_Router.post("/otp/send",   authLimiter, sendPhoneOtp);    // send OTP via SMS
Auth_Router.post("/otp/verify", authLimiter, verifyPhoneOtp);  // verify OTP + save phone

// ─── Owner Auth ───────────────────────────────────────────────────────────────
Auth_Router.post("/owner/register", ownerRegister);
Auth_Router.post("/owner/login", ownerLogin);
Auth_Router.patch("/owner/reset-password", authLimiter, resetOwnerPassword);  // verify old pw → set new pw
Auth_Router.patch("/owner/phone/:ownerId", verifyOwnerToken, updateOwnerPhone);

// ─── Owner: Forgot Password (OTP via email) ──────────────────────────────────
Auth_Router.post("/owner/forgot/send-otp",   authLimiter, forgotPasswordSendOtp);   // step 1: send OTP email
Auth_Router.post("/owner/forgot/verify-otp", authLimiter, forgotPasswordVerifyOtp); // step 2: verify OTP → get resetToken
Auth_Router.post("/owner/forgot/reset",       authLimiter, forgotPasswordReset);     // step 3: set new password

// ─── Super Admin ──────────────────────────────────────────────────────────────
Auth_Router.get("/superadmin/owners", verifyOwnerToken, getAllOwners);
Auth_Router.patch("/superadmin/approve/:ownerId", verifyOwnerToken, approveOwner);
Auth_Router.patch("/superadmin/revoke/:ownerId", verifyOwnerToken, revokeOwner);
Auth_Router.delete("/superadmin/reject/:ownerId", verifyOwnerToken, rejectOwner);

export { Auth_Router };
