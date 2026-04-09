import { useState } from 'react';
import { type UserData, type OrderStatus } from '../types';

interface UserAccordionProps extends UserData {
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onReady:  (orderId: string) => void;
}

// "accepted" removed — flow is: pending → preparing → ready
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '🆕 NEW ORDER',  cls: 'bg-yellow-900/50 text-yellow-200 border border-yellow-700/50' },
  preparing: { label: '🍳 PREPARING',  cls: 'bg-orange-900/50 text-orange-200 border border-orange-700/50' },
  ready:     { label: '✅ READY',       cls: 'bg-green-900/50  text-green-200  border border-green-700/50'  },
  delivered: { label: '🚀 DELIVERED',  cls: 'bg-purple-900/50 text-purple-200 border border-purple-700/50' },
  cancelled: { label: '❌ CANCELLED',  cls: 'bg-red-900/50    text-red-200    border border-red-700/50'    },
};

const UserAccordion = ({
  userId, userName, userEmail, userPhone, paymentType, paymentStatus,
  orders, status, totalAmount,
  onAccept, onReject, onReady,
}: UserAccordionProps) => {
  const [isOpen, setIsOpen] = useState(status === 'pending'); // auto-open new orders

  const grandTotal = totalAmount ??
    orders.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;

  const paymentBadge = paymentType === 'online'
    ? { icon: '💳', label: 'Online', cls: paymentStatus === 'paid' ? 'bg-green-800/40 text-green-300 border-green-700/40' : 'bg-yellow-800/40 text-yellow-300 border-yellow-700/40', sublabel: paymentStatus === 'paid' ? 'Paid' : 'Pending' }
    : { icon: '💵', label: 'Cash', cls: 'bg-slate-700/60 text-slate-300 border-slate-600/40', sublabel: 'At Counter' };

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-lg ${
      status === 'pending' ? 'bg-gray-800 border-yellow-700/40' :
      status === 'preparing' ? 'bg-gray-800 border-orange-700/30' :
      'bg-gray-800 border-gray-700'
    }`}>

      {/* ── HEADER ── */}
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
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${paymentBadge.cls}`}>
              {paymentBadge.icon} {paymentBadge.label} · {paymentBadge.sublabel}
            </span>
          </div>

          {/* Email + Phone always visible in header */}
          <div className="text-xs flex items-center gap-2 font-medium flex-wrap">
            <span className="bg-gray-700 px-2 py-0.5 rounded font-mono text-gray-300">
              #{userId.slice(-6).toUpperCase()}
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-blue-400 truncate max-w-[200px]">✉️ {userEmail}</span>
            {userPhone && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-green-400 font-bold">📞 +91 {userPhone}</span>
              </>
            )}
            {!userPhone && (
              <span className="text-gray-600 italic">no phone</span>
            )}
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

      {/* ── EXPANDED CONTENT ── */}
      {isOpen && (
        <div className="border-t border-gray-700 bg-gray-800/50 p-5 animate-fade-in">

          {/* Student profile */}
          <div className="mb-4 p-3 rounded-xl bg-gray-900/50 border border-gray-700/50 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Student</div>
              <div className="text-sm font-bold text-gray-200">{userName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Email</div>
              <div className="text-xs font-medium text-blue-400 break-all">{userEmail}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Phone</div>
              {userPhone
                ? <div className="text-sm font-bold text-green-400">+91 {userPhone}</div>
                : <div className="text-sm text-gray-600 italic">Not provided</div>
              }
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Payment</div>
              <div className="text-sm font-bold text-orange-300">{paymentBadge.icon} {paymentBadge.label} ({paymentBadge.sublabel})</div>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto rounded-lg border border-gray-700 bg-gray-900/30">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-900/50 text-gray-400 uppercase text-xs tracking-wider">
                  <th className="py-3 px-4 font-semibold">Item</th>
                  <th className="py-3 px-4 font-semibold">Portion</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {orders.map(order => (
                  <tr key={`${order.id}-${order.portionSize}`} className="text-gray-300 hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-white">{order.itemName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${order.portionSize === 'full' ? 'bg-orange-900/50 text-orange-300' : 'bg-blue-900/50 text-blue-300'}`}>
                        {order.portionSize === 'full' ? '🍱 Full' : '🍜 Half'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-400">₹{order.price}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-700 text-xs font-bold text-gray-300">×{order.quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-200">₹{order.price * order.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-700">
                  <td colSpan={4} className="py-3 px-4 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Total</td>
                  <td className="py-3 px-4 text-right text-lg font-black text-orange-400">₹{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action buttons — 2-step flow: pending → preparing → ready */}
          <div className="mt-5 flex justify-end gap-3 pt-4 border-t border-gray-700/50">

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
                  ✅ Accept & Start Preparing
                </button>
              </>
            )}

            {status === 'preparing' && (
              <button
                onClick={e => { e.stopPropagation(); onReady(userId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/20 transition-all active:scale-95"
              >
                🛎️ Mark as Ready for Pickup
              </button>
            )}

            {status === 'ready' && (
              <div className="flex items-center gap-2 text-green-400 font-black text-sm bg-green-900/20 px-4 py-2.5 rounded-xl border border-green-800/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Ready for Pickup — Student Notified ✅
              </div>
            )}

            {status === 'cancelled' && (
              <div className="flex items-center gap-2 text-red-400 font-black text-sm bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-800/30">
                ❌ Order Cancelled
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccordion;