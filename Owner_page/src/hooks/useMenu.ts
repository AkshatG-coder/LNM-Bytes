import { useState, useEffect, useCallback } from "react";
import type { MenuItem, MenuCategory } from "../types";
import api from "./api";
import { getStoreId } from "./config";

export type NewMenuItem = {
  name: string;
  price: number;       // full price
  hasHalf: boolean;
  halfPrice?: number;
  category: MenuCategory;
  isVeg: boolean;
  isAvailable: boolean;
};

export const useMenu = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/menu_item/store/${getStoreId()}`);
      if (response.data?.success) {
        setItems(response.data.data || []);
      } else {
        setError("Failed to load menu items");
      }
    } catch (err) {
      console.error("Failed to fetch menu items:", err);
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addItem = async (item: NewMenuItem): Promise<boolean> => {
    try {
      setSaving(true);
      setError(null);
      const payload = {
        ...item,
        halfPrice: item.hasHalf ? item.halfPrice : null,
      };
      const response = await api.post(`/menu_item/create/${getStoreId()}`, payload);
      if (response.data?.success) {
        await fetchItems();
        return true;
      }
      setError(response.data?.message || "Failed to add item");
      return false;
    } catch (err) {
      console.error("Failed to add item:", err);
      setError("Failed to add menu item");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateItem = async (id: string, payload: Partial<MenuItem>): Promise<boolean> => {
    try {
      setSaving(true);
      setError(null);
      const response = await api.patch(`/menu_item/upd/${id}`, payload);
      if (response.data?.success) {
        await fetchItems();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update item:", err);
      setError("Failed to update menu item");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string): Promise<boolean> => {
    try {
      setSaving(true);
      setError(null);
      await api.delete(`/menu_item/del/${id}`);
      await fetchItems();
      return true;
    } catch (err) {
      console.error("Failed to delete item:", err);
      setError("Failed to delete menu item");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item: MenuItem): Promise<boolean> => {
    return updateItem(item._id, { isAvailable: !item.isAvailable });
  };

  return {
    items, loading, saving, error,
    addItem, updateItem, deleteItem, toggleAvailability,
    refreshItems: fetchItems,
    STORE_ID: getStoreId(),
  };
};
