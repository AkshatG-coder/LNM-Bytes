import { useState } from "react";
import api from "./api";

export interface AuthState {
  token: string;
  storeId: string;
  storeName: string;
  ownerName: string;
  ownerId: string;
  phone: string;
  isApproved: boolean;
  role: string;
}

// ─── Persist to localStorage ──────────────────────────────────────────────────
function persist(auth: AuthState) {
  localStorage.setItem("OWNER_TOKEN",      auth.token);
  localStorage.setItem("OWNER_STORE_ID",   auth.storeId);
  localStorage.setItem("OWNER_NAME",       auth.ownerName);
  localStorage.setItem("OWNER_ID",         auth.ownerId);
  localStorage.setItem("OWNER_PHONE",      auth.phone);
  localStorage.setItem("OWNER_STORE_NAME", auth.storeName);
  localStorage.setItem("OWNER_IS_APPROVED", String(auth.isApproved));
  localStorage.setItem("OWNER_ROLE",       auth.role);
}

// ─── Read from localStorage (for app reload) ──────────────────────────────────
export function readAuth(): AuthState | null {
  const token      = localStorage.getItem("OWNER_TOKEN");
  const storeId    = localStorage.getItem("OWNER_STORE_ID") || "";
  const storeName  = localStorage.getItem("OWNER_STORE_NAME") || "";
  const ownerName  = localStorage.getItem("OWNER_NAME") || "";
  const ownerId    = localStorage.getItem("OWNER_ID") || "";
  const phone      = localStorage.getItem("OWNER_PHONE") || "";
  const isApproved = localStorage.getItem("OWNER_IS_APPROVED") === "true";
  const role       = localStorage.getItem("OWNER_ROLE") || "owner";
  if (token && token !== "pending") return { token, storeId, storeName, ownerName, ownerId, phone, isApproved, role };
  if (token === "pending") return { token: "", storeId, storeName, ownerName, ownerId, phone, isApproved: false, role };
  return null;
}

export function clearAuth() {
  localStorage.removeItem("OWNER_TOKEN");
  localStorage.removeItem("OWNER_STORE_ID");
  localStorage.removeItem("OWNER_NAME");
  localStorage.removeItem("OWNER_ID");
  localStorage.removeItem("OWNER_PHONE");
  localStorage.removeItem("OWNER_STORE_NAME");
  localStorage.removeItem("OWNER_IS_APPROVED");
  localStorage.removeItem("OWNER_ROLE");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string): Promise<AuthState | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/login", { email, password });
      if (res.data?.success) {
        const { token, owner, store, isApproved } = res.data.data;
        const auth: AuthState = {
          token,
          storeId:   store?._id || "",
          storeName: store?.name || "",
          ownerName: owner.name,
          ownerId:   owner.id || "",
          phone:     (owner as any).phone || "",
          isApproved: isApproved ?? false,
          role:      owner.role || "owner",
        };
        persist(auth);
        return auth;
      }
      setError(res.data?.message || "Login failed");
      return null;
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Could not connect to server";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    storeName: string,
    phone: string,
    upiId?: string
  ): Promise<AuthState | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/register", { name, email, password, storeName, phone, upiId });
      if (res.data?.success) {
        const { owner, store } = res.data.data;
        // After register, owner is not yet approved — persist with isApproved: false
        const auth: AuthState = {
          token: "",  // No token on register — must login after approval
          storeId: store.id || "",
          storeName: store.name,
          ownerName: owner.name,
          isApproved: false,
          role: "owner",
          ownerId: owner.id || "",
          phone: "",
        };
        // Persist minimal info so waiting screen can show
        localStorage.setItem("OWNER_NAME", owner.name);
        localStorage.setItem("OWNER_STORE_NAME", store.name);
        localStorage.setItem("OWNER_IS_APPROVED", "false");
        localStorage.setItem("OWNER_TOKEN", "pending"); // marker so waiting screen triggers
        return auth;
      }
      setError(res.data?.message || "Registration failed");
      return null;
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Could not connect to server";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (
    email: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.patch("/auth/owner/reset-password", { email, currentPassword, newPassword });
      if (res.data?.success) return true;
      setError(res.data?.message || "Reset failed. Please try again.");
      return false;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not connect to server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 1 — Send OTP to email ────────────────────────────
  const forgotSendOtp = async (email: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/forgot/send-otp", { email });
      if (res.data?.success) return true;
      setError(res.data?.message || "Failed to send OTP.");
      return false;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not connect to server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 2 — Verify OTP → get resetToken ─────────────────
  const forgotVerifyOtp = async (email: string, otp: string): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/forgot/verify-otp", { email, otp });
      if (res.data?.success) return res.data.data.resetToken as string;
      setError(res.data?.message || "OTP verification failed.");
      return null;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not connect to server.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Step 3 — Set new password ─────────────────────────────
  const forgotResetPassword = async (resetToken: string, newPassword: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/forgot/reset", { resetToken, newPassword });
      if (res.data?.success) return true;
      setError(res.data?.message || "Password reset failed.");
      return false;
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not connect to server.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { login, register, resetPassword, forgotSendOtp, forgotVerifyOtp, forgotResetPassword, loading, error, setError };
};
