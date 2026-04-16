import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { RootState } from '../Util/store'
import { add_item, clear_all_item } from '../Util/CartReducer'
import api from '../Util/api'
import toast from 'react-hot-toast'

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
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: string; color: string; bg: string; step: number; fill: string; border: string }> = {
  pending:   { label: 'Order Placed',     icon: '🕐', color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/30', step: 1, fill: 'bg-yellow-500', border: 'border-yellow-500' },
  preparing: { label: 'Being Prepared',   icon: '🍳', color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/30', step: 2, fill: 'bg-orange-500', border: 'border-orange-500' },
  ready:     { label: 'Ready for Pickup', icon: '🛎️', color: 'text-green-500',  bg: 'bg-green-500/10  border-green-500/30',  step: 3, fill: 'bg-green-500', border: 'border-green-500' },
  delivered: { label: 'Delivered',        icon: '✅', color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/30', step: 4, fill: 'bg-purple-500', border: 'border-purple-500' },
  cancelled: { label: 'Cancelled',        icon: '❌', color: 'text-red-500',    bg: 'bg-red-500/10   border-red-500/30',     step: 0, fill: 'bg-red-500', border: 'border-red-500' },
  payment_pending: { label: 'Payment Pending', icon: '⏳', color: 'text-yellow-600', bg: 'bg-yellow-500/10 border-yellow-500/30', step: 0, fill: 'bg-yellow-600', border: 'border-yellow-600' },
}

const STEPS: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

// ─── QR code display (fetched from backend) ──────────────────────────────────
// memo: only re-renders if orderId changes, not on parent list re-renders
const QRDisplay = memo(function QRDisplay({ orderId }: { orderId: string }) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [orderNumber, setOrderNumber] = useState<number | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get(`/order/${orderId}/qr`)
      .then(r => {
        setQrCode(r.data?.data?.qrCode ?? null)
        setOrderNumber(r.data?.data?.orderNumber ?? null)
      })
      .catch(() => setError(true))
  }, [orderId])

  if (error) return (
    <p className="text-xs text-red-400 mt-2">QR code expired or unavailable. Ask the counter staff.</p>
  )

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Show this at the counter</p>

      {/* ── Bold Token Number ── */}
      {orderNumber ? (
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Token Number</p>
          <div className="bg-green-500 text-white font-black text-4xl px-8 py-3 rounded-2xl shadow-lg shadow-green-500/30 tracking-wider">
            #{orderNumber}
          </div>
        </div>
      ) : (
        <div className="w-24 h-14 rounded-xl bg-green-900/20 animate-pulse" />
      )}

      {/* ── QR Code ── */}
      {qrCode
        ? <img src={qrCode} alt="Order QR Code" className="w-44 h-44 rounded-xl border-4 border-green-500/40 bg-white p-1 shadow-xl" />
        : <div className="w-44 h-44 rounded-xl border-2 border-green-500/20 bg-green-900/10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-400 rounded-full animate-spin" />
          </div>
      }
      <p className="text-[10px] text-gray-500 font-medium">QR expires 1 hour after order is ready</p>
    </div>
  )
})


// ─── Single order card ────────────────────────────────────────────────────────
// memo: prevents re-rendering all cards when only one order's status changes
const OrderCard = memo(function OrderCard({
  order,
  onReorder,
}: {
  order: Order
  onReorder: (order: Order) => void
}) {
  let cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isCancelled = order.status === 'cancelled' || order.status === 'payment_pending'
  const isPaymentFailed = order.status === 'cancelled' && order.paymentStatus === 'failed'

  if (isPaymentFailed) {
    cfg = { label: 'Payment Failed', icon: '❌', color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/30', step: 0, fill: 'bg-red-500', border: 'border-red-500' }
  } else if (order.status === 'payment_pending') {
    cfg = { label: 'Payment Incomplete', icon: '⏳', color: 'text-yellow-600', bg: 'bg-yellow-500/10 border-yellow-500/30', step: 0, fill: 'bg-yellow-600', border: 'border-yellow-600' }
  }

  return (
    <div
      className={`rounded-2xl border p-5 mb-4 transition-all ${cfg.bg}`}
      style={{ backgroundColor: 'var(--surface)', backdropFilter: 'blur(4px)' }}
    >

      {/* Header */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap pb-1">
            {order.orderNumber && (
              <span
                className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ color: 'var(--text-main)', backgroundColor: 'var(--surface)' }}
              >
                # {order.orderNumber}
              </span>
            )}
            {order.storeName && (
              <span className="text-xs font-bold text-primary/80">
                • {order.storeName}
              </span>
            )}
            <span className="text-xs font-medium text-gray-500">
              {timeAgo(order.createdAt)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black" style={{ color: 'var(--text-main)' }}>₹{order.totalAmount}</div>
          <div className="text-xs font-medium text-gray-500">
            {order.paymentType === 'cash' ? '💵 Pay at Counter' : '💳 Online'}
          </div>
        </div>
      </div>

      {/* Swiggy-style Stepper UI */}
      {!isCancelled && (
        <div className="mt-5 mb-5 px-1">
          <div className="flex items-center justify-between relative w-full" role="progressbar">
            {/* Background Path */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700/50 rounded-full z-0" />
            
            {/* Active Path Fill */}
            <div 
               className={`absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-full transition-all duration-700 ease-in-out ${cfg.fill} z-0`}
               style={{ width: `${Math.max(0, (cfg.step - 1) / (STEPS.length - 1) * 100)}%` }}
            />

            {STEPS.map((s) => {
              const sCfg = STATUS_CONFIG[s]
              const isActive = sCfg.step <= cfg.step
              const isCurrent = s === order.status

              return (
                <div key={s} className="relative flex flex-col items-center z-10 w-16 group">
                  {/* Step Node */}
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base border-[3px] transition-all duration-500 bg-white dark:bg-[#0f172a] ${
                    isCurrent ? `${cfg.border} ${cfg.color} shadow-[0_0_12px_rgba(var(--primary-rgb),0.3)] scale-110` :
                    isActive ? `${sCfg.border} text-white ${sCfg.fill}` :
                    'border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
                  }`}>
                    <span className={`transition-all duration-500 ${isCurrent ? 'animate-pulse' : ''}`}>
                      {isActive && !isCurrent ? '✓' : sCfg.icon}
                    </span>
                  </div>
                  
                  {/* Step Label */}
                  <span className={`absolute top-full mt-2 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-center transition-colors duration-300 w-20 ${
                    isCurrent ? cfg.color :
                    isActive ? 'text-gray-700 dark:text-gray-300' :
                    'text-gray-400 dark:text-gray-600'
                  }`}>
                    {sCfg.label.replace('for Pickup', '').trim()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5 mb-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text-main)' }}>
              {item.name}
              {item.portionSize === 'half' && (
                <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300 px-1.5 py-0.5 rounded-full">Half</span>
              )}
            </span>
            <span className="font-bold" style={{ color: 'var(--text-muted)' }}>×{item.quantity} · ₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Ready & QR */}
      {order.status === 'ready' && (
        <div className="mt-3 p-4 rounded-xl bg-green-900/20 border border-green-700/30 text-center">
          <p className="text-green-400 font-black text-sm">🛎️ Your order is ready! Come pick it up.</p>
          <QRDisplay orderId={order._id} />
        </div>
      )}

      {/* Cancelled / Failed */}
      {order.status === 'cancelled' && (
        <div className={`mt-3 p-3 rounded-xl text-center border ${isPaymentFailed ? 'bg-red-900/10 border-red-700/30' : 'bg-red-900/10 border-red-700/20'}`}>
          <p className="text-red-400 font-bold text-sm">
            {isPaymentFailed ? 'Payment failed and order was cancelled.' : 'Order cancelled. Contact the canteen if needed.'}
          </p>
        </div>
      )}

      {/* Payment Pending */}
      {order.status === 'payment_pending' && (
        <div className="mt-3 p-3 rounded-xl bg-yellow-900/10 border border-yellow-700/30 text-center">
          <p className="text-yellow-500 font-bold text-sm">Online payment did not complete.</p>
        </div>
      )}

      {/* Delivered */}
      {order.status === 'delivered' && (
        <div className="mt-3 p-3 rounded-xl bg-purple-900/10 border border-purple-700/20 text-center">
          <p className="text-purple-400 font-bold text-sm">✅ Picked up successfully. Enjoy your meal!</p>
        </div>
      )}

      {/* Reorder button — shown on completed orders */}
      {(order.status === 'delivered' || order.status === 'cancelled' || order.status === 'payment_pending') && (
        <button
          onClick={() => onReorder(order)}
          className="mt-3 w-full py-2.5 rounded-xl text-sm font-black border-2 border-primary/30 text-primary
            hover:bg-primary hover:text-white transition-all active:scale-[0.98]"
        >
          🔁 {isPaymentFailed || order.status === 'payment_pending' ? 'Try Ordering Again' : 'Reorder'}
        </button>
      )}
    </div>
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
  const prevStatuses = useRef<Record<string, OrderStatus>>({})
  const wsRef = useRef<WebSocket | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // ─── Reorder handler ─────────────────────────────────────────────────────
  const handleReorder = useCallback((order: Order) => {
    order.items.forEach((item) => {
      dispatch(add_item({
        id:          item.name,   // use item name as id fallback (menuItemId not in order doc)
        item_name:   item.name,
        price:       item.price,
        qty:         item.quantity,
        canteen_id:  order.storeId,
        portionSize: (item.portionSize as 'full' | 'half') || 'full',
      }))
    })
    navigate('/cart')
  }, [dispatch, navigate])

  // Request browser notification permission once
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  function pushNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
  }

  const updateOrderStatus = useCallback((orderId: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(o => {
      if (o._id !== orderId) return o
      if (o.status !== newStatus) {
        const cfg = STATUS_CONFIG[newStatus]
        const num = o.orderNumber ? ` #${o.orderNumber}` : ''
        if (cfg) pushNotification(`LNM Bytes — Order${num}`, `${cfg.icon} ${cfg.label}`)
        prevStatuses.current[o._id] = newStatus
      }
      return { ...o, status: newStatus }
    }))
  }, [])

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await api.get(`/order/user/${user.id}`)
      if (res.data?.success) {
        const fetched: Order[] = res.data.data || []
        setOrders(fetched)

        // Fire browser notification on status change detected via polling
        fetched.forEach(order => {
          const prev = prevStatuses.current[order._id]
          if (prev && prev !== order.status) {
            const cfg = STATUS_CONFIG[order.status]
            const num = order.orderNumber ? ` #${order.orderNumber}` : ''
            if (cfg) pushNotification(`LNM Bytes — Order${num}`, `${cfg.icon} ${cfg.label}`)
          }
          prevStatuses.current[order._id] = order.status
        })
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
      ws.send(JSON.stringify({ type: 'register', userId: user.id }))
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
            updateOrderStatus(String(data.orderId), newStatus)
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
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black" style={{ color: 'var(--text-main)' }}>My Orders</h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Track the live status of your orders
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black border transition-all hover:border-primary/40 hover:text-primary"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-primary font-black tracking-widest animate-pulse uppercase text-sm">Finding the best food for you...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 opacity-30">📋</div>
          <p className="font-black text-lg" style={{ color: 'var(--text-main)' }}>No orders yet</p>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Your orders will appear here once placed</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setActiveTab('active')}
              className={`pb-3 px-2 text-sm font-black transition-colors relative ${
                activeTab === 'active' ? 'text-primary' : 'text-gray-400 hover:text-gray-300'
              }`}
              style={activeTab !== 'active' ? { color: 'var(--text-muted)' } : {}}
            >
              Active ({active.length})
              {activeTab === 'active' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`pb-3 px-2 text-sm font-black transition-colors relative ${
                activeTab === 'completed' ? 'text-primary' : 'text-gray-400 hover:text-gray-300'
              }`}
              style={activeTab !== 'completed' ? { color: 'var(--text-muted)' } : {}}
            >
              Completed ({completed.length})
              {activeTab === 'completed' && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div>
            {activeTab === 'active' && (
              active.length > 0 ? (
                active.map(o => <OrderCard key={o._id} order={o} onReorder={handleReorder} />)
              ) : (
                <div className="text-center py-10">
                  <p className="font-bold border-2 border-dashed p-8 rounded-2xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    No active orders.
                  </p>
                </div>
              )
            )}

            {activeTab === 'completed' && (
              completed.length > 0 ? (
                completed.map(o => <OrderCard key={o._id} order={o} onReorder={handleReorder} />)
              ) : (
                <div className="text-center py-10">
                  <p className="font-bold border-2 border-dashed p-8 rounded-2xl" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                    No completed orders.
                  </p>
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
