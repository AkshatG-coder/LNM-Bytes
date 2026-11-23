import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ScanLine, CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
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
        <h1 className="text-3xl font-extrabold tracking-tight">Scan QR</h1>
        <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
          Scan the student's QR code to verify and hand over the order
        </p>
      </header>

      <div className="max-w-md mx-auto">

        {/* ── IDLE ── */}
        {scanState === "idle" && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-28 h-28 rounded-xl bg-primary text-on-primary flex items-center justify-center">
              <ScanLine className="w-14 h-14" aria-hidden />
            </div>
            <div className="text-center">
              <p className="font-display font-extrabold text-xl">Ready to scan</p>
              <p className="text-sm mt-1" style={{ color: "var(--color-text-muted)" }}>
                Ask the student to show their QR code from the "My Orders" page
              </p>
            </div>
            <button
              onClick={startScanner}
              className="px-8 py-3 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark active:scale-95"
            >
              Start camera
            </button>
          </div>
        )}

        {/* ── SCANNING ── */}
        {isScanning && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm font-bold text-brand animate-pulse">Point the camera at the QR code</p>
            <button
              onClick={() => { stopScanner(); reset(); }}
              className="px-4 py-2 rounded-lg text-sm font-bold border hover:bg-surface-2"
            >
              ✕ Cancel
            </button>
          </div>
        )}

        {/* ── The scanner div is ALWAYS in the DOM; visibility controlled by CSS ── */}
        <div
          id={SCANNER_ID}
          className={`w-full rounded-xl overflow-hidden border-2 border-primary/30 shadow-xl mt-4 ${isScanning ? "block" : "hidden"}`}
        />

        {/* ── LOADING ── */}
        {scanState === "loading" && (
          <div className="flex flex-col items-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm font-black text-brand animate-pulse">Verifying order…</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {scanState === "success" && order && (
          <div className="rounded-xl border overflow-hidden">
            {/* Status banner */}
            <div className="bg-green-100 dark:bg-green-400/20 px-6 py-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-700 dark:text-green-300" aria-hidden />
              <div>
                <p className="font-display font-extrabold text-green-900 dark:text-green-200 text-lg">Order verified</p>
                <p className="text-xs text-green-800 dark:text-green-300 font-medium">QR used. Order marked as picked up.</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Token number — bold & prominent */}
              {order.orderNumber && (
                <div className="flex flex-col items-center py-4">
                  <p className="text-[11px] uppercase tracking-widest font-bold mb-2" style={{ color: "var(--color-text-muted)" }}>Token number</p>
                  <div className="bg-primary text-on-primary font-display font-extrabold text-5xl px-10 py-4 rounded-xl tnum">
                    #{order.orderNumber}
                  </div>
                </div>
              )}

              {/* Cash collection banner */}
              {order.paymentType === "cash" && order.paymentStatus === "pending" && (
                <div className="p-5 bg-primary text-on-primary rounded-xl mb-4 text-center">
                  <p className="text-xs font-extrabold uppercase tracking-widest mb-1 opacity-80">Collect cash</p>
                  <p className="font-display text-4xl font-extrabold tnum">₹{order.totalAmount}</p>
                </div>
              )}
              
              {/* Online payment banner */}
              {order.paymentType === "online" && order.paymentStatus === "paid" && (
                <div className="p-4 bg-green-100 dark:bg-green-400/20 rounded-xl mb-4 text-center">
                  <p className="text-xs font-extrabold text-green-900 dark:text-green-200 uppercase tracking-widest mb-1">Paid online</p>
                  <p className="text-base font-bold text-green-900 dark:text-green-200">No cash to collect</p>
                </div>
              )}

              {/* Student info */}
              <div
                className="p-4 rounded-xl border space-y-2"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
              >
                <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--color-text-muted)" }}>Student</p>
                <p className="font-black text-lg" style={{ color: 'var(--color-text-main)' }}>{order.userName}</p>
                <p className="text-sm">{order.userEmail}</p>
                {order.userPhone && <p className="text-sm font-bold">+91 {order.userPhone}</p>}
              </div>

              {/* Order summary */}
              <div
                className="p-4 rounded-xl border space-y-3"
                style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
              >
                <p className="text-[11px] uppercase tracking-widest font-bold" style={{ color: "var(--color-text-muted)" }}>Items</p>
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="font-medium" style={{ color: 'var(--color-text-main)' }}>
                        {item.name}
                        {item.portionSize === "half" && (
                          <span className="ml-1 text-[10px] font-bold uppercase bg-surface-2 px-1.5 py-0.5 rounded">Half</span>
                        )}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>×{item.quantity} · ₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-2 flex justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase" style={{ color: "var(--color-text-muted)" }}>Total</span>
                  <span className="font-display font-extrabold text-xl tnum">₹{order.totalAmount}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-medium">
                    {order.paymentType === "cash" ? "Cash" : "Online"} ·{" "}
                    <span className={order.paymentStatus === "paid" ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}>
                      {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </span>
                  </span>
                  <span>{fmt(order.createdAt)}</span>
                </div>
              </div>

              {/* Hand over banner */}
              <div className="p-4 rounded-xl bg-surface-2 text-center">
                <p className="font-bold">Hand the food to the student.</p>
              </div>

              <button
                onClick={reset}
                className="w-full py-3 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark active:scale-95"
              >
                Scan next order
              </button>
            </div>
          </div>
        )}

        {/* ── ALREADY USED ── */}
        {scanState === "already_used" && (
          <div className="rounded-xl border-2 border-primary p-8 flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="w-12 h-12 text-brand" aria-hidden />
            <p className="font-display font-extrabold text-xl">Already used</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>This QR code has already been scanned and verified.</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark">
              Scan Another
            </button>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {scanState === "expired" && (
          <div className="rounded-xl border-2 border-primary p-8 flex flex-col items-center gap-4 text-center">
            <Clock className="w-12 h-12 text-brand" aria-hidden />
            <p className="font-display font-extrabold text-xl">QR code expired</p>
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>This QR code is older than 1 hour. Ask the student to refresh their order page.</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark">
              Scan Another
            </button>
          </div>
        )}

        {/* ── OTHER ERROR ── */}
        {scanState === "error" && (
          <div className="rounded-xl border-2 p-8 flex flex-col items-center gap-4 text-center" style={{ borderColor: "var(--bad)" }}>
            <XCircle className="w-12 h-12" style={{ color: "var(--bad)" }} aria-hidden />
            <p className="font-display font-extrabold text-xl">Verification failed</p>
            <p className="text-sm max-w-xs" style={{ color: "var(--color-text-muted)" }}>{errorMsg || "Invalid QR code. Make sure you're scanning a valid LNM Bytes order QR."}</p>
            <button onClick={reset} className="px-6 py-2.5 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark">
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
