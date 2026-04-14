import { Router } from "express";
import { authLimiter } from "../utils/limiter";
import {
    googleLogin,
    updatePhone,
    sendPhoneOtp,
    verifyPhoneOtp,
    ownerRegister,
    ownerLogin,
    updateOwnerPhone,
    getAllOwners,
    approveOwner,
    revokeOwner,
    rejectOwner,
} from "../Controller/Auth_Controller";


const Auth_Router = Router();

// ─── Student Auth (Google OAuth) ─────────────────────────────────────────────
Auth_Router.post("/google", googleLogin);
Auth_Router.patch("/phone/:userId", updatePhone);   // legacy direct update

// ─── Phone OTP Verification (Twilio) ────────────────────────────────────────────────────
// authLimiter here: OTP routes are brute-force sensitive (20 req / 15 min per IP)
Auth_Router.post("/otp/send",   authLimiter, sendPhoneOtp);    // send OTP via SMS
Auth_Router.post("/otp/verify", authLimiter, verifyPhoneOtp);  // verify OTP + save phone

// ─── Owner Auth ───────────────────────────────────────────────────────────────
Auth_Router.post("/owner/register", ownerRegister);
Auth_Router.post("/owner/login", ownerLogin);
Auth_Router.patch("/owner/phone/:ownerId", updateOwnerPhone);  // update owner phone + sync to store

// ─── Super Admin ──────────────────────────────────────────────────────────────
Auth_Router.get("/superadmin/owners", getAllOwners);
Auth_Router.patch("/superadmin/approve/:ownerId", approveOwner);
Auth_Router.patch("/superadmin/revoke/:ownerId", revokeOwner);
Auth_Router.delete("/superadmin/reject/:ownerId", rejectOwner);

export { Auth_Router };
