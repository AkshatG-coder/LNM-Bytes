import { useState } from "react";
import api from "./api";

export interface AuthState {
  token: string;
  storeId: string;
  storeName: string;
  ownerName: string;
  isApproved: boolean;
  role: string;
}

// ─── Persist to localStorage ──────────────────────────────────────────────────
function persist(auth: AuthState) {
  localStorage.setItem("OWNER_TOKEN", auth.token);
  localStorage.setItem("OWNER_STORE_ID", auth.storeId);
  localStorage.setItem("OWNER_NAME", auth.ownerName);
  localStorage.setItem("OWNER_STORE_NAME", auth.storeName);
  localStorage.setItem("OWNER_IS_APPROVED", String(auth.isApproved));
  localStorage.setItem("OWNER_ROLE", auth.role);
}

// ─── Read from localStorage (for app reload) ──────────────────────────────────
export function readAuth(): AuthState | null {
  const token = localStorage.getItem("OWNER_TOKEN");
  const storeId = localStorage.getItem("OWNER_STORE_ID") || "";
  const storeName = localStorage.getItem("OWNER_STORE_NAME") || "";
  const ownerName = localStorage.getItem("OWNER_NAME") || "";
  const isApproved = localStorage.getItem("OWNER_IS_APPROVED") === "true";
  const role = localStorage.getItem("OWNER_ROLE") || "owner";
  // Superadmin may not have a storeId — allow token alone
  if (token && token !== "pending") return { token, storeId, storeName, ownerName, isApproved, role };
  // Pending marker (registered but not yet approved)
  if (token === "pending") return { token: "", storeId, storeName, ownerName, isApproved: false, role };
  return null;
}

export function clearAuth() {
  localStorage.removeItem("OWNER_TOKEN");
  localStorage.removeItem("OWNER_STORE_ID");
  localStorage.removeItem("OWNER_NAME");
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
          storeId: store?._id || "",
          storeName: store?.name || "",
          ownerName: owner.name,
          isApproved: isApproved ?? false,
          role: owner.role || "owner",
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
    storeName: string
  ): Promise<AuthState | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/owner/register", { name, email, password, storeName });
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

  return { login, register, loading, error, setError };
};
