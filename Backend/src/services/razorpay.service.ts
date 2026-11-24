// Thin Razorpay REST client. Needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the environment.
import axios from "axios";
import { toPaise, type RzpPayment } from "../utils/razorpayHelpers";

const BASE = "https://api.razorpay.com/v1";

export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID || "";
export const razorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET || "";
export const isRazorpayConfigured = () => !!(razorpayKeyId() && razorpayKeySecret());

const client = () =>
    axios.create({
        baseURL: BASE,
        auth: { username: razorpayKeyId(), password: razorpayKeySecret() },
        timeout: 15000,
    });

export type RzpOrder = { id: string; amount: number; currency: string; status: string; receipt?: string };

export async function createRazorpayOrder(rupees: number, receipt: string, notes: Record<string, string>): Promise<RzpOrder> {
    const { data } = await client().post("/orders", { amount: toPaise(rupees), currency: "INR", receipt: receipt.slice(0, 40), notes });
    return data;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RzpPayment> {
    const { data } = await client().get(`/payments/${encodeURIComponent(paymentId)}`);
    return data;
}

export async function fetchOrderPayments(razorpayOrderId: string): Promise<RzpPayment[]> {
    const { data } = await client().get(`/orders/${encodeURIComponent(razorpayOrderId)}/payments`);
    return Array.isArray(data?.items) ? data.items : [];
}

/** Moves an authorized payment to captured. Only needed when auto-capture is off in the dashboard. */
export async function captureRazorpayPayment(paymentId: string, amountPaise: number): Promise<RzpPayment> {
    const { data } = await client().post(`/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });
    return data;
}

export async function refundRazorpayPayment(paymentId: string, rupees: number, notes: Record<string, string>) {
    const { data } = await client().post(`/payments/${encodeURIComponent(paymentId)}/refund`, { amount: toPaise(rupees), speed: "normal", notes });
    return data;
}
