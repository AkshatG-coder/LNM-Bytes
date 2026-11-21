import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../Util/api';
import { useAppDispatch, useAppSelector } from '../Util/hook';
import { add_item, clear_all_item, decrease_item, increase_item } from '../Util/CartReducer';

// ─── Types: mirror Backend/src/utils/bitebotHelpers.ts ───────────────────────
export interface UiMenuItem {
  id: string;
  name: string;
  price: number;
  halfPrice: number | null;
  hasHalf: boolean;
  isVeg: boolean;
  category: string;
  rating: number;
  storeId: string;
  storeName: string;
  storeOpen: boolean;
  onlineAvailable: boolean;
  timesOrdered?: number;
}

export interface UiStore {
  id: string;
  name: string;
  location: string;
  foodType: string;
  openTime: string;
  closeTime: string;
  nightDelivery: boolean;
  orderableNow: boolean;
  status: string;
}

export interface UiOrder {
  id: string;
  orderNumber: number;
  status: string;
  storeName: string;
  items: string;
  totalAmount: number;
  paymentType: string;
  paymentStatus?: string;
  placedAt?: string;
  /** Why the canteen rejected the order, when it did. */
  rejectionText?: string;
}

export interface DraftLine {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  portionSize: 'full' | 'half';
  isVeg?: boolean;
}

export interface OrderDraft {
  storeId: string;
  storeName: string;
  items: DraftLine[];
  subtotal: number;
  deliveryType: 'pickup' | 'night_delivery';
  deliveryCharge: number;
  total: number;
  nightDeliveryAvailable: boolean;
  nightDeliveryCharge: number;
  issues: string[];
  notes: string[];
  canPlace: boolean;
  createdAt: string;
}

export type UiBlock =
  | { type: 'menu_items'; title?: string; items: UiMenuItem[]; hiddenCount?: number }
  | { type: 'stores'; stores: UiStore[] }
  | { type: 'orders'; orders: UiOrder[] }
  | { type: 'order_draft'; draft: OrderDraft };

const BRAND = '#ea580c';
const DRAFT_TTL_MS = 10 * 60 * 1000;

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text-main)',
};
const mutedStyle: React.CSSProperties = { color: 'var(--text-muted)' };
const nums: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** A short hidden note appended to the chat history so the model knows which cards were shown. */
export function blocksToHistoryNote(blocks?: UiBlock[]): string {
  if (!blocks || blocks.length === 0) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'menu_items') {
      parts.push(
        'items shown: ' +
          b.items
            .slice(0, 8)
            .map((i) => `${i.name} at ${i.storeName} Rs${i.price} (id ${i.id})`)
            .join('; '),
      );
    } else if (b.type === 'stores') {
      parts.push('stores shown: ' + b.stores.map((s) => s.name).join('; '));
    } else if (b.type === 'orders') {
      parts.push('orders shown: ' + b.orders.map((o) => `#${o.orderNumber} ${o.status}`).join('; '));
    } else if (b.type === 'order_draft') {
      parts.push(
        `order draft shown, not placed unless the student confirms: ${b.draft.items
          .map((i) => `${i.name} x${i.quantity}`)
          .join(', ')} from ${b.draft.storeName}, total Rs${b.draft.total}`,
      );
    }
  }
  return `\n[context for you, not visible to the student: ${parts.join(' | ')}]`;
}

// ─── Small shared pieces ─────────────────────────────────────────────────────
/** Indian food-type mark: outlined square with a dot (green veg, red non-veg). */
function VegMark({ isVeg }: { isVeg: boolean }) {
  const c = isVeg ? '#16a34a' : '#dc2626';
  return (
    <span
      className="inline-flex w-3.5 h-3.5 items-center justify-center rounded-[3px] border-[1.5px] flex-shrink-0"
      style={{ borderColor: c }}
      role="img"
      aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
    </span>
  );
}

function Pin() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** Paper-slip look: dashed tear line with notches on both sides. Needs `overflow-hidden relative` parent. */
function TearLine() {
  return (
    <div className="relative h-0 my-1" aria-hidden="true">
      <div className="border-t border-dashed" style={{ borderColor: 'var(--border)' }} />
      {(['-left-2', '-right-2'] as const).map((side) => (
        <span
          key={side}
          className={`absolute ${side} -top-2 w-4 h-4 rounded-full border`}
          style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
        />
      ))}
    </div>
  );
}

const outlineBtn = 'text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors active:scale-95 disabled:opacity-40';

// ─── Menu item rows with Add buttons (same cart rules as the menu page) ──────
function ItemRow({ item }: { item: UiMenuItem }) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.Cart.items);
  const [portion, setPortion] = useState<'full' | 'half'>('full');

  const price = portion === 'half' && item.halfPrice ? item.halfPrice : item.price;
  const cartItem = cart.find((c) => c.id === item.id && c.portionSize === portion);
  const qty = cartItem?.qty ?? 0;
  const blocked = !item.storeOpen ? 'Closed' : !item.onlineAvailable ? 'Orders paused' : null;

  function add() {
    if (blocked) {
      toast.error(item.storeOpen ? 'App orders are paused for this shop' : 'This shop is closed right now');
      return;
    }
    if (cart.length > 0 && cart[0].canteen_id !== item.storeId) {
      toast.error('Your cart has items from another canteen. Clear it first to order from here.');
      return;
    }
    if (cartItem) {
      dispatch(increase_item({ id: item.id, portionSize: portion }));
    } else {
      dispatch(add_item({ id: item.id, item_name: item.name, price, qty: 1, canteen_id: item.storeId, portionSize: portion }));
    }
  }

  function remove() {
    if (qty > 0) dispatch(decrease_item({ id: item.id, portionSize: portion }));
  }

  return (
    <div className="flex items-start gap-3 px-3.5 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <VegMark isVeg={item.isVeg} />
          <p className="text-[13px] font-semibold leading-snug truncate">{item.name}</p>
        </div>
        <p className="text-xs mt-1 flex items-center gap-x-2.5 gap-y-0.5 flex-wrap" style={mutedStyle}>
          <span className="truncate max-w-[9rem]">{item.storeName}</span>
          {item.rating > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" aria-hidden="true"><path d="M12 2l3 6.9 7.5.7-5.6 5 1.7 7.4L12 18l-6.6 4 1.7-7.4-5.6-5 7.5-.7z" /></svg>
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.timesOrdered ? <span>You ordered {item.timesOrdered} {item.timesOrdered === 1 ? 'time' : 'times'}</span> : null}
        </p>
        {item.hasHalf && item.halfPrice ? (
          <div className="inline-flex mt-2 rounded-lg p-0.5 border" style={{ borderColor: 'var(--border)' }} role="group" aria-label="Portion size">
            {(['full', 'half'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPortion(p)}
                aria-pressed={portion === p}
                className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                style={portion === p ? { background: BRAND, color: 'white' } : { color: 'var(--text-muted)' }}
              >
                {p === 'full' ? 'Full' : 'Half'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-sm font-bold" style={nums}>₹{price}</span>
        {blocked ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ background: 'rgba(107,114,128,0.15)', color: 'var(--text-muted)' }}>
            {blocked}
          </span>
        ) : qty === 0 ? (
          <button
            onClick={add}
            aria-label={`Add ${item.name}`}
            className="min-w-[4.25rem] text-xs font-bold px-3 py-1.5 rounded-lg border-[1.5px] transition-colors hover:bg-orange-500/10 active:scale-95"
            style={{ borderColor: BRAND, color: BRAND }}
          >
            Add
          </button>
        ) : (
          <div className="flex items-center rounded-lg overflow-hidden text-white" style={{ background: BRAND }}>
            <button onClick={remove} className="w-7 h-7 text-base font-bold leading-none active:bg-black/10" aria-label={`Remove one ${item.name}`}>−</button>
            <span className="w-5 text-center text-xs font-bold" style={nums} aria-live="polite">{qty}</span>
            <button onClick={add} className="w-7 h-7 text-base font-bold leading-none active:bg-black/10" aria-label={`Add one more ${item.name}`}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItemsBlock({
  title,
  items,
  hiddenCount,
  onViewCart,
}: {
  title?: string;
  items: UiMenuItem[];
  hiddenCount?: number;
  onViewCart: () => void;
}) {
  const cartCount = useAppSelector((s) => s.Cart.items.reduce((n, i) => n + i.qty, 0));
  return (
    <section aria-label={title || 'Menu items'}>
      {title && <h3 className="text-[13px] font-semibold mb-1.5 px-0.5">{title}</h3>}
      <div className="rounded-xl border overflow-hidden" style={cardStyle}>
        {items.map((it) => (
          <ItemRow key={it.id} item={it} />
        ))}
        {(hiddenCount ?? 0) > 0 && (
          <p className="px-3.5 py-2.5 text-xs border-t" style={{ ...mutedStyle, borderColor: 'var(--border)' }}>
            {hiddenCount} more not shown. Ask for veg only, a budget or one canteen to narrow it down.
          </p>
        )}
        {cartCount > 0 && (
          <button
            onClick={onViewCart}
            className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-white active:brightness-95"
            style={{ background: BRAND }}
          >
            <span>{cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart</span>
            <span className="inline-flex items-center gap-1">
              View cart
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
        )}
      </div>
    </section>
  );
}

// ─── Store cards ─────────────────────────────────────────────────────────────
function StoresBlock({
  stores,
  onAsk,
  onOpenStore,
}: {
  stores: UiStore[];
  onAsk: (text: string) => void;
  onOpenStore: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border overflow-hidden" style={cardStyle}>
      {stores.map((s) => (
        <div key={s.id} className="px-3.5 py-3 border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug">{s.name}</p>
              <p className="text-xs mt-1 flex items-center gap-1" style={mutedStyle}>
                <Pin />
                <span className="truncate">{s.location || 'On campus'}</span>
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0 mt-0.5"
              style={{ color: s.orderableNow ? '#16a34a' : 'var(--text-muted)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.orderableNow ? '#16a34a' : '#9ca3af' }} />
              {s.orderableNow ? 'Taking orders' : 'Not taking orders'}
            </span>
          </div>

          <p className="text-xs mt-1.5" style={mutedStyle}>
            {s.openTime && s.closeTime ? `Open ${s.openTime} to ${s.closeTime}` : 'Hours not listed'}
            {s.foodType ? `, ${s.foodType}` : ''}
            {s.nightDelivery ? '. Night delivery available' : ''}
          </p>

          <div className="flex items-center gap-2 mt-2.5">
            <button onClick={() => onAsk(`Show the menu of ${s.name}`)} className={outlineBtn} style={{ borderColor: BRAND, color: BRAND }}>
              See menu here
            </button>
            <button onClick={() => onOpenStore(s.id)} className="text-xs font-semibold px-2 py-1.5 underline underline-offset-2" style={mutedStyle}>
              Shop page
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live order tracker (a token slip) ───────────────────────────────────────
const STEPS = ['Placed', 'Preparing', 'Ready', 'Picked up'];
const ACTIVE_STATUSES = new Set(['payment_pending', 'pending', 'accepted', 'preparing', 'ready']);

function stepIndex(status: string): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'accepted':
    case 'preparing':
      return 1;
    case 'ready':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

// Keep in sync with Backend/src/utils/rejectReasons.ts
const REJECT_TEXT: Record<string, string> = {
  out_of_stock: 'An item in your order is out of stock',
  too_busy: 'The kitchen is too busy right now',
  closing_soon: 'The canteen is closing soon',
  order_issue: 'There was a problem with the order',
  other: 'The canteen could not take this order',
};

function rejectionSentence(code?: string | null, note?: string): string {
  const base = REJECT_TEXT[code ?? 'other'] ?? REJECT_TEXT.other;
  return note ? `${base} (${note})` : base;
}

function statusHeadline(status: string): { text: string; color: string } {
  switch (status) {
    case 'pending':
      return { text: 'Waiting for the canteen to accept', color: '#d97706' };
    case 'accepted':
    case 'preparing':
      return { text: 'Being prepared', color: BRAND };
    case 'ready':
      return { text: 'Ready. Show your QR at the counter', color: '#16a34a' };
    case 'delivered':
      return { text: 'Picked up. Enjoy your meal', color: '#16a34a' };
    case 'cancelled':
      return { text: 'Cancelled', color: '#dc2626' };
    case 'rejected':
      return { text: 'Declined by the canteen', color: '#dc2626' };
    case 'payment_pending':
      return { text: 'Payment not completed', color: '#d97706' };
    default:
      return { text: status, color: 'var(--text-muted)' };
  }
}

function OrderCard({ order: initial, onViewOrders }: { order: UiOrder; onViewOrders: () => void }) {
  const [order, setOrder] = useState<UiOrder>(initial);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (manual = false) => {
      try {
        if (manual) setBusy(true);
        const { data } = await api.get(`/order/${initial.id}`);
        const o = data?.data;
        if (o?.status) {
          setOrder((prev) => ({
            ...prev,
            status: o.status,
            paymentStatus: o.paymentStatus ?? prev.paymentStatus,
            rejectionText: o.rejectionReason || o.rejectionNote ? rejectionSentence(o.rejectionReason, o.rejectionNote) : prev.rejectionText,
          }));
        }
      } catch {
        /* keep showing the last known status */
      } finally {
        if (manual) setBusy(false);
      }
    },
    [initial.id],
  );

  // Check once when the card appears, then poll while the order is still in progress.
  useEffect(() => {
    if (!ACTIVE_STATUSES.has(initial.status)) return;
    refresh();
  }, [initial.status, refresh]);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(order.status)) return;
    const timer = setInterval(() => refresh(), 20000);
    return () => clearInterval(timer);
  }, [order.status, refresh]);

  async function showQr() {
    try {
      setBusy(true);
      const { data } = await api.get(`/order/${order.id}/qr`);
      setQr(data?.data?.qrCode ?? null);
      if (!data?.data?.qrCode) toast.error('QR is not available yet.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not load the QR code.');
    } finally {
      setBusy(false);
    }
  }

  // The QR opens below the fold in a scrolling chat, so bring it into view once it loads.
  const qrRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (qr) qrRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [qr]);

  const idx = stepIndex(order.status);
  const stopped = order.status === 'cancelled' || order.status === 'rejected';
  const awaitingPayment = order.status === 'payment_pending';
  const headline =
    stopped && order.rejectionText
      ? { text: 'Declined by the canteen', color: '#dc2626' }
      : statusHeadline(order.status);

  return (
    <div className="relative rounded-xl border overflow-hidden" style={cardStyle}>
      <div className="flex items-stretch">
        <div className="px-3.5 py-3 flex flex-col justify-center items-center border-r border-dashed min-w-[4.5rem]" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs" style={mutedStyle}>Token</span>
          <span className="text-2xl font-bold leading-none mt-0.5" style={nums}>{order.orderNumber}</span>
        </div>
        <div className="px-3.5 py-3 min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-semibold truncate">{order.storeName}</p>
            <span className="text-sm font-bold flex-shrink-0" style={nums}>₹{order.totalAmount}</span>
          </div>
          <p className="text-xs mt-0.5 line-clamp-2" style={mutedStyle}>{order.items}</p>
        </div>
      </div>

      <TearLine />

      <div className="px-3.5 pt-2 pb-3">
        <p className="text-[13px] font-semibold" style={{ color: headline.color }} aria-live="polite">
          {headline.text}
        </p>
        {stopped && order.rejectionText && (
          <p className="text-xs mt-1" style={mutedStyle}>
            Reason: {order.rejectionText}.
          </p>
        )}

        {awaitingPayment ? (
          <button onClick={onViewOrders} className="mt-1.5 text-xs font-semibold underline underline-offset-2" style={{ color: BRAND }}>
            Finish payment in My Orders
          </button>
        ) : !stopped ? (
          <ol className="mt-3 flex items-start" aria-label="Order progress">
            {STEPS.map((label, i) => {
              const done = i < idx || (i === idx && idx === 3);
              const current = i === idx && idx < 3;
              return (
                <li key={label} className={`flex flex-col ${i < STEPS.length - 1 ? 'flex-1' : ''}`} aria-current={current ? 'step' : undefined}>
                  <div className="flex items-center">
                    <span className="relative flex w-4 h-4 flex-shrink-0">
                      {current && <span className="absolute inset-0 rounded-full motion-safe:animate-ping opacity-40" style={{ background: BRAND }} />}
                      <span
                        className="relative w-4 h-4 rounded-full flex items-center justify-center border-2"
                        style={{
                          background: done ? BRAND : current ? 'var(--surface)' : 'transparent',
                          borderColor: done || current ? BRAND : 'var(--border)',
                        }}
                      >
                        {done && (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                        )}
                        {current && <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />}
                      </span>
                    </span>
                    {i < STEPS.length - 1 && <span className="h-0.5 flex-1 mx-1 rounded" style={{ background: i < idx ? BRAND : 'var(--border)' }} />}
                  </div>
                  <span className="text-[11px] mt-1 font-medium whitespace-nowrap" style={{ color: i <= idx ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}

        {order.status === 'ready' && (
          <div className="mt-3">
            {qr ? (
              <div ref={qrRef} className="flex flex-col items-center gap-1.5 py-1">
                <img src={qr} alt="Pickup QR code" className="w-40 h-40 rounded-lg bg-white p-1.5 border" style={{ borderColor: 'var(--border)' }} />
                <p className="text-xs" style={mutedStyle}>Show this at the counter</p>
              </div>
            ) : (
              <button onClick={showQr} disabled={busy} className="w-full text-xs font-bold py-2 rounded-lg text-white disabled:opacity-50 active:scale-[0.98]" style={{ background: BRAND }}>
                {busy ? 'Loading QR…' : 'Show pickup QR'}
              </button>
            )}
          </div>
        )}

        {ACTIVE_STATUSES.has(order.status) && (
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[11px]" style={mutedStyle}>Updates automatically</span>
            <button onClick={() => refresh(true)} disabled={busy} className="text-[11px] font-semibold underline underline-offset-2 disabled:opacity-50" style={mutedStyle}>
              {busy ? 'Checking…' : 'Check now'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function OrdersBlock({ orders, onViewOrders }: { orders: UiOrder[]; onViewOrders: () => void }) {
  return (
    <div className="space-y-2">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} onViewOrders={onViewOrders} />
      ))}
    </div>
  );
}

// ─── Order draft (a receipt): nothing is placed until the student taps a button ─
function DraftCard({
  draft,
  onViewCart,
  onViewOrders,
}: {
  draft: OrderDraft;
  onViewCart: () => void;
  onViewOrders: () => void;
}) {
  const dispatch = useAppDispatch();
  const cart = useAppSelector((s) => s.Cart.items);
  const user = useAppSelector((s) => s.User.user);

  const [night, setNight] = useState(draft.deliveryType === 'night_delivery');
  const [placing, setPlacing] = useState(false);
  const [discarded, setDiscarded] = useState(false);
  const [placed, setPlaced] = useState<UiOrder | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);

  const charge = night && draft.nightDeliveryAvailable ? draft.nightDeliveryCharge : 0;
  const total = draft.subtotal + charge;
  const expired = Date.now() - new Date(draft.createdAt).getTime() > DRAFT_TTL_MS;
  const locked = !draft.canPlace || expired || discarded || !!placed || placing;

  async function placeOrder(paymentType: 'cash' | 'online') {
    if (!user) {
      toast.error('Please login to place an order!');
      return;
    }
    if (Date.now() - new Date(draft.createdAt).getTime() > DRAFT_TTL_MS) {
      toast.error('This draft is too old. Ask me again for fresh prices.');
      return;
    }
    setPlacing(true);
    try {
      // Same payload as the cart checkout, so the order behaves exactly the same.
      const response = await api.post('/order/create', {
        userId: user.id,
        storeId: draft.storeId,
        items: draft.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          portionSize: i.portionSize,
        })),
        totalAmount: total,
        deliveryType: night ? 'night_delivery' : 'pickup',
        paymentType,
      });

      if (!response.data?.success) {
        toast.error(response.data?.message || 'Failed to place order.');
        return;
      }

      const o = response.data.data;
      if (paymentType === 'cash') {
        toast.success("Order placed! Please pick it up at the counter after it's ready.");
        setPlaced({
          id: String(o?._id),
          orderNumber: o?.orderNumber,
          status: o?.status || 'pending',
          storeName: draft.storeName,
          items: draft.items.map((i) => `${i.name} x${i.quantity}`).join(', '),
          totalAmount: total,
          paymentType: 'cash',
          paymentStatus: o?.paymentStatus,
        });
      } else {
        // Online payment: same Cashfree flow as the cart. It redirects back to /orders to verify.
        const sessionId = o?.payment_session_id;
        if (sessionId && window.Cashfree) {
          const cashfree = window.Cashfree({ mode: 'sandbox' });
          cashfree.checkout({ paymentSessionId: sessionId });
        } else if (sessionId) {
          toast.error('Cashfree SDK not loaded. Please refresh and try again.');
        } else {
          toast.error('No payment session returned. Please try again.');
        }
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  function addToCart() {
    if (cart.length > 0 && cart[0].canteen_id !== draft.storeId) {
      const replace = window.confirm('Your cart has items from another canteen. Replace it with this order?');
      if (!replace) return;
    }
    if (cart.length > 0) dispatch(clear_all_item());
    for (const i of draft.items) {
      dispatch(
        add_item({
          id: i.menuItemId,
          item_name: i.name,
          price: i.price,
          qty: i.quantity,
          canteen_id: draft.storeId,
          portionSize: i.portionSize,
        }),
      );
    }
    setAddedToCart(true);
    toast.success('Added to your cart 🛒');
  }

  if (discarded) {
    return (
      <div className="rounded-xl border px-3.5 py-2.5 text-xs" style={{ ...cardStyle, ...mutedStyle }}>
        Draft discarded. Ask me whenever you want to order again.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-xl border overflow-hidden" style={cardStyle}>
        <div className="px-3.5 pt-3 pb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[13px] font-semibold">Your order</h3>
            <p className="text-xs mt-0.5 truncate" style={mutedStyle}>{draft.storeName}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0 mt-0.5" style={{ color: placed ? '#16a34a' : '#d97706' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: placed ? '#16a34a' : '#d97706' }} />
            {placed ? 'Placed' : 'Not placed yet'}
          </span>
        </div>

        <ul className="px-3.5 pb-2 space-y-1.5">
          {draft.items.map((i) => (
            <li key={`${i.menuItemId}-${i.portionSize}`} className="flex items-baseline gap-2 text-[13px]">
              <span className="self-center"><VegMark isVeg={i.isVeg !== false} /></span>
              <span className="min-w-0">
                {i.name}
                {i.portionSize === 'half' ? ' (half)' : ''}
                <span style={mutedStyle}> × {i.quantity}</span>
              </span>
              <span className="flex-1 border-b border-dotted translate-y-[-3px] opacity-60" style={{ borderColor: 'var(--text-muted)' }} aria-hidden="true" />
              <span className="font-medium" style={nums}>₹{i.price * i.quantity}</span>
            </li>
          ))}
        </ul>

        {draft.canPlace && draft.nightDeliveryAvailable && !placed && (
          <div className="px-3.5 pb-2">
            <button
              role="switch"
              aria-checked={night}
              onClick={() => setNight((v) => !v)}
              className="w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs">
                <span className="font-semibold">Night delivery</span>
                <span style={mutedStyle}> adds ₹{draft.nightDeliveryCharge}</span>
              </span>
              <span className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: night ? BRAND : '#9ca3af' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all" style={{ left: night ? '18px' : '2px' }} />
              </span>
            </button>
          </div>
        )}

        <TearLine />

        <div className="px-3.5 pt-2 pb-3 space-y-1">
          {charge > 0 && (
            <div className="flex justify-between text-xs" style={mutedStyle}>
              <span>Items</span>
              <span style={nums}>₹{draft.subtotal}</span>
            </div>
          )}
          {charge > 0 && (
            <div className="flex justify-between text-xs" style={mutedStyle}>
              <span>Night delivery</span>
              <span style={nums}>₹{charge}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="text-[13px] font-semibold">Total</span>
            <span className="text-lg font-bold" style={nums}>₹{total}</span>
          </div>
        </div>

        {draft.issues.length > 0 && (
          <div className="px-3.5 py-2.5 border-t text-xs font-medium space-y-0.5 text-red-700 dark:text-red-300" style={{ borderColor: 'var(--border)', background: 'rgba(239,68,68,0.10)' }} role="alert">
            {draft.issues.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}
        {draft.notes.length > 0 && (
          <div className="px-3.5 py-2.5 border-t text-xs space-y-0.5 text-amber-800 dark:text-amber-200" style={{ borderColor: 'var(--border)', background: 'rgba(245,158,11,0.12)' }}>
            {draft.notes.map((m, i) => (
              <p key={i}>{m}</p>
            ))}
          </div>
        )}
        {expired && !placed && (
          <p className="px-3.5 py-2.5 border-t text-xs font-medium text-amber-800 dark:text-amber-200" style={{ borderColor: 'var(--border)', background: 'rgba(245,158,11,0.12)' }}>
            This draft is over 10 minutes old. Ask me again to get current prices.
          </p>
        )}

        {!placed && (
          <div className="px-3.5 pb-3.5 pt-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => placeOrder('cash')}
              disabled={locked}
              className="w-full text-[13px] font-bold py-2.5 rounded-lg text-white disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ background: BRAND }}
            >
              {placing ? 'Placing order…' : `Place order, pay at counter ₹${total}`}
            </button>
            <button
              onClick={() => placeOrder('online')}
              disabled={locked}
              className="w-full text-[13px] font-bold py-2.5 rounded-lg border-[1.5px] disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              Pay online ₹{total}
            </button>
            <div className="flex items-center justify-center gap-4 pt-0.5">
              <button
                onClick={addedToCart ? onViewCart : addToCart}
                disabled={!draft.canPlace || expired || placing}
                className="text-xs font-semibold underline underline-offset-2 disabled:opacity-40"
                style={{ color: 'var(--text-main)' }}
              >
                {addedToCart ? 'View cart' : 'Add to cart instead'}
              </button>
              <button onClick={() => setDiscarded(true)} disabled={placing} className="text-xs font-semibold underline underline-offset-2 disabled:opacity-40" style={mutedStyle}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {placed && (
        <>
          <p className="text-xs font-semibold px-0.5" style={{ color: '#16a34a' }}>
            Order {placed.orderNumber} placed. Track it here.
          </p>
          <OrderCard order={placed} onViewOrders={onViewOrders} />
        </>
      )}
    </div>
  );
}

// ─── Renders every card block of one bot message ─────────────────────────────
export function BlocksView({
  blocks,
  onAsk,
  onClose,
}: {
  blocks: UiBlock[];
  onAsk: (text: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  const goCart = () => {
    onClose();
    navigate('/cart');
  };
  const goOrders = () => {
    onClose();
    navigate('/orders');
  };
  const goStore = (id: string) => {
    onClose();
    navigate(`/menu_card_shop/${id}`);
  };

  return (
    <div className="space-y-2 w-full">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'menu_items':
            return (
              <MenuItemsBlock key={i} title={b.title} items={b.items} hiddenCount={b.hiddenCount} onViewCart={goCart} />
            );
          case 'stores':
            return <StoresBlock key={i} stores={b.stores} onAsk={onAsk} onOpenStore={goStore} />;
          case 'orders':
            return <OrdersBlock key={i} orders={b.orders} onViewOrders={goOrders} />;
          case 'order_draft':
            return <DraftCard key={i} draft={b.draft} onViewCart={goCart} onViewOrders={goOrders} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
