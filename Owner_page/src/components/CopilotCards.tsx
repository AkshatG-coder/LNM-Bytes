import { useState } from 'react';
import api from '../hooks/api';

// ─── Types (mirror Backend/src/utils/copilotHelpers.ts) ──────────────────────
export interface OwnerUiOrder {
    id: string;
    orderNumber: number;
    status: string;
    userName: string;
    items: string;
    totalAmount: number;
    paymentType: string;
    paymentStatus?: string;
    deliveryType?: string;
    placedAt?: string;
}

export interface OwnerUiMenuItem {
    id: string;
    name: string;
    price: number;
    halfPrice: number | null;
    category: string;
    isVeg: boolean;
    isAvailable: boolean;
}

export interface OwnerUiStore {
    id: string;
    name: string;
    status: string;
    location: string;
    openTime: string;
    closeTime: string;
    nightDelivery: boolean;
    isOnlineOrderAvailable: boolean;
}

interface DayRow {
    date: string;
    label: string;
    revenue: number;
    orders: number;
}

export interface SalesSummary {
    days: number;
    periodLabel: string;
    totalRevenue: number;
    totalOrders: number;
    avgOrderValue: number;
    activeOrders: number;
    cashOrders: number;
    onlineOrders: number;
    perDay: DayRow[];
    topItems: { name: string; qty: number }[];
}

export type OwnerUiBlock =
    | { type: 'orders'; title: string; orders: OwnerUiOrder[]; hiddenCount: number }
    | { type: 'sales'; sales: SalesSummary }
    | { type: 'menu'; title: string; items: OwnerUiMenuItem[]; hiddenCount: number }
    | { type: 'store'; store: OwnerUiStore };

// ─── Shared bits ─────────────────────────────────────────────────────────────
const ACCENT = '#8b5cf6';

const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-main)',
};

const mutedStyle: React.CSSProperties = { color: 'var(--color-text-muted)' };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const errorMessage = (err: any, fallback: string) =>
    err?.response?.data?.message || err?.message || fallback;

/** The backend sometimes answers errors with HTTP 200 and an error-shaped body, so check the body too. */
function assertOk(res: { data?: any }) {
    const d = res?.data;
    if (d && (d.success === false || d.isOperational === true || d.status === 'fail' || d.status === 'error')) {
        throw new Error(d.message || 'The server rejected this action.');
    }
    return res;
}

function BlockTitle({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[11px] font-black uppercase tracking-wide mb-1.5" style={mutedStyle}>
            {children}
        </p>
    );
}

function minutesAgo(iso?: string): string {
    if (!iso) return '';
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    return hrs < 24 ? `${hrs} h ago` : `${Math.floor(hrs / 24)} d ago`;
}

const STATUS_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: 'New', bg: 'rgba(245,158,11,0.15)', fg: '#b45309' },
    preparing: { label: 'Preparing', bg: 'rgba(99,102,241,0.15)', fg: '#4f46e5' },
    ready: { label: 'Ready', bg: 'rgba(16,185,129,0.15)', fg: '#047857' },
    delivered: { label: 'Delivered', bg: 'rgba(16,185,129,0.15)', fg: '#047857' },
    cancelled: { label: 'Cancelled', bg: 'rgba(244,63,94,0.15)', fg: '#be123c' },
    rejected: { label: 'Rejected', bg: 'rgba(244,63,94,0.15)', fg: '#be123c' },
    payment_pending: { label: 'Unpaid', bg: 'rgba(107,114,128,0.15)', fg: '#4b5563' },
};

// ─── Orders ──────────────────────────────────────────────────────────────────
function OrderRow({ order }: { order: OwnerUiOrder }) {
    // Status is tracked locally so the buttons react straight after a successful action.
    const [status, setStatus] = useState(order.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmReject, setConfirmReject] = useState(false);

    const act = async (action: 'accept' | 'reject' | 'ready', next: string) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            assertOk(await api.patch(`/order/${action}/${order.id}`));
            setStatus(next);
            setConfirmReject(false);
        } catch (err: any) {
            setError(errorMessage(err, 'Could not update this order. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const st = STATUS_STYLE[status] ?? { label: status, bg: 'rgba(107,114,128,0.15)', fg: '#4b5563' };
    const btn = 'text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95 disabled:opacity-40';

    return (
        <div className="rounded-xl border p-2.5" style={cardStyle}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black">#{order.orderNumber} · {order.userName}</p>
                <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: st.bg, color: st.fg }}
                >
                    {st.label}
                </span>
            </div>
            <p className="text-[11px] font-medium mt-1 break-words">{order.items}</p>
            <p className="text-[11px] mt-1" style={mutedStyle}>
                {inr(order.totalAmount)} · {order.paymentType === 'online' ? 'Online' : 'Cash'}
                {order.deliveryType ? ` · ${order.deliveryType}` : ''}
                {order.placedAt ? ` · ${minutesAgo(order.placedAt)}` : ''}
            </p>

            {(status === 'pending' || status === 'preparing') && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {status === 'pending' && (
                        <button
                            disabled={busy}
                            onClick={() => act('accept', 'preparing')}
                            className={`${btn} text-white`}
                            style={{ backgroundColor: '#10b981' }}
                        >
                            Accept
                        </button>
                    )}
                    {status === 'preparing' && (
                        <button
                            disabled={busy}
                            onClick={() => act('ready', 'ready')}
                            className={`${btn} text-white`}
                            style={{ backgroundColor: ACCENT }}
                        >
                            Mark ready
                        </button>
                    )}
                    {!confirmReject ? (
                        <button
                            disabled={busy}
                            onClick={() => setConfirmReject(true)}
                            className={`${btn} border`}
                            style={{ borderColor: '#f43f5e', color: '#f43f5e' }}
                        >
                            Reject
                        </button>
                    ) : (
                        <>
                            <span className="text-[11px] font-bold" style={{ color: '#f43f5e' }}>
                                Reject and notify student?
                            </span>
                            <button
                                disabled={busy}
                                onClick={() => act('reject', 'rejected')}
                                className={`${btn} text-white`}
                                style={{ backgroundColor: '#f43f5e' }}
                            >
                                Yes, reject
                            </button>
                            <button
                                disabled={busy}
                                onClick={() => setConfirmReject(false)}
                                className={`${btn} border`}
                                style={{ borderColor: 'var(--color-border)' }}
                            >
                                Keep
                            </button>
                        </>
                    )}
                </div>
            )}
            {status === 'ready' && (
                <p className="text-[11px] font-bold mt-2" style={{ color: '#047857' }}>
                    Ready for pickup. The student's QR code confirms collection.
                </p>
            )}
            {error && (
                <p className="text-[11px] font-semibold mt-1.5" style={{ color: '#f43f5e' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

function OrdersBlock({ title, orders, hiddenCount }: { title: string; orders: OwnerUiOrder[]; hiddenCount: number }) {
    return (
        <div className="space-y-1.5">
            <BlockTitle>{title} ({orders.length + hiddenCount})</BlockTitle>
            {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
            ))}
            {hiddenCount > 0 && (
                <p className="text-[11px] font-semibold" style={mutedStyle}>
                    +{hiddenCount} more, see the Orders page.
                </p>
            )}
        </div>
    );
}

// ─── Sales ───────────────────────────────────────────────────────────────────
function Kpi({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border px-2.5 py-2" style={cardStyle}>
            <p className="text-[10px] font-bold uppercase" style={mutedStyle}>{label}</p>
            <p className="text-base font-black leading-tight">{value}</p>
        </div>
    );
}

function SalesBlock({ sales }: { sales: SalesSummary }) {
    const maxRevenue = Math.max(1, ...sales.perDay.map((d) => d.revenue));
    const totalPay = sales.cashOrders + sales.onlineOrders;
    const onlinePct = totalPay > 0 ? Math.round((sales.onlineOrders / totalPay) * 100) : 0;
    const maxQty = Math.max(1, ...sales.topItems.map((t) => t.qty));

    return (
        <div className="space-y-2">
            <BlockTitle>Sales · {sales.periodLabel}</BlockTitle>
            <div className="grid grid-cols-2 gap-1.5">
                <Kpi label="Revenue" value={inr(sales.totalRevenue)} />
                <Kpi label="Orders" value={String(sales.totalOrders)} />
                <Kpi label="Avg order" value={inr(sales.avgOrderValue)} />
                <Kpi label="In kitchen" value={String(sales.activeOrders)} />
            </div>

            {sales.perDay.length > 1 && (
                <div className="rounded-xl border p-2.5" style={cardStyle}>
                    <p className="text-[10px] font-bold uppercase mb-1.5" style={mutedStyle}>Revenue per day</p>
                    <div className="flex items-end gap-1 h-20" role="img" aria-label="Revenue per day bar chart">
                        {sales.perDay.map((d) => (
                            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                                <div
                                    title={`${d.label} ${d.date}: ${inr(d.revenue)} from ${d.orders} orders`}
                                    className="w-full rounded-t"
                                    style={{
                                        height: `${Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / maxRevenue) * 100)}%`,
                                        backgroundColor: d.revenue > 0 ? ACCENT : 'var(--color-border)',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                    {sales.perDay.length <= 10 && (
                        <div className="flex gap-1 mt-1">
                            {sales.perDay.map((d) => (
                                <span key={d.date} className="flex-1 text-center text-[9px] font-bold truncate" style={mutedStyle}>
                                    {d.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {totalPay > 0 && (
                <div className="rounded-xl border p-2.5" style={cardStyle}>
                    <div className="flex justify-between text-[10px] font-bold uppercase mb-1" style={mutedStyle}>
                        <span>Online {sales.onlineOrders}</span>
                        <span>Cash {sales.cashOrders}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div className="h-full" style={{ width: `${onlinePct}%`, backgroundColor: ACCENT }} />
                    </div>
                </div>
            )}

            {sales.topItems.length > 0 && (
                <div className="rounded-xl border p-2.5 space-y-1.5" style={cardStyle}>
                    <p className="text-[10px] font-bold uppercase" style={mutedStyle}>Top items</p>
                    {sales.topItems.map((t) => (
                        <div key={t.name}>
                            <div className="flex justify-between text-[11px] font-semibold">
                                <span className="truncate pr-2">{t.name}</span>
                                <span>{t.qty}</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${(t.qty / maxQty) * 100}%`, backgroundColor: ACCENT }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {sales.totalOrders === 0 && (
                <p className="text-[11px] font-semibold" style={mutedStyle}>No completed sales in this period yet.</p>
            )}
            <p className="text-[10px]" style={mutedStyle}>
                Excludes cancelled and unpaid orders. Days follow India time.
            </p>
        </div>
    );
}

// ─── Menu ────────────────────────────────────────────────────────────────────
function MenuRow({ item }: { item: OwnerUiMenuItem }) {
    const [available, setAvailable] = useState(item.isAvailable);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const toggle = async () => {
        if (busy) return;
        const next = !available;
        setBusy(true);
        setError('');
        try {
            assertOk(await api.patch(`/menu_item/upd/${item.id}`, { isAvailable: next }));
            setAvailable(next);
        } catch (err: any) {
            setError(errorMessage(err, 'Could not update this item.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border px-2.5 py-2" style={cardStyle}>
            <div className="flex items-center gap-2">
                <span
                    className="w-3 h-3 rounded-sm border-2 flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor: item.isVeg ? '#16a34a' : '#dc2626' }}
                    title={item.isVeg ? 'Veg' : 'Non-veg'}
                >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.isVeg ? '#16a34a' : '#dc2626' }} />
                </span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate">{item.name}</p>
                    <p className="text-[11px]" style={mutedStyle}>
                        {inr(item.price)}
                        {item.halfPrice ? ` · half ${inr(item.halfPrice)}` : ''} · {item.category}
                    </p>
                </div>
                <button
                    role="switch"
                    aria-checked={available}
                    aria-label={`${item.name} availability`}
                    disabled={busy}
                    onClick={toggle}
                    className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: available ? '#10b981' : '#9ca3af' }}
                >
                    <span
                        className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                        style={{ left: available ? '22px' : '2px' }}
                    />
                </button>
            </div>
            <p className="text-[10px] font-bold mt-1" style={{ color: available ? '#047857' : '#6b7280' }}>
                {available ? 'Available' : 'Out of stock'}
            </p>
            {error && (
                <p className="text-[11px] font-semibold mt-1" style={{ color: '#f43f5e' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

function MenuBlock({ title, items, hiddenCount }: { title: string; items: OwnerUiMenuItem[]; hiddenCount: number }) {
    return (
        <div className="space-y-1.5">
            <BlockTitle>{title} ({items.length + hiddenCount})</BlockTitle>
            {items.map((i) => (
                <MenuRow key={i.id} item={i} />
            ))}
            {hiddenCount > 0 && (
                <p className="text-[11px] font-semibold" style={mutedStyle}>
                    +{hiddenCount} more. Ask me for a specific item, or use the Menu page.
                </p>
            )}
        </div>
    );
}

// ─── Store ───────────────────────────────────────────────────────────────────
function StoreBlock({ store }: { store: OwnerUiStore }) {
    const [status, setStatus] = useState(store.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const isOpen = status === 'open';

    // The server endpoint flips the status, so read the live value first and only flip when it differs.
    const setOpen = async (wantOpen: boolean) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            const current = assertOk(await api.get(`/store_handler/${store.id}`));
            const live: string | undefined = current.data?.data?.status;
            if (live !== (wantOpen ? 'open' : 'closed')) {
                assertOk(await api.patch(`/store_handler/${store.id}/status`));
            }
            const after = assertOk(await api.get(`/store_handler/${store.id}`));
            setStatus(after.data?.data?.status ?? (wantOpen ? 'open' : 'closed'));
        } catch (err: any) {
            setError(errorMessage(err, 'Could not change the store status.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="rounded-xl border p-3" style={cardStyle}>
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black truncate">{store.name}</p>
                <span
                    className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{
                        backgroundColor: isOpen ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                        color: isOpen ? '#047857' : '#be123c',
                    }}
                >
                    {isOpen ? 'OPEN' : 'CLOSED'}
                </span>
            </div>
            <p className="text-[11px] mt-1" style={mutedStyle}>
                {store.openTime && store.closeTime ? `${store.openTime} – ${store.closeTime}` : 'Hours not set'}
                {store.location ? ` · ${store.location}` : ''}
            </p>
            <p className="text-[11px]" style={mutedStyle}>
                Night delivery: {store.nightDelivery ? 'on' : 'off'} · Online orders:{' '}
                {store.isOnlineOrderAvailable ? 'on' : 'off'}
            </p>
            <button
                disabled={busy}
                onClick={() => setOpen(!isOpen)}
                className="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: isOpen ? '#f43f5e' : '#10b981' }}
            >
                {busy ? 'Updating…' : isOpen ? 'Close store' : 'Open store'}
            </button>
            {error && (
                <p className="text-[11px] font-semibold mt-1.5" style={{ color: '#f43f5e' }}>
                    {error}
                </p>
            )}
        </div>
    );
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export function BlocksView({ blocks }: { blocks: OwnerUiBlock[] }) {
    return (
        <div className="space-y-3 max-w-[95%]">
            {blocks.map((b, i) => {
                switch (b.type) {
                    case 'orders':
                        return <OrdersBlock key={i} title={b.title} orders={b.orders} hiddenCount={b.hiddenCount} />;
                    case 'sales':
                        return <SalesBlock key={i} sales={b.sales} />;
                    case 'menu':
                        return <MenuBlock key={i} title={b.title} items={b.items} hiddenCount={b.hiddenCount} />;
                    case 'store':
                        return <StoreBlock key={i} store={b.store} />;
                    default:
                        return null;
                }
            })}
        </div>
    );
}
