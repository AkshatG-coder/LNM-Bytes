import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// In-memory OTP store { phone: { otp, expiresAt } }
// In production, replace with Redis
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

function getClient() {
    if (!accountSid || !authToken) {
        throw new Error("Twilio credentials not configured");
    }
    return twilio(accountSid, authToken);
}

export async function sendOtp(phone: string): Promise<void> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(phone, { otp, expiresAt });

    const client = getClient();
    await client.messages.create({
        body: `Your LNM Bytes verification code is: ${otp}. Valid for 10 minutes.`,
        from: fromNumber!,
        to: `+91${phone}`,
    });
}

export function verifyOtp(phone: string, inputOtp: string): boolean {
    const record = otpStore.get(phone);
    if (!record) return false;
    if (Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return false;
    }
    if (record.otp !== inputOtp) return false;
    otpStore.delete(phone); // one-time use
    return true;
}
