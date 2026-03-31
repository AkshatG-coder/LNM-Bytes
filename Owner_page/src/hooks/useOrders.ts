import { useState, useEffect } from "react";
import { type UserData, type OrderStatus } from "../types";
import api from "./api";
import { getStoreId } from "./config";

// ─── Backend Order shape ────────────────────────────────────────────────────
// items: [{ _id, menuItemId, quantity, price }]  — note: no 'name' in item schema
// status enum: pending | accepted | preparing | ready | delivered | cancelled

export const useOrders = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/order/store/${getStoreId()}`);

      if (!response.data?.success) {
        setUsers([]);
        return;
      }

      const rawOrders: any[] = response.data.data || [];

      const transformedData: UserData[] = rawOrders.map((order) => ({
        // userId holds the order _id — used as the key AND as the id passed to action handlers
        userId: order._id as string,
        userName: `Order #${(order._id as string).slice(-6).toUpperCase()}`,
        status: order.status as OrderStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        orders: (order.items || []).map((item: any, idx: number) => ({
          id: item._id || item.menuItemId || String(idx),
          // Backend OrderItemSchema has no 'name' field — show a short ID as fallback
          itemName: item.name ?? `Item #${String(item.menuItemId).slice(-4)}`,
          quantity: item.quantity,
          price: item.price,
        })),
      }));

      setUsers(transformedData);
    } catch (err: any) {
      console.error("Failed to fetch orders:", err);
      setError("Could not connect to the server");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 20 seconds
    const interval = setInterval(fetchOrders, 20_000);
    return () => clearInterval(interval);
  }, []);

  // ─── Status transitions mapped to real backend endpoints ─────────────────
  const callEndpoint = async (action: string, orderId: string) => {
    try {
      await api.patch(`/order/${action}/${orderId}`);
      fetchOrders();
    } catch (err) {
      console.error(`Failed to call /order/${action}:`, err);
    }
  };

  // pending → accepted
  const acceptOrder = (orderId: string) => callEndpoint("accept", orderId);

  // pending → cancelled
  const rejectOrder = (orderId: string) => {
    if (window.confirm("Reject this order?")) callEndpoint("reject", orderId);
  };

  // accepted → preparing
  const completeOrder = (orderId: string) => callEndpoint("preparing", orderId);

  // accepted → preparing (alias for completeOrder used in UserAccordion)
  const markPreparing = (orderId: string) => callEndpoint("preparing", orderId);

  // preparing → ready
  const markReady = (orderId: string) => callEndpoint("ready", orderId);

  return {
    users,
    loading,
    error,
    acceptOrder,
    rejectOrder,
    completeOrder,  // accepted → preparing (used as "Mark Preparing")
    markPreparing,
    markReady,
    refreshOrders: fetchOrders,
    STORE_ID: getStoreId(),
  };
};