import { RefreshCw, IndianRupee, Receipt, TrendingUp, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDailySales } from "../hooks/useDailySales";
import type { DailySalesItem } from "../hooks/useDailySales";
import { StatsCard } from "../components/StatsCard";

// Status pills: same colours as the Kitchen page
const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:   { label: "New",       cls: "bg-primary text-on-primary" },
  accepted:  { label: "Accepted",  cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-200" },
  preparing: { label: "Preparing", cls: "bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-200" },
  ready:     { label: "Ready",     cls: "bg-green-100 text-green-900 dark:bg-green-400/20 dark:text-green-200" },
  delivered: { label: "Picked up", cls: "bg-surface-2" },
  cancelled: { label: "Cancelled", cls: "bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-200" },
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
    <tr className="border-b hover:bg-surface-2" style={{ borderColor: 'var(--color-border)' }}>
      <td className="py-3 px-5 text-xs font-bold tnum" style={{ color: 'var(--color-text-muted)' }}>#{order._id.slice(-4).toUpperCase()}</td>
      <td className="py-3 px-5 text-sm font-medium max-w-[260px] truncate" title={itemNames}>{itemNames}</td>
      <td className="py-3 px-5 text-sm font-extrabold tnum">₹{fmt(order.totalAmount)}</td>
      <td className="py-3 px-5">
        <span className={`text-[11px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md ${cfg.cls}`}>{cfg.label}</span>
      </td>
      <td className="py-3 px-5 text-sm tnum" style={{ color: 'var(--color-text-muted)' }}>{timeStr(order.createdAt)}</td>
    </tr>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function DailySales() {
  const { data, loading, error, refresh } = useDailySales();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const stats: { title: string; value: string; Icon: LucideIcon; tone?: "ink" }[] = [
    { title: "Revenue", value: loading ? "—" : `₹${fmt(data.totalRevenue)}`, Icon: IndianRupee, tone: "ink" },
    { title: "Orders today", value: loading ? "—" : String(data.orderCount), Icon: Receipt },
    { title: "Average order", value: loading ? "—" : `₹${fmt(data.avgOrderValue)}`, Icon: TrendingUp },
    { title: "Top item", value: loading ? "—" : data.topItem ? `${data.topItem.name} ×${data.topItem.qty}` : "—", Icon: Trophy },
  ];

  return (
    <div className="animate-fade-in max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{today}</p>
          <h1 className="text-3xl font-extrabold tracking-tight mt-1">Daily sales</h1>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold border disabled:opacity-50 hover:bg-surface-2"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && (
        <div role="alert" className="mb-6 p-4 rounded-lg border text-sm font-semibold" style={{ borderColor: 'var(--bad)', color: 'var(--bad)' }}>
          {error}. Make sure the backend is running.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {stats.map((s) => (
          <StatsCard key={s.title} {...s} />
        ))}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="font-display font-extrabold text-lg">Today's orders</h2>
          <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-surface-2 tnum">
            {data.orderCount} {data.orderCount === 1 ? "order" : "orders"}{data.orders.length > data.orderCount ? ` · ${data.orders.length - data.orderCount} cancelled` : ""}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading orders">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg animate-pulse bg-surface-2" />)}
          </div>
        ) : data.orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="w-9 h-9 mb-3" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
            <p className="font-display text-lg font-bold">No orders yet today</p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Orders show up here as soon as they are placed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-2">
                  {["Token", "Items", "Amount", "Status", "Time"].map((h) => (
                    <th key={h} className="py-2.5 px-5 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{h}</th>
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
