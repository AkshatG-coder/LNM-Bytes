import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../hooks/api";

type ScannedOrder = {
  _id: string;
  orderNumber?: number;
  userName: string;
  userEmail: string;
  userPhone?: string | null;
  totalAmount: number;
  paymentType: string;
  paymentStatus: string;
  status: string;
  items: { name: string; quantity: number; price: number; portionSize?: string }[];
  createdAt: string;
};

type ScanState = "idle" | "scanning" | "loading" | "success" | "error" | "already_used" | "expired";

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export default function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanState, setScanState]         = useState<ScanState>("idle");
  const [order, setOrder]                 = useState<ScannedOrder | null>(null);
  const [errorMsg, setErrorMsg]           = useState("");
  const [cameraStarted, setCameraStarted] = useState(false);
  const processingRef                     = useRef(false);
  const SCANNER_ID = "qr-reader";

  // ── Start camera ────────────────────────────────────────────────────────────
  async function startScanner() {
    setOrder(null);
    setErrorMsg("");
    setScanState("scanning");

    // Tiny delay so React can commit the DOM update that makes #qr-reader visible
    // before Html5Qrcode tries to attach to it.
    await new Promise((res) => setTimeout(res, 80));

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(SCANNER_ID);
      }
      await scannerRef.current.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScan,
        () => {}  // suppress per-frame errors
      );
      setCameraStarted(true);
    } catch (err) {
      console.error("Camera error:", err);
      setErrorMsg("Could not access camera. Please allow camera permission.");
      setScanState("error");
    }
  }

  // ── Stop camera ─────────────────────────────────────────────────────────────
  async function stopScanner() {
    if (scannerRef.current && cameraStarted) {
      try { await scannerRef.current.stop(); } catch (_) {}
      setCameraStarted(false);
    }
  }

  // ── On QR decoded ─────────────────────────────────────────────────────────
  async function handleScan(rawText: string) {
    if (processingRef.current) return;
    processingRef.current = true;
    
    await stopScanner();
    setScanState("loading");

    try {
      const parsed = JSON.parse(rawText);
      const token: string = parsed.token;
      if (!token) throw new Error("Invalid QR format");

      const res = await api.post("/order/verify-qr", { token });
      if (res.data?.success) {
        setOrder(res.data.data);
        setScanState("success");
      } else {
        const msg: string = res.data?.message || "Verification failed";
        if (msg.toLowerCase().includes("already")) setScanState("already_used");
        else if (msg.toLowerCase().includes("expired")) setScanState("expired");
        else setScanState("error");
        setErrorMsg(msg);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Invalid QR code or network error";
      if (msg.toLowerCase().includes("already")) setScanState("already_used");
      else if (msg.toLowerCase().includes("expired")) setScanState("expired");
      else setScanState("error");
      setErrorMsg(msg);
    }
  }

  function reset() {
    processingRef.current = false;
    setOrder(null);
    setErrorMsg("");
    setScanState("idle");
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopScanner(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isScanning = scanState === "scanning";

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--text-main)" }}>
          📷 QR Order Verification
        </h1>
        <p className="text-sm font-medium mt-1" style={{ color: "var(--text-muted)" }}>
          Scan the student's QR code to verify and hand over the order
        </p>
      </header>

      <div className="max-w-md mx-auto">

        {/* ── IDLE ── */}
        {scanState === "idle" && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-32 h-32 rounded-3xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-6xl">
              📷
            </div>
            <div className="text-center">
              <p className="font-black text-lg" style={{ color: "var(--text-main)" }}>Ready to Scan</p>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                Ask the student to show their QR code from the "My Orders" page
              </p>
            </div>
            <button
              onClick={startScanner}
              className="px-8 py-3 rounded-2xl bg-primary text-white font-black text-sm shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95"
            >
              📷 Start Camera
            </button>
          </div>
        )}

        {/* ── SCANNING ── */}
        {isScanning && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-bold text-primary animate-pulse">🔍 Point camera at QR code…</p>
            <button
              onClick={() => { stopScanner(); reset(); }}
              className="px-4 py-2 rounded-xl text-sm font-black text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-all"
            >
              ✕ Cancel
            </button>
          </div>
        )}

        {/* ── The scanner div is ALWAYS in the DOM; visibility controlled by CSS ── */}
        <div
          id={SCANNER_ID}
          className={`w-full rounded-2xl overflow-hidden border-2 border-primary/30 shadow-xl mt-4 ${isScanning ? "block" : "hidden"}`}
        />

        {/* ── LOADING ── */}
        {scanState === "loading" && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-black text-primary animate-pulse">Verifying order…</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {scanState === "success" && order && (
          <div className="rounded-2xl border-2 border-green-500/40 bg-green-900/10 overflow-hidden">
            {/* Status banner */}
            <div className="bg-green-500/20 px-6 py-4 flex items-center gap-3">
              <span className="text-3xl">✅</span>
              <div>
                <p className="font-black text-green-400 text-lg">Order Verified!</p>
                <p className="text-xs text-green-500/80 font-medium">QR used — order marked as Delivered</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Token number — bold & prominent */}
              {order.orderNumber && (
                <div className="flex flex-col items-center py-4">
                  <p className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-2">Token Number</p>
                  <div className="bg-green-500 text-white font-black text-5xl px-10 py-4 rounded-2xl shadow-lg shadow-green-500/30 tracking-wider">
                    #{order.orderNumber}
                  </div>
                </div>
              )}

              {/* Cash collection banner */}
              {order.paymentType === "cash" && order.paymentStatus === "pending" && (
                <div className="p-5 bg-yellow-500/20 border-2 border-yellow-500/50 rounded-xl mb-4 text-center animate-pulse">
                  <p className="text-xs font-black text-yellow-500 uppercase tracking-widest mb-1">Cash Collection Required</p>
                  <p className="text-3xl font-black text-yellow-400">Collect ₹{order.totalAmount}</p>
                </div>
              )}
              
              {/* Online payment banner */}
              {order.paymentType === "online" && order.paymentStatus === "paid" && (
                <div className="p-4 bg-green-500/20 border-2 border-green-500/40 rounded-xl mb-4 text-center">
                  <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-1">Paid Online ✅</p>
                  <p className="text-lg font-black text-green-500">No cash collection required</p>
                </div>
              )}

              {/* Student info */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
              >
                <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Student</p>
                <p className="font-black text-lg" style={{ color: 'var(--color-text-main)' }}>{order.userName}</p>
                <p className="text-blue-500 dark:text-blue-400 text-sm">✉️ {order.userEmail}</p>
                {order.userPhone && <p className="text-green-600 dark:text-green-400 text-sm">📞 +91 {order.userPhone}</p>}
              </div>

              {/* Order summary */}
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
              >
                <p className="text-[10px] uppercase tracking-widest font-black text-gray-400">Items</p>
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                        {item.name}
                        {item.portionSize === "half" && (
                          <span className="ml-1 text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 px-1.5 py-0.5 rounded-full">Half</span>
                        )}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>×{item.quantity} · ₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-black text-gray-400 uppercase">Total</span>
                  <span className="font-black text-orange-500 text-xl">₹{order.totalAmount}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-medium">
                    {order.paymentType === "cash" ? "💵 Cash" : "💳 Online"} ·{" "}
                    <span className={order.paymentStatus === "paid" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}>
                      {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </span>
                  </span>
                  <span>{fmt(order.createdAt)}</span>
                </div>
              </div>

              {/* Hand over banner */}
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-center">
                <p className="font-black text-primary">🎉 Hand over the food to the student!</p>
              </div>

              <button
                onClick={reset}
                className="w-full py-3 rounded-2xl bg-primary text-white font-black text-sm hover:bg-primary-dark transition-all active:scale-95"
              >
                📷 Scan Next Order
              </button>
            </div>
          </div>
        )}

        {/* ── ALREADY USED ── */}
        {scanState === "already_used" && (
          <div className="rounded-2xl border-2 border-yellow-500/40 bg-yellow-900/10 p-8 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">⚠️</span>
            <p className="font-black text-yellow-400 text-xl">Already Used</p>
            <p className="text-yellow-500/80 text-sm font-medium">This QR code has already been scanned and verified.</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-xl bg-yellow-500/20 text-yellow-300 font-black text-sm border border-yellow-500/30 hover:bg-yellow-500/30 transition-all">
              Scan Another
            </button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {scanState === "expired" && (
          <div className="rounded-2xl border-2 border-orange-500/40 bg-orange-900/10 p-8 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">⏰</span>
            <p className="font-black text-orange-400 text-xl">QR Code Expired</p>
            <p className="text-orange-500/80 text-sm font-medium">This QR code is older than 1 hour. Ask the student to refresh their order page.</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-xl bg-orange-500/20 text-orange-300 font-black text-sm border border-orange-500/30 hover:bg-orange-500/30 transition-all">
              Scan Another
            </button>
          </div>
        )}

        {/* ── OTHER ERROR ── */}
        {scanState === "error" && (
          <div className="rounded-2xl border-2 border-red-500/40 bg-red-900/10 p-8 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">❌</span>
            <p className="font-black text-red-400 text-xl">Verification Failed</p>
            <p className="text-red-400/80 text-sm font-medium max-w-xs">{errorMsg || "Invalid QR code. Make sure you're scanning a valid LNM Bytes order QR."}</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-xl bg-red-500/20 text-red-300 font-black text-sm border border-red-500/30 hover:bg-red-500/30 transition-all">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
