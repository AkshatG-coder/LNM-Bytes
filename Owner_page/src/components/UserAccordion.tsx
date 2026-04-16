import { useState } from 'react';
import { type UserData } from '../types';

interface UserAccordionProps extends UserData {
  onAccept: (orderId: string) => void;
  onReject: (orderId: string) => void;
  onReady:  (orderId: string) => void;
  orderNumber?: number;
}

// Status badge — now uses theme-aware classes that work in both modes
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: '🆕 NEW ORDER',  cls: 'bg-yellow-100 text-yellow-800 border border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-700/50' },
  preparing: { label: '🍳 PREPARING',  cls: 'bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-700/50' },
  ready:     { label: '✅ READY',       cls: 'bg-green-100  text-green-800  border border-green-300  dark:bg-green-900/50  dark:text-green-200  dark:border-green-700/50'  },
  delivered: { label: '🚀 DELIVERED',  cls: 'bg-purple-100 text-purple-800 border border-purple-300 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-700/50' },
  cancelled: { label: '❌ CANCELLED',  cls: 'bg-red-100    text-red-800    border border-red-300    dark:bg-red-900/50    dark:text-red-200    dark:border-red-700/50'    },
};

const UserAccordion = ({
  userId, userName, userEmail, userPhone, paymentType, paymentStatus,
  orders, status, totalAmount, orderNumber,
  onAccept, onReject, onReady,
}: UserAccordionProps) => {
  const [isOpen, setIsOpen] = useState(status === 'pending');

  const grandTotal = totalAmount ??
    orders.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;

  const paymentBadge = paymentType === 'online'
    ? {
        icon: '💳', label: 'Online',
        cls: paymentStatus === 'paid'
          ? 'bg-green-100 text-green-700 border border-green-200 dark:bg-green-800/40 dark:text-green-300 dark:border-green-700/40'
          : 'bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-800/40 dark:text-yellow-300 dark:border-yellow-700/40',
        sublabel: paymentStatus === 'paid' ? 'Paid' : 'Pending',
      }
    : {
        icon: '💵', label: 'Cash',
        cls: 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700/60 dark:text-slate-300 dark:border-slate-600/40',
        sublabel: 'At Counter',
      };

  // Card border changes by status
  const cardBorder =
    status === 'pending'   ? 'border-yellow-300 dark:border-yellow-700/40' :
    status === 'preparing' ? 'border-orange-300 dark:border-orange-700/30' :
                             'border-gray-200 dark:border-gray-700';

  return (
    <div
      className={`border rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-lg ${cardBorder}`}
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      {/* ── HEADER ── */}
      <div
        onClick={() => setIsOpen(o => !o)}
        className="p-5 cursor-pointer flex justify-between items-center gap-4"
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base truncate" style={{ color: 'var(--color-text-main)' }}>
              {userName}
            </span>
            {orderNumber && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black font-mono bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                #{orderNumber}
              </span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${badge.cls}`}>
              {badge.label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${paymentBadge.cls}`}>
              {paymentBadge.icon} {paymentBadge.label} · {paymentBadge.sublabel}
            </span>
          </div>

          {/* Email + Phone */}
          <div className="text-xs flex items-center gap-2 font-medium flex-wrap">
            <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded font-mono text-gray-500 dark:text-gray-300">
              #{userId.slice(-6).toUpperCase()}
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-blue-500 dark:text-blue-400 truncate max-w-[200px]">✉️ {userEmail}</span>
            {userPhone && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-green-600 dark:text-green-400 font-bold">📞 +91 {userPhone}</span>
              </>
            )}
            {!userPhone && (
              <span className="text-gray-400 italic">no phone</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Bill</div>
            <div className="font-black text-orange-500 text-xl">₹{grandTotal}</div>
          </div>
          <div className={`w-8 h-8 flex items-center justify-center rounded-full transition-transform duration-300 ${
            isOpen
              ? 'rotate-180 bg-gray-100 dark:bg-gray-700 text-orange-500'
              : 'bg-gray-100/50 dark:bg-gray-700/50 text-gray-400'
          }`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── EXPANDED CONTENT ── */}
      {isOpen && (
        <div
          className="border-t p-5 animate-fade-in"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          {/* Student profile */}
          <div
            className="mb-4 p-3 rounded-xl border grid grid-cols-2 sm:grid-cols-4 gap-3"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Student</div>
              <div className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>{userName}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Email</div>
              <div className="text-xs font-medium text-blue-500 dark:text-blue-400 break-all">{userEmail}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Phone</div>
              {userPhone
                ? <div className="text-sm font-bold text-green-600 dark:text-green-400">+91 {userPhone}</div>
                : <div className="text-sm text-gray-400 italic">Not provided</div>
              }
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-1">Payment</div>
              <div className="text-sm font-bold text-orange-500">{paymentBadge.icon} {paymentBadge.label} ({paymentBadge.sublabel})</div>
            </div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-sm text-left">
              <thead>
                <tr
                  className="text-gray-500 uppercase text-xs tracking-wider"
                  style={{ backgroundColor: 'var(--color-background)' }}
                >
                  <th className="py-3 px-4 font-semibold">Item</th>
                  <th className="py-3 px-4 font-semibold">Portion</th>
                  <th className="py-3 px-4 font-semibold text-right">Price</th>
                  <th className="py-3 px-4 font-semibold text-center">Qty</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody style={{ borderColor: 'var(--color-border)' }} className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {orders.map(order => (
                  <tr key={`${order.id}-${order.portionSize}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="py-3 px-4 font-medium" style={{ color: 'var(--color-text-main)' }}>{order.itemName}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        order.portionSize === 'full'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}>
                        {order.portionSize === 'full' ? '🍱 Full' : '🍜 Half'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-gray-500">₹{order.price}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300">×{order.quantity}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold" style={{ color: 'var(--color-text-main)' }}>₹{order.price * order.quantity}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td colSpan={4} className="py-3 px-4 text-right text-xs font-black text-gray-400 uppercase tracking-wider">Total</td>
                  <td className="py-3 px-4 text-right text-lg font-black text-orange-500">₹{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Action buttons */}
          <div className="mt-5 flex flex-wrap justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            {status === 'pending' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); onReject(userId); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-black text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 border border-transparent hover:border-red-200 dark:hover:border-red-500/30 transition-all"
                >
                  ❌ Reject
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onAccept(userId); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all active:scale-95"
                >
                  ✅ Accept & Start Preparing
                </button>
              </>
            )}

            {status === 'preparing' && (
              <button
                onClick={e => { e.stopPropagation(); onReady(userId); }}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-white bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/20 transition-all active:scale-95"
              >
                🛎️ Mark as Ready for Pickup
              </button>
            )}

            {status === 'ready' && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-black text-sm bg-green-50 dark:bg-green-900/20 px-4 py-2.5 rounded-xl border border-green-200 dark:border-green-800/30">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                Ready for Pickup — Student Notified ✅
              </div>
            )}

            {status === 'cancelled' && (
              <div className="flex items-center gap-2 text-red-500 font-black text-sm bg-red-50 dark:bg-red-900/20 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800/30">
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