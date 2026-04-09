import { useState, useEffect } from "react";
import { type UserData, type OrderStatus } from "../types";
import api from "./api";
import { getStoreId } from "./config";

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
        // ── KEY FIX: userId here is the ORDER _id (used as the accordion key
        //    and passed to action handlers as the orderId)
        userId: order._id as string,

        // ── User info from denormalized fields on the order document
        userName:    order.userName  || `Order #${(order._id as string).slice(-6).toUpperCase()}`,
        userEmail:   order.userEmail || "—",
        userPhone:   order.userPhone || null,

        paymentType:   order.paymentType   || "cash",
        paymentStatus: order.paymentStatus || "pending",
        status:        order.status as OrderStatus,
        totalAmount:   order.totalAmount,
        createdAt:     order.createdAt,

        orders: (order.items || []).map((item: any, idx: number) => ({
          id:          item._id || item.menuItemId || String(idx),
          itemName:    item.name || `Item #${String(item.menuItemId || "").slice(-4)}`,
          quantity:    item.quantity,
          price:       item.price,
          portionSize: item.portionSize || "full",
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
    const interval = setInterval(fetchOrders, 15_000);   // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  // orderId in all handlers = order._id (mapped as userId above)
  const callEndpoint = async (action: string, orderId: string) => {
    try {
      await api.patch(`/order/${action}/${orderId}`);
      fetchOrders();
    } catch (err) {
      console.error(`Failed to call /order/${action}:`, err);
    }
  };

  const acceptOrder = (orderId: string) => callEndpoint("accept", orderId);
  const rejectOrder = (orderId: string) => {
    if (window.confirm("Reject this order? The student will be notified."))
      callEndpoint("reject", orderId);
  };
  const markReady   = (orderId: string) => callEndpoint("ready", orderId);

  return {
    users,
    loading,
    error,
    acceptOrder,
    rejectOrder,
    markReady,
    refreshOrders: fetchOrders,
    STORE_ID: getStoreId(),
  };
};