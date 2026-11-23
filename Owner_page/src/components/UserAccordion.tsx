import { useState } from 'react';
import { ChevronDown, Phone, Mail, Check, BellRing, X, Banknote, CreditCard } from 'lucide-react';
import { type UserData } from '../types';
import RejectReasonPicker, { type RejectPayload } from './RejectReasonPicker';

interface UserAccordionProps extends UserData {
  onAccept: (orderId: string) => void;
  onReject: (orderId: string, payload?: RejectPayload) => void;
  onReady:  (orderId: string) => void;
  orderNumber?: number;
}

// Status pill colours work on both light and dark surfaces
const STATUS: Record<string, { label: string; cls: string; edge: string }> = {
  pending:   { label: 'New',       cls: 'bg-primary text-on-primary',                                   edge: 'var(--color-primary)' },
  preparing: { label: 'Preparing', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-400/20 dark:text-sky-200',    edge: '#38BDF8' },
  ready:     { label: 'Ready',     cls: 'bg-green-100 text-green-900 dark:bg-green-400/20 dark:text-green-200', edge: '#22C55E' },
  delivered: { label: 'Picked up', cls: 'bg-surface-2',                                                  edge: 'var(--color-border)' },
  cancelled: { label: 'Cancelled', cls: 'bg-red-100 text-red-900 dark:bg-red-400/20 dark:text-red-200',    edge: '#EF4444' },
};

const UserAccordion = ({
  userId, userName, userEmail, userPhone, paymentType, paymentStatus,
  orders, status, totalAmount, orderNumber,
  onAccept, onReject, onReady,
}: UserAccordionProps) => {
  const [isOpen, setIsOpen] = useState(status === 'pending');
  const [rejecting, setRejecting] = useState(false);

  const grandTotal = totalAmount ?? orders.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const itemCount = orders.reduce((n, o) => n + o.quantity, 0);
  const st = STATUS[status] ?? STATUS.pending;
  const token = orderNumber ? `#${orderNumber}` : `#${userId.slice(-4).toUpperCase()}`;

  const paid = paymentType === 'online' && paymentStatus === 'paid';
  const payLabel = paymentType === 'online' ? (paid ? 'Paid online' : 'Online, not paid') : 'Cash';
  const PayIcon = paymentType === 'online' ? CreditCard : Banknote;

  const panelId = `order-${userId}`;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeft: `4px solid ${st.edge}` }}
    >
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="w-full text-left p-4 sm:p-5 flex items-center gap-3 sm:gap-4"
      >
        <span className="font-display font-extrabold text-xl sm:text-2xl tnum w-14 sm:w-[4.5rem] flex-shrink-0">{token}</span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold truncate">{userName}</span>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide ${st.cls}`}>{st.label}</span>
          </span>
          <span className="mt-1 flex items-center gap-x-1.5 gap-y-0.5 flex-wrap text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
            <PayIcon className="w-3.5 h-3.5" aria-hidden />
            {payLabel}
            <span aria-hidden>·</span>
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </span>
        </span>

        <span className="text-right flex-shrink-0">
          <span className="block font-display font-extrabold text-xl tnum">₹{grandTotal}</span>
        </span>
        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--color-text-muted)' }} aria-hidden />
      </button>

      {isOpen && (
        <div id={panelId} className="border-t animate-fade-in" style={{ borderColor: 'var(--color-border)' }}>
          <div className="px-4 sm:px-5 pt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <a href={`mailto:${userEmail}`} className="flex items-center gap-1.5 hover:underline min-w-0" onClick={e => e.stopPropagation()}>
              <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
              <span className="truncate">{userEmail}</span>
            </a>
            {userPhone ? (
              <a href={`tel:+91${userPhone}`} className="flex items-center gap-1.5 font-bold hover:underline" onClick={e => e.stopPropagation()}>
                <Phone className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} aria-hidden />
                +91 {userPhone}
              </a>
            ) : (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <Phone className="w-4 h-4" aria-hidden /> No phone number
              </span>
            )}
          </div>

          {/* Items, printed like a menu board: name ..... price */}
          <ul className="px-4 sm:px-5 py-4 space-y-2.5">
            {orders.map(order => (
              <li key={`${order.id}-${order.portionSize}`} className="flex items-baseline gap-2 text-[15px]">
                <span className="font-bold tnum w-8 flex-shrink-0">{order.quantity}×</span>
                <span className="font-semibold">{order.itemName}</span>
                {order.portionSize === 'half' && (
                  <span className="text-[11px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-surface-2">Half</span>
                )}
                <span className="leader" aria-hidden />
                <span className="font-bold tnum">₹{order.price * order.quantity}</span>
              </li>
            ))}
          </ul>

          <div className="mx-4 sm:mx-5 perf" />
          <div className="px-4 sm:px-5 py-3 flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total</span>
            <span className="font-display font-extrabold text-2xl tnum">₹{grandTotal}</span>
          </div>

          <div className="px-4 sm:px-5 pb-4 flex flex-wrap items-center justify-end gap-2.5">
            {status === 'pending' && rejecting && (
              <RejectReasonPicker
                paidOnline={paid}
                onCancel={() => setRejecting(false)}
                onConfirm={payload => { onReject(userId, payload); setRejecting(false); }}
              />
            )}
            {status === 'pending' && !rejecting && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); setRejecting(true); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold border hover:bg-surface-2"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--bad)' }}
                >
                  <X className="w-4 h-4" /> Reject
                </button>
                <button
                  onClick={e => { e.stopPropagation(); onAccept(userId); }}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-extrabold bg-primary text-on-primary hover:bg-primary-dark active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" /> Accept and start preparing
                </button>
              </>
            )}

            {status === 'preparing' && (
              <button
                onClick={e => { e.stopPropagation(); onReady(userId); }}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-extrabold bg-primary text-on-primary hover:bg-primary-dark active:scale-[0.98]"
              >
                <BellRing className="w-4 h-4" /> Mark ready for pickup
              </button>
            )}

            {status === 'ready' && (
              <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--ok)' }}>
                <Check className="w-4 h-4" /> Ready. The student has been notified.
              </p>
            )}

            {status === 'cancelled' && (
              <p className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--bad)' }}>
                <X className="w-4 h-4" /> Order cancelled
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAccordion;
