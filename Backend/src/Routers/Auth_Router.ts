import { Router } from "express";
import {
    googleLogin,
    updatePhone,
    sendPhoneOtp,
    verifyPhoneOtp,
    ownerRegister,
    ownerLogin,
    getAllOwners,
    approveOwner,
    revokeOwner,
} from "../Controller/Auth_Controller";

const Auth_Router = Router();

// ─── Student Auth (Google OAuth) ─────────────────────────────────────────────
Auth_Router.post("/google", googleLogin);
Auth_Router.patch("/phone/:userId", updatePhone);   // legacy direct update

// ─── Phone OTP Verification (Twilio) ─────────────────────────────────────────
Auth_Router.post("/otp/send", sendPhoneOtp);        // send OTP via SMS
Auth_Router.post("/otp/verify", verifyPhoneOtp);    // verify OTP + save phone

// ─── Owner Auth ───────────────────────────────────────────────────────────────
Auth_Router.post("/owner/register", ownerRegister);
Auth_Router.post("/owner/login", ownerLogin);

// ─── Super Admin ──────────────────────────────────────────────────────────────
Auth_Router.get("/superadmin/owners", getAllOwners);
Auth_Router.patch("/superadmin/approve/:ownerId", approveOwner);
Auth_Router.patch("/superadmin/revoke/:ownerId", revokeOwner);

export { Auth_Router };
