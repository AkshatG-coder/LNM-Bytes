import { useState } from "react";
import api from "./api";

export interface AuthState {
  token: string;
  storeId: string;
  storeName: string;
  ownerName: string;
}

// ─── Persist to localStorage ──────────────────────────────────────────────────
function persist(auth: AuthState) {
  localStorage.setItem("OWNER_TOKEN", auth.token);
  localStorage.setItem("OWNER_STORE_ID", auth.storeId);
  localStorage.setItem("OWNER_NAME", auth.ownerName);
  localStorage.setItem("OWNER_STORE_NAME", auth.storeName);
}

// ─── Read from localStorage (for app reload) ──────────────────────────────────
export function readAuth(): AuthState | null {
  const token = localStorage.getItem("OWNER_TOKEN");
  const storeId = localStorage.getItem("OWNER_STORE_ID");
  const storeName = localStorage.getItem("OWNER_STORE_NAME") || "";
  const ownerName = localStorage.getItem("OWNER_NAME") || "";
  if (token && storeId) return { token, storeId, storeName, ownerName };
  return null;
}

export function clearAuth() {
  localStorage.removeItem("OWNER_TOKEN");
  localStorage.removeItem("OWNER_STORE_ID");
  localStorage.removeItem("OWNER_NAME");
  localStorage.removeItem("OWNER_STORE_NAME");
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string): Promise<AuthState | null> => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.post("/auth/login", { email, password });
      if (res.data?.success) {
        const { token, owner, store } = res.data.data;
        const auth: AuthState = {
          token,
          storeId: store._id,
          storeName: store.name,
          ownerName: owner.name,
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
      const res = await api.post("/auth/register", { name, email, password, storeName });
      if (res.data?.success) {
        const { token, owner, store } = res.data.data;
        const auth: AuthState = {
          token,
          storeId: store._id,
          storeName: store.name,
          ownerName: owner.name,
        };
        persist(auth);
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
