import { useState, useEffect } from "react";
import type { Store } from "../types";
import api from "./api";
import { getStoreId } from "./config";


export const useStore = () => {
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/store_handler/${getStoreId()}`);
      if (response.data?.success) {
        setStore(response.data.data);
      } else {
        setError("Failed to load store details");
      }
    } catch (err) {
      console.error("Failed to fetch store:", err);
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStore();
  }, []);

  const updateStore = async (payload: Partial<Store>): Promise<boolean> => {
    try {
      setSaving(true);
      setError(null);
      const response = await api.put(`/store_handler/${getStoreId()}`, payload);
      if (response.data?.success !== false) {
        await fetchStore();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update store:", err);
      setError("Failed to save changes");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (): Promise<boolean> => {
    try {
      setSaving(true);
      const response = await api.patch(`/store_handler/${getStoreId()}/status`);
      if (response.data?.success !== false) {
        await fetchStore();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to toggle status:", err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { store, loading, saving, error, updateStore, toggleStatus, refreshStore: fetchStore, STORE_ID: getStoreId() };
};
