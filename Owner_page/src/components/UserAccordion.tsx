import { useState } from 'react';
import { type UserData, type OrderStatus } from '../types';

interface UserAccordionProps extends UserData {
  onAccept:    (orderId: string) => void;  // pending   → accepted
  onReject:    (orderId: string) => void;  // pending   → cancelled
  onPreparing: (orderId: string) => void;  // accepted  → preparing
  onReady:     (orderId: string) => void;  // preparing → ready
}

// ─── Status badge config — maps every real backend status ────────────────────
const STATUS_BADGE: Record<OrderStatus, { label: string; cls: string }> = {
  pending:   { label: 'NEW ORDER',  cls: 'bg-yellow-900/50 text-yellow-200 border border-yellow-700/50' },
  accepted:  { label: 'ACCEPTED',  cls: 'bg-blue-900/50   text-blue-200   border border-blue-700/50'   },
  preparing: { label: 'PREPARING', cls: 'bg-orange-900/50 text-orange-200 border border-orange-700/50' },
  ready:     { label: 'READY ✅',  cls: 'bg-green-900/50  text-green-200  border border-green-700/50'  },
  delivered: { label: 'DELIVERED', cls: 'bg-purple-900/50 text-purple-200 border border-purple-700/50' },
  cancelled: { label: 'CANCELLED', cls: 'bg-red-900/50    text-red-200    border border-red-700/50'    },
};

const UserAccordion = ({
  userId, userName, orders, status, totalAmount,
  onAccept, onReject, onPreparing, onReady,
}: UserAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Use backend totalAmount when available; compute from items as fallback
  const grandTotal = totalAmount ??
    orders.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-lg hover:border-gray-600">

      {/* ── HEADER (clickable) ─────────────────────────────────────────────── */}
      <div
        onClick={() => setIsOpen(o => !o)}
        className="p-5 cursor-pointer flex justify-between items-center gap-4"
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-100 text-base truncate">{userName}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="text-xs text-gray-400 flex items-center gap-2 font-medium">
            <span className="bg-gray-700 px-2 py-0.5 rounded font-mono text-gray-300">
              #{userId.slice(-6).toUpperCase()}
            </span>
            <span className="text-gray-600">·</span>
            <span>{orders.length} item{orders.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Bill</div>
            <div className="font-black text-orange-400 text-xl">₹{grandTotal}</div>
          </div>
          <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-transform duration-300 ${isOpen ? 'rotate-180 bg-gray-700 text-orange-400' : 'bg-gray-700/50 text-gray-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── EXPANDED CONTENT ───────────────────────────────────────────────── */}
      {isOpen && (
        <div className="border-t border-gray-700 bg-gray-800/50 p-5 animate-fade-in">

          {/* Items table */}
          <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/30">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                  <th className="py-3 px-4 font-semibold">Item</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {orders.map(order => (
                  <tr key={order.id} className="text-gray-300 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{order.itemName}</td>
                    <td className="py-3 px-4 text-right text-gray-400">₹{order.price}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-700 text-xs font-bold text-gray-300">×{order.quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-200">₹{order.price * order.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Action buttons — each step drives a real backend transition ── */}
          <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-gray-700/50">

            {/* pending: Accept or Reject */}
            {status === 'pending' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onReject(userId); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-black text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                >
                  ❌ Reject
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onAccept(userId); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
                >
                  ✅ Accept Order
                </button>
              </>
            )}

            {/* accepted: Mark as Preparing */}
            {status === 'accepted' && (
              <button
                onClick={e => { e.stopPropagation(); onPreparing(userId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
              >
                🍳 Start Preparing
              </button>
            )}

            {/* preparing: Mark as Ready */}
            {status === 'preparing' && (
              <button
                onClick={e => { e.stopPropagation(); onReady(userId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all active:scale-95"
              >
                🛎️ Mark as Ready
              </button>
            )}

            {/* ready: display-only badge */}
            {status === 'ready' && (
              <div className="flex items-center gap-2 text-green-400 font-black text-sm bg-green-900/20 px-4 py-2.5 rounded-xl border border-green-800/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Ready for Pickup
              </div>
            )}

            {/* delivered */}
            {status === 'delivered' && (
              <div className="flex items-center gap-2 text-purple-400 font-black text-sm bg-purple-900/20 px-4 py-2.5 rounded-xl border border-purple-800/30">
                🚀 Delivered
              </div>
            )}

            {/* cancelled */}
            {status === 'cancelled' && (
              <div className="flex items-center gap-2 text-red-400 font-black text-sm bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-800/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Order Cancelled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccordion;