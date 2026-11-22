import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { RootState } from '../Util/store'
import { add_item, clear_all_item } from '../Util/CartReducer'
import api from '../Util/api'
import { rejectionLine, announceOrdersChanged } from '../Util/orderText'
import toast from 'react-hot-toast'
import RateOrder from './RateOrder'
import Favorites from './Favorites'
import { cartHasOtherCanteen, fetchReorderPlan, planToCartItems, reorderSummary } from '../Util/reorder'

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'cancelled' | 'delivered' | 'payment_pending'

interface OrderItem {
  name: string
  quantity: number
  price: number
  portionSize?: string
}

interface Order {
  _id: string
  orderNumber: number
  status: OrderStatus
  totalAmount: number
  paymentType: 'cash' | 'online'
  paymentStatus: string
  createdAt: string
  items: OrderItem[]
  storeId: string
  storeName?: string // Populated from backend
  orderNote?: string
  rejectionReason?: string | null
  rejectionNote?: string
  rating?: number | null
}

type StatusLook = { label: string; step: number; pill: React.CSSProperties }

// Pills use the design tokens only: yellow = being worked on, green = go and collect, red = problem
const STATUS_CONFIG: Record<OrderStatus, StatusLook> = {
  pending:   { label: 'Order placed',    step: 1, pill: { backgroundColor: 'var(--surface-2)', color: 'var(--text-main)' } },
  preparing: { label: 'Being prepared',  step: 2, pill: { backgroundColor: 'var(--primary)', color: '#121B2E' } },
  ready:     { label: 'Ready to collect', step: 3, pill: { backgroundColor: 'var(--veg)', color: '#fff' } },
  delivered: { label: 'Picked up',       step: 4, pill: { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' } },
  cancelled: { label: 'Cancelled',       step: 0, pill: { backgroundColor: 'color-mix(in srgb, var(--nonveg) 14%, transparent)', color: 'var(--nonveg)' } },
  payment_pending: { label: 'Payment incomplete', step: 0, pill: { backgroundColor: 'color-mix(in srgb, var(--primary) 25%, transparent)', color: 'var(--text-main)' } },
}

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'pending', label: 'Placed' },
  { status: 'preparing', label: 'Preparing' },
  { status: 'ready', label: 'Ready' },
  { status: 'delivered', label: 'Picked up' },
]

function formatDateTime(iso: string) {
  const date = new Date(iso)
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

// ─── QR code display (fetched from backend) ──────────────────────────────────
// memo: only re-renders if orderId changes, not on parent list re-renders
const QRDisplay = memo(function QRDisplay({ orderId }: { orderId: string }) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get(`/order/${orderId}/qr`)
      .then(r => setQrCode(r.data?.data?.qrCode ?? null))
      .catch(() => setError(true))
  }, [orderId])

  if (error) return (
    <p className="text-sm font-semibold mt-3" style={{ color: 'var(--nonveg)' }}>The QR code is unavailable. Show your token number at the counter.</p>
  )

  return (
    <div className="mt-3 flex flex-col items-center gap-2">
      {qrCode
        ? <img src={qrCode} alt="Order QR code" className="w-44 h-44 rounded-xl bg-white p-1.5 border" style={{ borderColor: 'var(--border)' }} />
        : <div className="w-44 h-44 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
      }
      <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>The QR code works for 1 hour after your order is ready.</p>
    </div>
  )
})

const NOTE_BOX = 'mt-4 p-3.5 rounded-xl text-sm'

// ─── Single order slip ────────────────────────────────────────────────────────
// memo: prevents re-rendering all cards when only one order's status changes
const OrderCard = memo(function OrderCard({
  order,
  onReorder,
  reordering,
}: {
  order: Order
  onReorder: (order: Order) => void
  reordering: boolean
}) {
  let cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isCancelled = order.status === 'cancelled' || order.status === 'payment_pending'
  const rejection = order.status === 'cancelled' ? rejectionLine(order) : null
  // A rejected online order whose refund could not start is also stored as payment "failed"
  const refundFailed = !!rejection && order.paymentType === 'online' && order.paymentStatus === 'failed'
  const isPaymentFailed = order.status === 'cancelled' && order.paymentStatus === 'failed' && !rejection
  if (isPaymentFailed) cfg = { ...cfg, label: 'Payment failed' }

  return (
    <article className="slip mb-4" style={{ ['--notch-y' as string]: 'calc(5rem - 1px)' }} aria-label={`Order ${order.orderNumber ?? ''}`}>
      {/* Stub: token number, canteen, status */}
      <div className="h-20 px-5 flex items-center justify-between gap-3" style={{ borderBottom: '2px dashed var(--border)' }}>
        <div className="min-w-0">
          <p className="font-display text-3xl font-extrabold leading-none tnum" style={{ color: 'var(--text-main)' }}>
            {order.orderNumber ? `#${order.orderNumber}` : 'Order'}
          </p>
          <p className="mt-1.5 text-xs font-semibold truncate" style={{ color: 'var(--text-muted)' }}>
            {order.storeName ? `${order.storeName}, ` : ''}{formatDateTime(order.createdAt)}
          </p>
        </div>
        <span className="shrink-0 px-3 h-8 flex items-center rounded-full text-xs font-extrabold" style={cfg.pill}>
          {cfg.label}
        </span>
      </div>

      <div className="px-5 py-4">
        {/* Progress */}
        {!isCancelled && (
          <ol className="grid grid-cols-4 gap-1.5 mb-4" aria-label="Order progress">
            {STEPS.map((st) => {
              const done = STATUS_CONFIG[st.status].step <= cfg.step
              const current = st.status === order.status
              return (
                <li key={st.status} aria-current={current ? 'step' : undefined}>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: done ? (st.status === 'ready' || order.status === 'ready' ? 'var(--veg)' : 'var(--primary)') : 'var(--surface-2)' }} />
                  <p className={`mt-1.5 text-[11px] ${current ? 'font-extrabold' : 'font-semibold'}`} style={{ color: current ? 'var(--text-main)' : 'var(--text-muted)' }}>
                    {st.label}
                  </p>
                </li>
              )
            })}
          </ol>
        )}

        {/* Items, like lines on a receipt */}
        <ul className="space-y-1.5 text-sm tnum">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-end gap-2" style={{ color: 'var(--text-main)' }}>
              <span className="font-semibold">
                {item.quantity} × {item.name}
                {item.portionSize === 'half' && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-extrabold" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>Half</span>
                )}
              </span>
              <span className="leader" aria-hidden />
              <span className="font-bold">₹{item.price * item.quantity}</span>
            </li>
          ))}
          <li className="flex items-end gap-2 pt-1.5 font-display text-lg font-extrabold" style={{ color: 'var(--text-main)' }}>
            <span>Total</span>
            <span className="leader" aria-hidden />
            <span>₹{order.totalAmount}</span>
          </li>
        </ul>
        <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {order.paymentType === 'cash' ? 'Pay at the counter' : 'Paid online'}
        </p>

        {/* Ready: show the QR */}
        {order.status === 'ready' && (
          <div className={`${NOTE_BOX} text-center`} style={{ backgroundColor: 'color-mix(in srgb, var(--veg) 12%, transparent)' }}>
            <p className="font-extrabold" style={{ color: 'var(--text-main)' }}>Your order is ready. Show this at the counter.</p>
            <QRDisplay orderId={order._id} />
          </div>
        )}

        {/* Cancelled / failed */}
        {order.status === 'cancelled' && (
          <div className={NOTE_BOX} style={{ backgroundColor: 'color-mix(in srgb, var(--nonveg) 10%, transparent)', color: 'var(--text-main)' }}>
            <p className="font-extrabold">
              {isPaymentFailed
                ? 'The payment failed, so the order was cancelled.'
                : rejection
                  ? 'The canteen could not take this order.'
                  : 'This order was cancelled. Ask the canteen if you need details.'}
            </p>
            {rejection && <p className="mt-1">Reason: {rejection}.</p>}
            {order.paymentType === 'online' && order.paymentStatus === 'refunded' && (
              <p className="mt-1 font-semibold">Your refund has started.</p>
            )}
            {refundFailed && (
              <p className="mt-1 font-semibold">We could not start your refund automatically. Please contact the canteen.</p>
            )}
          </div>
        )}

        {order.status === 'payment_pending' && (
          <div className={NOTE_BOX} style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 16%, transparent)', color: 'var(--text-main)' }}>
            <p className="font-extrabold">The online payment did not go through.</p>
          </div>
        )}

        {/* Picked up: rate it */}
        {order.status === 'delivered' && (
          <div className={`${NOTE_BOX} text-center`} style={{ backgroundColor: 'var(--surface-2)' }}>
            <p className="font-extrabold" style={{ color: 'var(--text-main)' }}>Picked up. Enjoy your meal.</p>
            <RateOrder orderId={order._id} rating={order.rating} />
          </div>
        )}

        {/* Order again */}
        {(order.status === 'delivered' || order.status === 'cancelled' || order.status === 'payment_pending') && (
          <button
            onClick={() => onReorder(order)}
            disabled={reordering}
            className="mt-4 w-full h-11 rounded-xl text-sm font-extrabold bg-primary text-on-primary hover:bg-primary-dark active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
          >
            {reordering ? 'Checking the menu…' : order.status === 'delivered' ? 'Order again' : 'Try ordering again'}
          </button>
        )}
      </div>
    </article>
  )
})

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyOrders() {
  const user     = useSelector((s: RootState) => s.User.user)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // ─── Reorder handler ─────────────────────────────────────────────────────
  // Asks the server to re-check the order against today's menu, prices and canteen status,
  // so the cart never gets sold-out items or last month's prices.
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const cartItems = useSelector((s: RootState) => s.Cart.items)

  const handleReorder = useCallback(async (order: Order) => {
    if (reorderingId) return
    setReorderingId(order._id)
    try {
      const plan = await fetchReorderPlan(order._id)
      const notes = reorderSummary(plan)

      if (plan.lines.length === 0) {
        toast.error(plan.closedReason || 'None of these items are available right now.')
        return
      }
      if (!plan.canOrder) {
        toast.error(plan.closedReason || `${plan.storeName} is not taking orders right now.`)
        return
      }
      if (cartHasOtherCanteen(cartItems, plan.storeId)) {
        const ok = window.confirm('Your cart has items from another canteen. Replace it with this order?')
        if (!ok) return
      }

      // Start from a clean cart so quantities match the order exactly
      dispatch(clear_all_item())
      planToCartItems(plan).forEach((item) => dispatch(add_item(item)))
      if (notes.length > 0) toast(notes.join(' '), { icon: 'ℹ️', duration: 6000 })
      navigate('/cart')
    } catch (e) {
      console.error('Reorder failed:', e)
      toast.error('Could not check this order right now. Please try again.')
    } finally {
      setReorderingId(null)
    }
  }, [cartItems, dispatch, navigate, reorderingId])

  const updateOrderStatus = useCallback((orderId: string, newStatus: OrderStatus, extra: Partial<Order> = {}) => {
    setOrders(prev => prev.map(o => {
      if (o._id !== orderId) return o
      return { ...o, ...extra, status: newStatus }
    }))
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await api.get(`/order/user/${user.id}`)
      if (res.data?.success) {
        const fetched: Order[] = res.data.data || []
        setOrders(fetched)
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // ─── Verify Online Payment when returning from Cashfree ──────────────────
  useEffect(() => {
    const orderIdToVerify = searchParams.get('order_id')
    if (orderIdToVerify) {
      // Remove from URL immediately so refresh doesn't re-trigger
      setSearchParams({})
      api.post(`/order/verify-payment/${orderIdToVerify}`)
        .then((res) => {
          if (res.data?.success) {
            // Payment verified — NOW it is safe to clear the cart
            dispatch(clear_all_item())
            announceOrdersChanged()
            fetchOrders()
          } else {
            toast.error("⚠️ Payment could not be verified. Please show your order ID at the counter.")
            fetchOrders() // Refresh to show failure/cancelled state
          }
        })
        .catch(err => {
           console.error("Payment verification failed", err)
           toast.error("Your online payment verification failed or is pending. Please check with the counter.")
           fetchOrders() // Refresh to show failure/cancelled state
        })
    }
  }, [searchParams, setSearchParams, fetchOrders, dispatch])

  // ─── WebSocket — real-time order status updates ───────────────────────────
  useEffect(() => {
    if (!user?.id) return

    // Automatically derive WS_URL from API_URL to ensure secure WebSockets (wss) on HTTPS
    const apiHost = (import.meta.env.VITE_API_URL || 'http://localhost:8081')
    const WS_URL = apiHost.replace(/^http/, 'ws')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      // Register this client so the server can push to this user
      ws.send(JSON.stringify({ type: 'register', userId: user.id, token: localStorage.getItem('user_token') }))
      setWsConnected(true)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // Status-change events pushed by the backend
        if (data.type === 'orderPreparing' || data.type === 'orderReady' ||
            data.type === 'orderDelivered' || data.type === 'orderCancelled') {
          const statusMap: Record<string, OrderStatus> = {
            orderPreparing: 'preparing',
            orderReady:     'ready',
            orderDelivered: 'delivered',
            orderCancelled: 'cancelled',
          }
          const newStatus = statusMap[data.type]
          if (newStatus && data.orderId) {
            // A rejection also carries the owner's reason and whether a refund started
            const extra: Partial<Order> = data.type === 'orderCancelled' && data.reason !== undefined
              ? {
                  rejectionReason: data.reason ?? null,
                  rejectionNote: data.note ?? '',
                  ...(data.refunded ? { paymentStatus: 'refunded' } : {}),
                }
              : {}
            updateOrderStatus(String(data.orderId), newStatus, extra)
          }
        }
      } catch {
        // Non-JSON messages — ignore
      }
    }

    ws.onclose = () => setWsConnected(false)
    ws.onerror = () => setWsConnected(false)

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [user?.id, updateOrderStatus])

  // ─── Polling — fallback when WS is disconnected; slower cadence when connected
  useEffect(() => {
    fetchOrders()
    // Poll every 30s as requested
    const interval = setInterval(fetchOrders, 30_000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const active    = orders.filter(o => !['cancelled', 'delivered', 'payment_pending'].includes(o.status))
  const completed = orders.filter(o => ['cancelled', 'delivered', 'payment_pending'].includes(o.status))

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-10">
      <div className="flex items-end justify-between mb-5">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-main)' }}>My orders</h1>
        <button
          onClick={fetchOrders}
          className="px-3 h-9 rounded-lg text-sm font-bold border hover:bg-[var(--surface-2)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading orders">
          {[0, 1].map((i) => (
            <div key={i} className="h-56 rounded-2xl border animate-pulse" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-display text-2xl font-extrabold" style={{ color: 'var(--text-main)' }}>No orders yet</p>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Your orders show up here as soon as you place one.</p>
          <button onClick={() => navigate('/')} className="mt-5 px-5 h-11 rounded-xl bg-primary text-on-primary font-extrabold hover:bg-primary-dark">
            Browse canteens
          </button>
        </div>
      ) : (
        <>
          <Favorites />

          <div role="tablist" className="inline-flex p-1 rounded-xl mb-5" style={{ backgroundColor: 'var(--surface-2)' }}>
            {([['active', 'Active', active.length], ['completed', 'Past orders', completed.length]] as const).map(([key, label, n]) => (
              <button
                key={key}
                role="tab"
                aria-selected={activeTab === key}
                onClick={() => setActiveTab(key)}
                className={`px-4 h-9 rounded-lg text-sm font-extrabold ${activeTab === key ? 'bg-primary text-on-primary' : ''}`}
                style={activeTab === key ? undefined : { color: 'var(--text-muted)' }}
              >
                {label} <span className="tnum">({n})</span>
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {(activeTab === 'active' ? active : completed).length > 0 ? (
              (activeTab === 'active' ? active : completed).map(o => (
                <OrderCard key={o._id} order={o} onReorder={handleReorder} reordering={reorderingId === o._id} />
              ))
            ) : (
              <p className="py-10 text-center rounded-2xl border border-dashed font-semibold" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                {activeTab === 'active' ? 'Nothing in progress right now.' : 'No past orders yet.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
