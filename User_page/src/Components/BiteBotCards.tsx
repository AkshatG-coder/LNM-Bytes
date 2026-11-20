import { useCallback, useEffect, useState } from 'react';
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

const ORANGE = '#f97316';
const DRAFT_TTL_MS = 10 * 60 * 1000;

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  borderColor: 'var(--border)',
  color: 'var(--text-main)',
};
const mutedStyle: React.CSSProperties = { color: 'var(--text-muted)' };

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
      toast.error(item.storeOpen ? 'App orders are paused for this shop ⏸️' : 'Sorry, this shop is currently closed 🚫');
      return;
    }
    if (cart.length > 0 && cart[0].canteen_id !== item.storeId) {
      toast.error('You can only add items from the same canteen 🍽️');
      return;
    }
    if (cartItem) {
      dispatch(increase_item({ id: item.id, portionSize: portion }));
    } else {
      dispatch(
        add_item({ id: item.id, item_name: item.name, price, qty: 1, canteen_id: item.storeId, portionSize: portion }),
      );
    }
  }

  function remove() {
    if (qty > 0) dispatch(decrease_item({ id: item.id, portionSize: portion }));
  }

  return (
    <div className="px-3 py-2.5 border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight">
            <span className="mr-1">{item.isVeg ? '🟢' : '🔴'}</span>
            {item.name}
          </p>
          <p className="text-[10px] mt-0.5 font-medium" style={mutedStyle}>
            {item.storeName}
            {item.category ? ` · ${item.category}` : ''}
            {item.rating > 0 ? ` · ⭐ ${item.rating.toFixed(1)}` : ''}
            {item.timesOrdered ? ` · ordered ${item.timesOrdered}×` : ''}
          </p>
        </div>
        <span className="text-sm font-black whitespace-nowrap" style={{ color: ORANGE }}>
          ₹{price}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        {item.hasHalf && item.halfPrice ? (
          <div className="flex rounded-lg p-0.5 gap-0.5 border" style={{ borderColor: 'var(--border)' }}>
            {(['full', 'half'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPortion(p)}
                className="px-2 py-0.5 rounded-md text-[10px] font-black transition-all"
                style={
                  portion === p ? { background: ORANGE, color: 'white' } : { color: 'var(--text-muted)' }
                }
              >
                {p === 'full' ? `Full ₹${item.price}` : `Half ₹${item.halfPrice}`}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        {blocked ? (
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-red-100 text-red-600">{blocked}</span>
        ) : qty === 0 ? (
          <button
            onClick={add}
            className="text-[11px] font-black px-3 py-1 rounded-lg text-white active:scale-95 transition-transform"
            style={{ background: ORANGE }}
          >
            + Add
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={remove}
              className="w-6 h-6 rounded-md border font-bold flex items-center justify-center"
              style={{ borderColor: 'var(--border)' }}
              aria-label={`Remove one ${item.name}`}
            >
              −
            </button>
            <span className="text-xs font-black w-4 text-center">{qty}</span>
            <button
              onClick={add}
              className="w-6 h-6 rounded-md text-white font-bold flex items-center justify-center"
              style={{ background: ORANGE }}
              aria-label={`Add one more ${item.name}`}
            >
              +
            </button>
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
    <div className="rounded-2xl border overflow-hidden shadow-sm" style={cardStyle}>
      {title && (
        <div className="px-3 py-2 text-[11px] font-black uppercase tracking-wide" style={{ background: 'rgba(249,115,22,0.10)', color: '#ea580c' }}>
          {title}
        </div>
      )}
      {items.map((it) => (
        <ItemRow key={it.id} item={it} />
      ))}
      {(hiddenCount ?? 0) > 0 && (
        <p className="px-3 py-2 text-[10px] font-medium border-t" style={{ ...mutedStyle, borderColor: 'var(--border)' }}>
          +{hiddenCount} more. Ask me to narrow it down (veg, budget, canteen).
        </p>
      )}
      {cartCount > 0 && (
        <button
          onClick={onViewCart}
          className="w-full text-[11px] font-black py-2 border-t text-center"
          style={{ borderColor: 'var(--border)', color: '#ea580c' }}
        >
          🛒 View cart ({cartCount} item{cartCount !== 1 ? 's' : ''})
        </button>
      )}
    </div>
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
    <div className="rounded-2xl border overflow-hidden shadow-sm" style={cardStyle}>
      {stores.map((s) => (
        <div key={s.id} className="px-3 py-2.5 border-t first:border-t-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold">{s.name}</p>
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                s.orderableNow ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {s.orderableNow ? 'OPEN NOW' : 'NOT TAKING ORDERS'}
            </span>
          </div>
          <p className="text-[10px] mt-0.5 font-medium" style={mutedStyle}>
            {s.location}
            {s.openTime && s.closeTime ? ` · ${s.openTime}–${s.closeTime}` : ''}
            {s.foodType ? ` · ${s.foodType}` : ''}
            {s.nightDelivery ? ' · 🌙 night delivery' : ''}
          </p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onAsk(`Show the menu of ${s.name}`)}
              className="text-[11px] font-black px-2.5 py-1 rounded-lg border"
              style={{ borderColor: ORANGE, color: '#ea580c' }}
            >
              Menu in chat
            </button>
            <button
              onClick={() => onOpenStore(s.id)}
              className="text-[11px] font-black px-2.5 py-1 rounded-lg text-white"
              style={{ background: ORANGE }}
            >
              Open shop page
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Live order tracker ──────────────────────────────────────────────────────
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
          setOrder((prev) => ({ ...prev, status: o.status, paymentStatus: o.paymentStatus ?? prev.paymentStatus }));
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

  const idx = stepIndex(order.status);
  const cancelled = order.status === 'cancelled';
  const awaitingPayment = order.status === 'payment_pending';

  return (
    <div className="rounded-2xl border px-3 py-3 shadow-sm" style={cardStyle}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black">
            Order #{order.orderNumber} <span style={mutedStyle}>· {order.storeName}</span>
          </p>
          <p className="text-[10px] mt-0.5 font-medium line-clamp-2" style={mutedStyle}>
            {order.items}
          </p>
        </div>
        <span className="text-sm font-black whitespace-nowrap" style={{ color: ORANGE }}>
          ₹{order.totalAmount}
        </span>
      </div>

      {cancelled ? (
        <p className="mt-2 text-[11px] font-black text-red-600">❌ This order was cancelled</p>
      ) : awaitingPayment ? (
        <div className="mt-2">
          <p className="text-[11px] font-black text-yellow-600">⏳ Payment pending</p>
          <button onClick={onViewOrders} className="mt-1 text-[11px] font-black underline" style={{ color: '#ea580c' }}>
            Complete it in My Orders
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center flex-1 last:flex-none">
                <div
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0"
                  style={{ background: i <= idx ? ORANGE : 'var(--border)' }}
                >
                  {i <= idx ? '✓' : ''}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="h-0.5 flex-1 mx-1" style={{ background: i < idx ? ORANGE : 'var(--border)' }} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {STEPS.map((label, i) => (
              <span
                key={label}
                className="text-[9px] font-bold"
                style={{ color: i <= idx ? '#ea580c' : 'var(--text-muted)' }}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {order.status === 'ready' && (
        <div className="mt-3">
          {qr ? (
            <div className="flex flex-col items-center gap-1">
              <img src={qr} alt="Pickup QR code" className="w-40 h-40 rounded-lg bg-white p-1" />
              <p className="text-[10px] font-medium" style={mutedStyle}>
                Show this at the counter
              </p>
            </div>
          ) : (
            <button
              onClick={showQr}
              disabled={busy}
              className="w-full text-[11px] font-black py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ background: ORANGE }}
            >
              📱 Show pickup QR
            </button>
          )}
        </div>
      )}

      {ACTIVE_STATUSES.has(order.status) && (
        <button
          onClick={() => refresh(true)}
          disabled={busy}
          className="mt-2 text-[10px] font-bold underline disabled:opacity-50"
          style={mutedStyle}
        >
          {busy ? 'Refreshing…' : 'Refresh status'}
        </button>
      )}
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

// ─── Order draft: nothing is placed until the student taps a button ──────────
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
      <div className="rounded-2xl border px-3 py-2 text-[11px] font-medium" style={{ ...cardStyle, ...mutedStyle }}>
        Draft discarded.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border overflow-hidden shadow-sm" style={cardStyle}>
        <div className="px-3 py-2 flex items-center justify-between" style={{ background: 'rgba(249,115,22,0.10)' }}>
          <span className="text-[11px] font-black uppercase tracking-wide" style={{ color: '#ea580c' }}>
            Order draft · {draft.storeName}
          </span>
          <span className="text-[10px] font-bold" style={mutedStyle}>
            not placed yet
          </span>
        </div>

        <div className="px-3 py-2 space-y-1">
          {draft.items.map((i) => (
            <div key={`${i.menuItemId}-${i.portionSize}`} className="flex justify-between text-xs font-medium">
              <span>
                {i.isVeg === false ? '🔴' : '🟢'} {i.name}
                {i.portionSize === 'half' ? ' (half)' : ''} × {i.quantity}
              </span>
              <span className="font-bold">₹{i.price * i.quantity}</span>
            </div>
          ))}
        </div>

        {draft.canPlace && draft.nightDeliveryAvailable && !placed && (
          <label className="px-3 pb-2 flex items-center gap-2 text-[11px] font-bold cursor-pointer" style={mutedStyle}>
            <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} />
            🌙 Night delivery (+₹{draft.nightDeliveryCharge})
          </label>
        )}

        <div className="px-3 py-2 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs font-black">Total</span>
          <span className="text-base font-black" style={{ color: ORANGE }}>
            ₹{total}
          </span>
        </div>

        {draft.issues.length > 0 && (
          <div className="px-3 py-2 border-t bg-red-50 text-red-700 text-[11px] font-bold space-y-0.5" style={{ borderColor: 'var(--border)' }}>
            {draft.issues.map((m, i) => (
              <p key={i}>⚠️ {m}</p>
            ))}
          </div>
        )}
        {draft.notes.length > 0 && (
          <div className="px-3 py-2 border-t bg-yellow-50 text-yellow-800 text-[11px] font-medium space-y-0.5" style={{ borderColor: 'var(--border)' }}>
            {draft.notes.map((m, i) => (
              <p key={i}>ℹ️ {m}</p>
            ))}
          </div>
        )}
        {expired && !placed && (
          <p className="px-3 py-2 border-t text-[11px] font-bold text-yellow-700" style={{ borderColor: 'var(--border)' }}>
            This draft is more than 10 minutes old. Ask me again for fresh prices.
          </p>
        )}

        {!placed && (
          <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => placeOrder('cash')}
              disabled={locked}
              className="w-full text-xs font-black py-2 rounded-xl text-white disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ background: ORANGE }}
            >
              {placing ? '⏳ Placing…' : `✅ Confirm · Pay at counter ₹${total}`}
            </button>
            <button
              onClick={() => placeOrder('online')}
              disabled={locked}
              className="w-full text-xs font-black py-2 rounded-xl border-2 disabled:opacity-40 active:scale-[0.98] transition-transform"
              style={{ borderColor: ORANGE, color: '#ea580c' }}
            >
              💳 Pay online ₹{total}
            </button>
            <div className="flex gap-2">
              <button
                onClick={addedToCart ? onViewCart : addToCart}
                disabled={!draft.canPlace || expired || placing}
                className="flex-1 text-[11px] font-black py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border)' }}
              >
                {addedToCart ? '🛒 View cart' : '🛒 Add to cart'}
              </button>
              <button
                onClick={() => setDiscarded(true)}
                disabled={placing}
                className="flex-1 text-[11px] font-black py-1.5 rounded-lg border disabled:opacity-40"
                style={{ borderColor: 'var(--border)', ...mutedStyle }}
              >
                Discard
              </button>
            </div>
          </div>
        )}
      </div>

      {placed && (
        <>
          <p className="text-[11px] font-black text-green-600 px-1">✅ Order #{placed.orderNumber} placed. Track it here:</p>
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
