import { useDailySales } from "../hooks/useDailySales";
import type { DailySalesItem } from "../hooks/useDailySales";

// ─── Status badge styling ─────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pending:   { label: "Pending",   bg: "bg-amber-50",   text: "text-amber-700"  },
  accepted:  { label: "Accepted",  bg: "bg-blue-50",    text: "text-blue-700"   },
  preparing: { label: "Preparing", bg: "bg-primary/5",  text: "text-primary"    },
  ready:     { label: "Ready",     bg: "bg-green-50",   text: "text-green-700"  },
  delivered: { label: "Delivered", bg: "bg-purple-50",  text: "text-purple-700" },
  cancelled: { label: "Cancelled", bg: "bg-red-50",     text: "text-red-600"    },
};

// ─── Small helpers ────────────────────────────────────────────────────────────
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
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      <td className="py-3 px-4 text-xs font-mono text-gray-400">{order._id.slice(-6).toUpperCase()}</td>
      <td className="py-3 px-4 text-xs text-gray-600 max-w-[200px] truncate" title={itemNames}>{itemNames}</td>
      <td className="py-3 px-4 text-xs font-black text-primary">₹{fmt(order.totalAmount)}</td>
      <td className="py-3 px-4">
        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-400">{timeStr(order.createdAt)}</td>
    </tr>
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
      bg: "bg-primary/5",
      border: "border-primary/10",
    },
    {
      label: "Orders Today",
      value: loading ? "—" : String(data.orderCount),
      icon: "📦",
      color: "text-secondary-dark",
      bg: "bg-secondary-light/10",
      border: "border-secondary-light/20",
    },
    {
      label: "Avg. Order Value",
      value: loading ? "—" : `₹${fmt(data.avgOrderValue)}`,
      icon: "📊",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-100",
    },
    {
      label: "Top Item",
      value: loading ? "—" : data.topItem ? `${data.topItem.name} (×${data.topItem.qty})` : "—",
      icon: "🏆",
      color: "text-green-600",
      bg: "bg-green-50",
      border: "border-green-100",
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Daily Sales</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">{today}</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-600 hover:border-primary/30 hover:text-primary transition-all shadow-sm disabled:opacity-50 self-start sm:self-auto"
        >
          {loading ? "⏳" : "🔄"} Refresh
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 font-bold text-sm">
          ⚠️ {error} — Make sure the backend is running on port 8081.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s) => (
          <div key={s.label} className={`card border ${s.border} ${s.bg} flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{s.label}</span>
              <span className="text-2xl">{s.icon}</span>
            </div>
            <span className={`text-2xl font-black ${s.color} truncate`} title={s.value}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-black text-gray-700 text-sm">Today's Orders</h2>
          <span className="text-xs font-black text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
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
            <p className="font-black text-gray-500">No orders yet today</p>
            <p className="text-gray-400 text-sm font-medium mt-1">Orders will appear here once placed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Order ID</th>
                  <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Items</th>
                  <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Amount</th>
                  <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
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

      {/* Revenue breakdown by status */}
      {!loading && data.orders.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {(["ready", "preparing", "cancelled"] as const).map((status) => {
            const cfg = STATUS_CONFIG[status];
            const count = data.orders.filter((o) => o.status === status).length;
            const revenue = data.orders
              .filter((o) => o.status === status)
              .reduce((acc, o) => acc + o.totalAmount, 0);
            return (
              <div key={status} className={`rounded-2xl border p-4 ${cfg.bg} border-transparent flex flex-col gap-1`}>
                <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text} opacity-70`}>{cfg.label}</span>
                <span className={`text-xl font-black ${cfg.text}`}>{count} orders</span>
                {status !== "cancelled" && (
                  <span className="text-xs font-medium text-gray-500">₹{fmt(revenue)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DailySales;
