import { useDailySales } from "../hooks/useDailySales";
import type { DailySalesItem } from "../hooks/useDailySales";

// ─── Status badge styling — works in both light and dark mode ─────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: "Pending",   bg: "bg-amber-100/80 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-300"  },
  accepted:  { label: "Accepted",  bg: "bg-blue-100/80 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-300"   },
  preparing: { label: "Preparing", bg: "bg-primary/10 dark:bg-primary/20",      text: "text-primary"                       },
  ready:     { label: "Ready",     bg: "bg-green-100/80 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-300" },
  delivered: { label: "Delivered", bg: "bg-purple-100/80 dark:bg-purple-900/30",text: "text-purple-700 dark:text-purple-300"},
  cancelled: { label: "Cancelled", bg: "bg-red-100/80 dark:bg-red-900/30",      text: "text-red-600 dark:text-red-400"    },
};

function fmt(n: number) {
  return n.toLocaleString("en-IN");
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// ─── Order row ────────────────────────────────────────────────────────────────
function OrderRow({ order }: { order: DailySalesItem }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const itemNames = order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ");

  return (
    <tr className="border-b hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-3.5 px-5 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{order._id.slice(-6).toUpperCase()}</td>
      <td className="py-3.5 px-5 text-sm font-medium max-w-[220px] truncate" style={{ color: 'var(--color-text-main)' }} title={itemNames}>{itemNames}</td>
      <td className="py-3.5 px-5 text-sm font-black text-primary">₹{fmt(order.totalAmount)}</td>
      <td className="py-3.5 px-5">
        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </td>
      <td className="py-3.5 px-5 text-sm" style={{ color: 'var(--color-text-muted)' }}>{timeStr(order.createdAt)}</td>
    </tr>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, accent }: {
  label: string; value: string; icon: string; color: string; accent: string;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-2 transition-transform hover:scale-[1.02]"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${accent}`}>
          {icon}
        </span>
      </div>
      <span className={`text-2xl sm:text-3xl font-black truncate ${color}`} title={value}>
        {value}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function DailySales() {
  const { data, loading, error, refresh } = useDailySales();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const stats = [
    {
      label: "Total Revenue",
      value: loading ? "—" : `₹${fmt(data.totalRevenue)}`,
      icon: "💰",
      color: "text-primary",
      accent: "bg-primary/10",
    },
    {
      label: "Orders Today",
      value: loading ? "—" : String(data.orderCount),
      icon: "📦",
      color: "text-secondary-dark",
      accent: "bg-secondary-light/10",
    },
    {
      label: "Avg. Order Value",
      value: loading ? "—" : `₹${fmt(data.avgOrderValue)}`,
      icon: "📊",
      color: "text-indigo-600 dark:text-indigo-400",
      accent: "bg-indigo-500/10",
    },
    {
      label: "Top Item",
      value: loading ? "—" : data.topItem ? `${data.topItem.name} (×${data.topItem.qty})` : "—",
      icon: "🏆",
      color: "text-green-600 dark:text-green-400",
      accent: "bg-green-500/10",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-8 gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Daily Sales
          </h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {today}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black transition-all disabled:opacity-50 self-start sm:self-auto border"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-muted)',
          }}
        >
          {loading ? "⏳" : "🔄"} Refresh
        </button>
      </header>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 text-red-700 dark:text-red-400 font-bold text-sm">
          ⚠️ {error} — Make sure the backend is running.
        </div>
      )}

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* ── Orders Table ── */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        {/* Table header bar */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="font-black text-sm" style={{ color: 'var(--color-text-main)' }}>
            Today's Orders
          </h2>
          <span
            className="text-xs font-black px-3 py-1 rounded-full"
            style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-background)' }}
          >
            {data.orders.length} orders
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
            <p className="text-primary font-black text-xs uppercase tracking-widest animate-pulse">Loading orders...</p>
          </div>
        ) : data.orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="text-6xl mb-4 opacity-30">📋</span>
            <p className="font-black" style={{ color: 'var(--color-text-muted)' }}>No orders yet today</p>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>
              Orders will appear here once placed
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr style={{ backgroundColor: 'var(--color-background)' }}>
                  {["Order ID", "Items", "Amount", "Status", "Time"].map((h) => (
                    <th key={h} className="py-3 px-5 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((order) => (
                  <OrderRow key={order._id} order={order} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DailySales;
