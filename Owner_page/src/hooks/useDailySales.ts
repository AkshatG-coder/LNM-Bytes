import { useState, useEffect, useCallback } from "react";
import api from "./api";
import { getStoreId } from "./config";

export type DailySalesItem = {
  _id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: { name: string; quantity: number; price: number }[];
};

export type DailySalesData = {
  totalRevenue: number;
  orderCount: number;
  avgOrderValue: number;
  topItem: { name: string; qty: number } | null;
  orders: DailySalesItem[];
};

const EMPTY: DailySalesData = {
  totalRevenue: 0,
  orderCount: 0,
  avgOrderValue: 0,
  topItem: null,
  orders: [],
};

export const useDailySales = () => {
  const [data, setData] = useState<DailySalesData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/order/sales/daily/${getStoreId()}`);
      if (res.data?.success) {
        setData(res.data.data ?? EMPTY);
      } else {
        setError("Failed to load sales data");
      }
    } catch (err) {
      console.error("Failed to fetch daily sales:", err);
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSales();
    // Refresh every 60 seconds
    const interval = setInterval(fetchSales, 60_000);
    return () => clearInterval(interval);
  }, [fetchSales]);

  return { data, loading, error, refresh: fetchSales };
};
