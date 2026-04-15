import { useState, useEffect, useRef } from "react";
import { type UserData, type OrderStatus } from "../types";
import api from "./api";
import { getStoreId } from "./config";
import { useOrderSound } from "./useOrderSound";

export const useOrders = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  const { playNewOrderAlert } = useOrderSound();

  // Refs for things that should NOT cause re-renders / effect re-runs ─────────
  const knownOrderIds  = useRef<Set<string>>(new Set());
  const initialised    = useRef(false);
  const playRef        = useRef(playNewOrderAlert); // always latest, never triggers deps
  const wsConnectedRef = useRef(false);

  // Keep playRef fresh without it being a reactive dep
  useEffect(() => { playRef.current = playNewOrderAlert; }, [playNewOrderAlert]);

  // ── Core fetch ──────────────────────────────────────────────────────────────
  // Defined as a plain function — NOT useCallback — so it never changes identity.
  // Called from interval and WS message handler via ref.
  const fetchRef = useRef(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/order/store/${getStoreId()}`);
      if (!response.data?.success) { setUsers([]); return; }

      const rawOrders: any[] = response.data.data || [];

      // Detect new pending orders (skip on first load)
      if (initialised.current) {
        const newPending = rawOrders.filter(
          (o) => o.status === "pending" && !knownOrderIds.current.has(o._id)
        );
        if (newPending.length > 0) {
          playRef.current();
          if (Notification.permission === "granted") {
            new Notification(
              `🔥 ${newPending.length} new order${newPending.length > 1 ? "s" : ""}!`,
              { body: newPending.map((o) => `Order #${String(o._id).slice(-6)}`).join(", ") }
            );
          }
        }
      }

      rawOrders.forEach((o) => knownOrderIds.current.add(o._id));
      initialised.current = true;

      setUsers(
        rawOrders.map((order) => ({
          userId:        order._id as string,
          orderNumber:   order.orderNumber ?? undefined,
          userName:      order.userName  || `Order #${String(order._id).slice(-6).toUpperCase()}`,
          userEmail:     order.userEmail || "—",
          userPhone:     order.userPhone || null,
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
        }))
      );
    } catch (err: any) {
      console.error("Failed to fetch orders:", err);
      setError("Could not connect to the server");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  });

  // Stable public handle for other callers (Refresh button, WS push)
  const fetchOrders = () => fetchRef.current();

  // ── Polling — single interval, never recreated ──────────────────────────────
  useEffect(() => {
    fetchRef.current();                               // initial load
    const id = setInterval(() => {
      fetchRef.current();
    }, wsConnectedRef.current ? 40_000 : 30_000);
    return () => clearInterval(id);
  }, []); // ← empty deps: runs ONCE, no loops

  // ── WebSocket — stable connection ───────────────────────────────────────────
  useEffect(() => {
    const storeId = getStoreId();
    if (!storeId) return;

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Automatically derive WS_URL from VITE_API_URL to ensure wss:// on https://
    const apiHost = import.meta.env.VITE_API_URL || "http://localhost:8081";
    const WS_URL = apiHost.replace(/^http/, "ws");
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "register", userId: storeId }));
      setWsConnected(true);
      wsConnectedRef.current = true;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "newOrder") {
          playRef.current();        // instant alert on push
          fetchRef.current();       // refresh list
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => { setWsConnected(false); wsConnectedRef.current = false; };
    ws.onerror = () => { setWsConnected(false); wsConnectedRef.current = false; };

    return () => ws.close();
  }, []); // ← empty deps: single stable WS connection

  // ── Status mutations ────────────────────────────────────────────────────────
  const callEndpoint = async (action: string, orderId: string) => {
    try {
      await api.patch(`/order/${action}/${orderId}`);
      fetchRef.current();
    } catch (err) {
      console.error(`Failed to call /order/${action}:`, err);
    }
  };

  const acceptOrder = (orderId: string) => callEndpoint("accept", orderId);
  const rejectOrder = (orderId: string) => {
    if (window.confirm("Reject this order? The student will be notified."))
      callEndpoint("reject", orderId);
  };
  const markReady = (orderId: string) => callEndpoint("ready", orderId);

  return { users, loading, error, wsConnected, acceptOrder, rejectOrder, markReady, refreshOrders: fetchOrders, STORE_ID: getStoreId() };
};