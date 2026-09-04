import twilio from "twilio";

function getClient() {
    const sid   = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) throw new Error("Twilio credentials not set in .env");
    return twilio(sid, token);
}

function getVerifySid(): string {
    const sid = process.env.TWILIO_VERIFY_SID;
    if (!sid) throw new Error("TWILIO_VERIFY_SID not set in .env");
    return sid;
}

// ─── Send OTP via Twilio Verify ───────────────────────────────────────────────
export async function sendOtp(phone: string): Promise<void> {
    await getClient()
        .verify.v2
        .services(getVerifySid())
        .verifications
        .create({
            to: `+91${phone}`,    // Indian numbers
            channel: "sms",
        });
}

// ─── Verify OTP via Twilio Verify ─────────────────────────────────────────────
export async function verifyOtp(phone: string, code: string): Promise<boolean> {
    try {
        const result = await getClient()
            .verify.v2
            .services(getVerifySid())
            .verificationChecks
            .create({
                to: `+91${phone}`,
                code,
            });
        return result.status === "approved";
    } catch {
        // Twilio throws if code is wrong/expired
        return false;
    }
}
