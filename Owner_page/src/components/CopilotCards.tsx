import { useState } from 'react';
import api from '../hooks/api';
import RejectReasonPicker from './RejectReasonPicker';
import type { RejectPayload } from './RejectReasonPicker';

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
const ACCENT = '#4f46e5';

const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-main)',
};
const mutedStyle: React.CSSProperties = { color: 'var(--color-text-muted)' };
const nums: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const divider: React.CSSProperties = { borderColor: 'var(--color-border)' };

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const errorMessage = (err: any, fallback: string) => err?.response?.data?.message || err?.message || fallback;

/** The backend sometimes answers errors with HTTP 200 and an error-shaped body, so check the body too. */
function assertOk(res: { data?: any }) {
    const d = res?.data;
    if (d && (d.success === false || d.isOperational === true || d.status === 'fail' || d.status === 'error')) {
        throw new Error(d.message || 'The server rejected this action.');
    }
    return res;
}

function Heading({ children, count }: { children: React.ReactNode; count?: number }) {
    return (
        <h3 className="text-[13px] font-semibold mb-1.5 px-0.5">
            {children}
            {count !== undefined && (
                <span className="font-normal" style={mutedStyle}> ({count})</span>
            )}
        </h3>
    );
}

function Dot({ className }: { className: string }) {
    return <span className={`inline-block w-1.5 h-1.5 rounded-full ${className}`} />;
}

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

function waitMinutes(iso?: string): number | null {
    if (!iso) return null;
    return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

function ago(mins: number): string {
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `${h} h ${mins % 60} min` : `${Math.floor(h / 24)} d`;
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'New order',
    preparing: 'Preparing',
    ready: 'Ready for pickup',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
    rejected: 'Rejected',
    payment_pending: 'Unpaid',
};

// ─── Orders: a ticket rail. The left edge shows how long a ticket has waited. ─
function OrderRow({ order }: { order: OwnerUiOrder }) {
    // Status is tracked locally so the buttons react straight after a successful action.
    const [status, setStatus] = useState(order.status);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmReject, setConfirmReject] = useState(false);

    const act = async (action: 'accept' | 'reject' | 'ready', next: string, body?: RejectPayload) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            assertOk(await api.patch(`/order/${action}/${order.id}`, body));
            setStatus(next);
            setConfirmReject(false);
        } catch (err: any) {
            setError(errorMessage(err, 'Could not update this order. Try again.'));
        } finally {
            setBusy(false);
        }
    };

    const inQueue = status === 'pending' || status === 'preparing';
    const mins = inQueue ? waitMinutes(order.placedAt) : null;
    const level = mins === null ? 'ok' : mins >= 15 ? 'late' : mins >= 8 ? 'slow' : 'ok';
    const edge = !inQueue
        ? status === 'ready'
            ? '#16a34a'
            : 'var(--color-border)'
        : level === 'late'
            ? '#dc2626'
            : level === 'slow'
                ? '#f59e0b'
                : ACCENT;

    const btn = 'text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors active:scale-95 disabled:opacity-40';

    return (
        <article className="rounded-xl border overflow-hidden flex" style={cardStyle} aria-label={`Order ${order.orderNumber}`}>
            <span className="w-1 flex-shrink-0" style={{ background: edge }} aria-hidden="true" />
            <div className="flex-1 min-w-0 px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                            #{order.orderNumber} <span className="font-normal" style={mutedStyle}>{order.userName}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={mutedStyle}>
                            {STATUS_LABEL[status] ?? status}
                            {mins !== null && (
                                <span
                                    className={`font-semibold ${level === 'late' ? 'text-red-600 dark:text-red-400' : level === 'slow' ? 'text-amber-600 dark:text-amber-400' : ''}`}
                                >
                                    {' '}
                                    {mins < 1 ? 'just in' : status === 'pending' ? `waiting ${ago(mins)}` : `for ${ago(mins)}`}
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold" style={nums}>{inr(order.totalAmount)}</p>
                        <p className="text-xs" style={mutedStyle}>{order.paymentType === 'online' ? 'Paid online' : 'Cash'}</p>
                    </div>
                </div>

                <p className="text-[13px] mt-2 break-words">{order.items}</p>
                {order.deliveryType && order.deliveryType !== 'pickup' && (
                    <p className="text-xs mt-1 font-medium text-indigo-600 dark:text-indigo-300">Night delivery</p>
                )}

                {inQueue && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        {status === 'pending' && (
                            <button disabled={busy} onClick={() => act('accept', 'preparing')} className={`${btn} text-white`} style={{ background: '#16a34a' }}>
                                {busy ? 'Accepting…' : 'Accept'}
                            </button>
                        )}
                        {status === 'preparing' && (
                            <button disabled={busy} onClick={() => act('ready', 'ready')} className={`${btn} text-white`} style={{ background: ACCENT }}>
                                {busy ? 'Updating…' : 'Mark ready'}
                            </button>
                        )}
                        {status !== 'pending' ? null : !confirmReject ? (
                            <button
                                disabled={busy}
                                onClick={() => setConfirmReject(true)}
                                className={`${btn} border text-red-600 dark:text-red-400`}
                                style={{ borderColor: 'currentColor' }}
                            >
                                Reject
                            </button>
                        ) : (
                            <RejectReasonPicker
                                paidOnline={order.paymentType === 'online'}
                                busy={busy}
                                onCancel={() => setConfirmReject(false)}
                                onConfirm={(payload) => act('reject', 'rejected', payload)}
                            />
                        )}
                    </div>
                )}

                {status === 'ready' && (
                    <p className="text-xs font-medium mt-2.5 text-emerald-700 dark:text-emerald-400">
                        Ready. The student's QR code confirms pickup.
                    </p>
                )}
                {error && (
                    <p className="text-xs font-medium mt-2 text-red-600 dark:text-red-400" role="alert">
                        {error}
                    </p>
                )}
            </div>
        </article>
    );
}

function OrdersBlock({ title, orders, hiddenCount }: { title: string; orders: OwnerUiOrder[]; hiddenCount: number }) {
    return (
        <section aria-label={title}>
            <Heading count={orders.length + hiddenCount}>{title}</Heading>
            <div className="space-y-2">
                {orders.map((o) => (
                    <OrderRow key={o.id} order={o} />
                ))}
            </div>
            {hiddenCount > 0 && (
                <p className="text-xs mt-2 px-0.5" style={mutedStyle}>
                    {hiddenCount} more not shown. Open the Orders page to see all of them.
                </p>
            )}
        </section>
    );
}

// ─── Sales: one card, led by the revenue number ──────────────────────────────
function SalesBlock({ sales }: { sales: SalesSummary }) {
    const days = sales.perDay;
    const maxRevenue = Math.max(1, ...days.map((d) => d.revenue));
    const best = days.reduce((a, d) => (d.revenue > a.revenue ? d : a), days[0]);
    const showAllLabels = days.length <= 10;
    const totalPay = sales.cashOrders + sales.onlineOrders;
    const onlinePct = totalPay > 0 ? Math.round((sales.onlineOrders / totalPay) * 100) : 0;
    const maxQty = Math.max(1, ...sales.topItems.map((t) => t.qty));

    return (
        <section aria-label={`Sales, ${sales.periodLabel}`} className="rounded-xl border overflow-hidden" style={cardStyle}>
            <div className="px-4 pt-3.5 pb-3">
                <p className="text-xs" style={mutedStyle}>{sales.periodLabel}</p>
                <p className="text-[30px] leading-tight font-bold mt-0.5" style={nums}>{inr(sales.totalRevenue)}</p>
                <dl className="grid grid-cols-3 mt-3 text-center">
                    {[
                        ['Orders', String(sales.totalOrders)],
                        ['Average order', inr(sales.avgOrderValue)],
                        ['In kitchen now', String(sales.activeOrders)],
                    ].map(([label, value], i) => (
                        <div key={label} className={`px-1 ${i > 0 ? 'border-l' : ''}`} style={divider}>
                            <dd className="text-[15px] font-semibold" style={nums}>{value}</dd>
                            <dt className="text-[11px]" style={mutedStyle}>{label}</dt>
                        </div>
                    ))}
                </dl>
            </div>

            {days.length > 1 && (
                <div className="px-4 py-3 border-t" style={divider}>
                    <p className="text-xs mb-2" style={mutedStyle}>
                        Revenue per day
                        {best.revenue > 0 && (
                            <span>
                                , best was {best.label} at <span className="font-semibold" style={{ color: 'var(--color-text-main)' }}>{inr(best.revenue)}</span>
                            </span>
                        )}
                    </p>
                    <div className="flex items-end gap-1 h-20" role="img" aria-label={`Revenue per day: ${days.map((d) => `${d.label} ${inr(d.revenue)}`).join(', ')}`}>
                        {days.map((d, i) => {
                            const isLast = i === days.length - 1;
                            return (
                                <div key={d.date} className="flex-1 min-w-0 h-full flex items-end" title={`${d.label} ${d.date}: ${inr(d.revenue)} from ${d.orders} orders`}>
                                    <div
                                        className="w-full rounded-t-[3px]"
                                        style={{
                                            height: `${Math.max(d.revenue > 0 ? 6 : 2, (d.revenue / maxRevenue) * 100)}%`,
                                            background: d.revenue === 0 ? 'var(--color-border)' : ACCENT,
                                            opacity: d.revenue === 0 ? 1 : isLast ? 1 : 0.4,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-1 mt-1">
                        {days.map((d, i) => (
                            <span key={d.date} className="flex-1 min-w-0 text-center text-[10px] truncate" style={mutedStyle}>
                                {showAllLabels || i === 0 || i === days.length - 1 ? d.label : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {totalPay > 0 && (
                <div className="px-4 py-3 border-t" style={divider}>
                    <div className="h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--color-border)' }} role="img" aria-label={`${onlinePct}% online, ${100 - onlinePct}% cash`}>
                        <div style={{ width: `${onlinePct}%`, background: ACCENT }} />
                    </div>
                    <div className="flex justify-between mt-1.5 text-xs" style={mutedStyle}>
                        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: ACCENT }} />Online {sales.onlineOrders} ({onlinePct}%)</span>
                        <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--color-border)' }} />Cash {sales.cashOrders} ({100 - onlinePct}%)</span>
                    </div>
                </div>
            )}

            {sales.topItems.length > 0 && (
                <div className="px-4 py-3 border-t" style={divider}>
                    <p className="text-xs mb-2" style={mutedStyle}>Top sellers</p>
                    <ul className="space-y-2">
                        {sales.topItems.map((t) => (
                            <li key={t.name}>
                                <div className="flex justify-between text-[13px]">
                                    <span className="truncate pr-3">{t.name}</span>
                                    <span className="font-semibold" style={nums}>{t.qty}</span>
                                </div>
                                <div className="h-1 rounded-full mt-1" style={{ background: 'var(--color-border)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${(t.qty / maxQty) * 100}%`, background: ACCENT }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="px-4 py-2.5 border-t text-[11px]" style={{ ...divider, ...mutedStyle }}>
                {sales.totalOrders === 0 ? 'No sales in this period yet. ' : ''}
                Cancelled and unpaid orders are not counted. Days follow India time.
            </p>
        </section>
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
        <div className="px-3.5 py-2.5 border-t first:border-t-0" style={divider}>
            <div className="flex items-center gap-3">
                <VegMark isVeg={item.isVeg} />
                <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-semibold truncate ${available ? '' : 'opacity-60'}`}>{item.name}</p>
                    <p className="text-xs" style={mutedStyle}>
                        <span style={nums}>{inr(item.price)}</span>
                        {item.halfPrice ? <span style={nums}>, half {inr(item.halfPrice)}</span> : null}
                        {item.category ? `, ${item.category}` : ''}
                    </p>
                </div>
                <span className="text-xs font-medium flex-shrink-0" style={available ? { color: 'var(--color-text-muted)' } : undefined}>
                    {available ? 'In stock' : <span className="text-amber-600 dark:text-amber-400">Out of stock</span>}
                </span>
                <button
                    role="switch"
                    aria-checked={available}
                    aria-label={`${item.name} in stock`}
                    disabled={busy}
                    onClick={toggle}
                    className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: available ? '#16a34a' : '#9ca3af', outlineColor: ACCENT }}
                >
                    <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: available ? '18px' : '2px' }} />
                </button>
            </div>
            {error && (
                <p className="text-xs font-medium mt-1.5 text-red-600 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

function MenuBlock({ title, items, hiddenCount }: { title: string; items: OwnerUiMenuItem[]; hiddenCount: number }) {
    return (
        <section aria-label={title}>
            <Heading count={items.length + hiddenCount}>{title}</Heading>
            <div className="rounded-xl border overflow-hidden" style={cardStyle}>
                {items.map((i) => (
                    <MenuRow key={i.id} item={i} />
                ))}
                {hiddenCount > 0 && (
                    <p className="px-3.5 py-2.5 text-xs border-t" style={{ ...divider, ...mutedStyle }}>
                        {hiddenCount} more not shown. Ask for a specific item by name, or use the Menu page.
                    </p>
                )}
            </div>
        </section>
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
        <section aria-label="Store status" className="rounded-xl border px-4 py-3.5" style={cardStyle}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold truncate">{store.name}</p>
                    <p className="text-xs mt-0.5" style={mutedStyle}>
                        {store.openTime && store.closeTime ? `Open ${store.openTime} to ${store.closeTime}` : 'Hours not set'}
                        {store.location ? `, ${store.location}` : ''}
                    </p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold flex-shrink-0 ${isOpen ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    <Dot className={isOpen ? 'bg-emerald-600' : 'bg-red-500'} />
                    {isOpen ? 'Open' : 'Closed'}
                </span>
            </div>

            <ul className="mt-2.5 space-y-1 text-xs" style={mutedStyle}>
                <li>Night delivery is {store.nightDelivery ? 'on' : 'off'}</li>
                <li>Online orders are {store.isOnlineOrderAvailable ? 'on' : 'paused'}</li>
            </ul>

            <button
                disabled={busy}
                onClick={() => setOpen(!isOpen)}
                className={`mt-3 text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors active:scale-95 disabled:opacity-40 ${isOpen ? 'border text-red-600 dark:text-red-400' : 'text-white'}`}
                style={isOpen ? { borderColor: 'currentColor' } : { background: '#16a34a' }}
            >
                {busy ? 'Updating…' : isOpen ? 'Close store' : 'Open store'}
            </button>
            {error && (
                <p className="text-xs font-medium mt-2 text-red-600 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}
        </section>
    );
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export function BlocksView({ blocks }: { blocks: OwnerUiBlock[] }) {
    return (
        <div className="space-y-3 w-full">
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
