import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../Util/store'
import api from '../Util/api'

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'cancelled' | 'delivered'

interface Order {
  _id: string
  status: OrderStatus
  totalAmount: number
  paymentType: 'cash' | 'online'
  paymentStatus: string
  createdAt: string
  items: { name: string; quantity: number; price: number; portionSize?: string }[]
  storeId: string
  orderNote?: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: string; color: string; bg: string; step: number }> = {
  pending:   { label: 'Order Placed',    icon: '🕐', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', step: 1 },
  preparing: { label: 'Being Prepared',  icon: '🍳', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/30', step: 2 },
  ready:     { label: 'Ready for Pickup',icon: '🛎️', color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/30',  step: 3 },
  delivered: { label: 'Picked Up',       icon: '✅', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30',step: 4 },
  cancelled: { label: 'Cancelled',        icon: '❌', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',      step: 0 },
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`
}

// ─── Single order status tracker card ────────────────────────────────────────
function OrderCard({ order }: { order: Order }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const steps: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']
  const isCancelled = order.status === 'cancelled'

  return (
    <div className={`rounded-2xl border p-5 mb-4 transition-all ${cfg.bg}`} style={{ backgroundColor: 'var(--surface)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{cfg.icon}</span>
            <span className={`text-lg font-black ${cfg.color}`}>{cfg.label}</span>
          </div>
          <div className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>
            Order #{order._id.slice(-6).toUpperCase()} · {timeAgo(order.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black" style={{ color: 'var(--text-main)' }}>₹{order.totalAmount}</div>
          <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            {order.paymentType === 'cash' ? '💵 Pay at Counter' : '💳 Online'}
          </div>
        </div>
      </div>

      {/* Progress bar (not shown for cancelled) */}
      {!isCancelled && (
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => {
            const sConfig = STATUS_CONFIG[s]
            const isActive = sConfig.step <= cfg.step
            const isCurrent = s === order.status
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex-1 h-1.5 rounded-full transition-all ${isActive ? 'bg-current' : 'opacity-20 bg-gray-500'} ${isCurrent ? cfg.color : ''}`} />
                {i < steps.length - 1 && (
                  <div className={`w-2 h-2 rounded-full mx-0.5 flex-shrink-0 ${isActive ? `${cfg.color} bg-current` : 'bg-gray-600'}`} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5">
        {order.items.map((item, i) => (
          <div key={i} className="flex justify-between text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="font-medium">
              {item.name}
              {item.portionSize === 'half' && <span className="ml-1 text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded-full">Half</span>}
            </span>
            <span className="font-bold">×{item.quantity} · ₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Ready message */}
      {order.status === 'ready' && (
        <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
          <p className="text-green-400 font-black text-sm">🛎️ Come pick up your order from the counter!</p>
        </div>
      )}
      {order.status === 'cancelled' && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
          <p className="text-red-400 font-black text-sm">Your order was cancelled. Contact the canteen if needed.</p>
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

  async function fetchOrders() {
    if (!user?.id) return
    try {
      const res = await api.get(`/order/user/${user.id}`)
      if (res.data?.success) {
        const fetched: Order[] = res.data.data || []
        setOrders(fetched)

        // Check for status changes and notify
        fetched.forEach(order => {
          const prev = prevStatuses.current[order._id]
          if (prev && prev !== order.status) {
            const cfg = STATUS_CONFIG[order.status]
            if (cfg) {
              pushNotification(
                `LNM Bytes — Order Update`,
                `${cfg.icon} ${cfg.label} — Order #${order._id.slice(-6).toUpperCase()}`
              )
            }
          }
          prevStatuses.current[order._id] = order.status
        })
      }
    } catch (e) {
      console.error('Failed to fetch orders:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 10_000)   // poll every 10s
    return () => clearInterval(interval)
  }, [user?.id])

  const active    = orders.filter(o => !['cancelled', 'delivered'].includes(o.status))
  const completed = orders.filter(o => ['cancelled', 'delivered'].includes(o.status))

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-main)' }}>My Orders</h1>
          <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Updates every 10 seconds automatically
          </p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 rounded-xl text-sm font-black border transition-all"
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
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                🔴 Active Orders
              </h2>
              {active.map(o => <OrderCard key={o._id} order={o} />)}
            </div>
          )}
          {completed.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Past Orders
              </h2>
              {completed.map(o => <OrderCard key={o._id} order={o} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
