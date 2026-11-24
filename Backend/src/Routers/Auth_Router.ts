import { Router } from "express";
import { authLimiter } from "../utils/limiter";
import {
    googleLogin,
    updatePhone,
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
