import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../Util/store'
import api from '../Util/api'

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'cancelled' | 'delivered'

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
  orderNote?: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: string; color: string; bg: string; step: number }> = {
  pending:   { label: 'Order Placed',     icon: '🕐', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', step: 1 },
  preparing: { label: 'Being Prepared',   icon: '🍳', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', step: 2 },
  ready:     { label: 'Ready for Pickup', icon: '🛎️', color: 'text-green-400',  bg: 'bg-green-500/10  border-green-500/30',  step: 3 },
  delivered: { label: 'Delivered',        icon: '✅', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30', step: 4 },
  cancelled: { label: 'Cancelled',        icon: '❌', color: 'text-red-400',    bg: 'bg-red-500/10   border-red-500/30',     step: 0 },
}

const STEPS: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

// ─── QR code display (fetched from backend) ─────────────────────────────────
function QRDisplay({ orderId }: { orderId: string }) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    api.get(`/order/${orderId}/qr`)
      .then(r => setQrCode(r.data?.data?.qrCode ?? null))
      .catch(() => setError(true))
  }, [orderId])

  if (error) return (
    <p className="text-xs text-red-400 mt-2">QR code expired or unavailable. Ask the counter staff.</p>
  )

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Show this at the counter</p>
      {qrCode
        ? <img src={qrCode} alt="Order QR Code" className="w-40 h-40 rounded-xl border-4 border-green-500/30 bg-white p-1" />
        : <div className="w-40 h-40 rounded-xl border-2 border-green-500/20 bg-green-900/10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-green-500/20 border-t-green-400 rounded-full animate-spin" />
          </div>
      }
      <p className="text-[10px] text-gray-500 font-medium">QR expires 30 minutes after order is ready</p>
    </div>
  )
}

// ─── Single order card ────────────────────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const isCancelled = order.status === 'cancelled'

  return (
    <div className={`rounded-2xl border p-5 mb-4 transition-all ${cfg.bg}`}
      style={{ backgroundColor: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{cfg.icon}</span>
            <span className={`text-base font-black ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {order.orderNumber && (
              <span className="text-xs font-black text-white bg-gray-700 px-2 py-0.5 rounded-full">
                # {order.orderNumber}
              </span>
            )}
            <span className="text-xs font-medium text-gray-500">
              {timeAgo(order.createdAt)}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black text-white">₹{order.totalAmount}</div>
          <div className="text-xs font-medium text-gray-500">
            {order.paymentType === 'cash' ? '💵 Pay at Counter' : '💳 Online'}
          </div>
        </div>
      </div>

      {/* Progress stepper */}
      {!isCancelled && (
        <div className="flex items-center mb-4" role="progressbar">
          {STEPS.map((s, i) => {
            const sCfg = STATUS_CONFIG[s]
            const isActive  = sCfg.step <= cfg.step
            const isCurrent = s === order.status
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 border-2 transition-all ${
                  isCurrent  ? `border-current ${cfg.color} bg-current scale-125` :
                  isActive   ? `border-current ${cfg.color} bg-current opacity-60` :
                               'border-gray-600 bg-gray-800'
                }`} title={sCfg.label} />
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 transition-all ${
                    isActive && STEPS[i + 1] <= order.status ? `${cfg.color} bg-current` : 'bg-gray-700'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5 mb-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm text-gray-400">
            <span className="font-medium text-gray-300">
              {item.name}
              {item.portionSize === 'half' && (
                <span className="ml-1.5 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">Half</span>
              )}
            </span>
            <span className="text-gray-500 font-bold">×{item.quantity} · ₹{item.price * item.quantity}</span>
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

      {/* Cancelled */}
      {order.status === 'cancelled' && (
        <div className="mt-3 p-3 rounded-xl bg-red-900/10 border border-red-700/20 text-center">
          <p className="text-red-400 font-bold text-sm">Order cancelled. Contact the canteen if needed.</p>
        </div>
      )}

      {/* Delivered */}
      {order.status === 'delivered' && (
        <div className="mt-3 p-3 rounded-xl bg-purple-900/10 border border-purple-700/20 text-center">
          <p className="text-purple-400 font-bold text-sm">✅ Picked up successfully. Enjoy your meal!</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MyOrders() {
  const user = useSelector((s: RootState) => s.User.user)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const prevStatuses = useRef<Record<string, OrderStatus>>({})

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

  const fetchOrders = useCallback(async () => {
    if (!user?.id) return
    try {
      const res = await api.get(`/order/user/${user.id}`)
      if (res.data?.success) {
        const fetched: Order[] = res.data.data || []
        setOrders(fetched)

        // Fire browser notification on status change
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

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 10_000)   // poll every 10s
    return () => clearInterval(interval)
  }, [fetchOrders])

  const active    = orders.filter(o => !['cancelled', 'delivered'].includes(o.status))
  const completed = orders.filter(o => ['cancelled', 'delivered'].includes(o.status))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>My Orders</h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Live updates every 10s · QR code shown when ready
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-xl text-sm font-black border transition-all hover:border-primary/40 hover:text-primary"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          🔄 Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-sm font-bold text-primary animate-pulse">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4 opacity-30">📋</div>
          <p className="font-black text-lg" style={{ color: 'var(--text-main)' }}>No orders yet</p>
          <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Your orders will appear here once placed</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="text-xs font-black uppercase tracking-widest mb-3 text-red-400">
                🔴 Active Orders ({active.length})
              </h2>
              {active.map(o => <OrderCard key={o._id} order={o} />)}
            </section>
          )}
          {completed.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Past Orders
              </h2>
              {completed.map(o => <OrderCard key={o._id} order={o} />)}
            </section>
          )}
        </>
      )}
    </div>
  )
}
