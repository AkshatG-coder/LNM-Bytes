import { useAppSelector, useAppDispatch } from "../Util/hook"
import { CartItemCard } from "./Cart_ItemCard"
import { clear_all_item } from "../Util/CartReducer"
import { useAppSelector as useSelector } from "../Util/hook"
import api from "../Util/api"
import { announceOrdersChanged } from '../Util/orderText'
import { useState, useEffect } from "react"
import toast from "react-hot-toast"
import { Link, useNavigate } from "react-router-dom"
import { payWithRazorpay } from "../Util/razorpay"

function withinHoursIST(t?: { openTime?: string; closeTime?: string }): boolean {
  if (!t?.openTime || !t?.closeTime) return true
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' })
  return t.closeTime < t.openTime ? now >= t.openTime || now <= t.closeTime : now >= t.openTime && now <= t.closeTime
}

export function Cart_Details() {
  const cart_details = useAppSelector((state) => state.Cart.items)
  const user = useSelector((state) => state.User.user)
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [placing, setPlacing] = useState(false)
  const [isNightDelivery, setIsNightDelivery] = useState(false)
  const [storeStatus, setStoreStatus] = useState({ name: '', open: true, inHours: true, onlineAvailable: true, nightDeliveryCharge: 10, nightDeliveryEnabled: false })

  // Fetch store status for the canteen in cart
  const canteenId = cart_details[0]?.canteen_id
  useEffect(() => {
    if (canteenId) {
      api.get(`/store_handler/${canteenId}`)
        .then(res => {
          if (res.data?.success) {
            setStoreStatus({
              name: res.data.data.name ?? '',
              // open = the owner has not closed the shop by hand; inHours = inside opening hours (IST)
              open: res.data.data.status === 'open' && res.data.data.isActive !== false,
              inHours: withinHoursIST(res.data.data.operationTime),
              onlineAvailable: res.data.data.isOnlineOrderAvailable ?? true,
              nightDeliveryCharge: res.data.data.nightDeliveryCharge ?? 10,
              nightDeliveryEnabled: res.data.data.nightDelivery ?? false
            })
          }
        })
        .catch(() => {})
    }
  }, [canteenId])

  const subtotal = cart_details.reduce((acc, item) => acc + item.price * item.qty, 0)
  const deliveryCharge = isNightDelivery ? storeStatus.nightDeliveryCharge : 0
  const total = subtotal + deliveryCharge

  function handleClearCart() {
    dispatch(clear_all_item())
  }

  async function placeOrder(paymentType: 'cash' | 'online') {
    if (!user) {
      toast.error("Sign in to place an order.")
      return
    }

    setPlacing(true)
    try {
      const items = cart_details.map(item => ({
        menuItemId: item.id,
        name: item.item_name,
        quantity: item.qty,
        price: item.price,
        portionSize: item.portionSize,
      }))

      const response = await api.post('/order/create', {
        userId: user.id,
        storeId: cart_details[0].canteen_id,
        items,
        totalAmount: total,
        deliveryType: isNightDelivery ? 'night_delivery' : 'pickup',
        paymentType,
      })

      if (response.data?.success) {
        if (paymentType === 'cash') {
          dispatch(clear_all_item())
          announceOrdersChanged()
          if (isNightDelivery) {
            toast.success("Order placed. It will be delivered to you after hours.")
          } else {
            toast.success("Order placed. Pick it up at the counter when it is ready.")
          }
        } else {
          // Online payment: the cart is cleared only after the server confirms the payment,
          // so a cancelled or failed payment leaves the cart intact.
          const order = response.data.data
          if (!order?.razorpay) {
            toast.error("The payment could not start. Try again.")
          } else {
            try {
              const outcome = await payWithRazorpay(String(order._id), order.razorpay)
              if (outcome === 'paid') {
                dispatch(clear_all_item())
                announceOrdersChanged()
                toast.success("Payment done. Your order is placed.")
                navigate('/orders')
              } else if (outcome === 'failed') {
                toast.error("We could not confirm the payment. If money was deducted, check My Orders or ask at the counter.")
                navigate('/orders')
              } else {
                toast("Payment cancelled. Your cart is still here.")
              }
            } catch (e: any) {
              toast.error(e?.message || "Payment could not load. Try again.")
            }
          }
        }
      } else {
        const errMsg = response.data?.message || "Failed to place order."
        toast.error(errMsg)
      }
    } catch (err: unknown) {
      console.error(err)
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "The order could not be placed. Try again."
      toast.error(msg)
    } finally {
      setPlacing(false)
    }
  }

  const afterHours = storeStatus.open && !storeStatus.inHours
  const cannotOrder = !storeStatus.onlineAvailable || !storeStatus.open || (afterHours && !(isNightDelivery && storeStatus.nightDeliveryEnabled))
  const totalQty = cart_details.reduce((n, c) => n + c.qty, 0)

  if (cart_details.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 pt-16 pb-10 text-center">
        <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-main)' }}>Your cart is empty</h1>
        <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>Pick a canteen and add what you feel like eating.</p>
        <Link to="/" className="inline-flex items-center mt-6 px-5 h-11 rounded-xl bg-primary text-on-primary font-extrabold hover:bg-primary-dark">
          Browse canteens
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 pt-6 pb-10">
      <h1 className="text-3xl font-extrabold mb-4" style={{ color: 'var(--text-main)' }}>Your cart</h1>

      {/* The order slip. The notches line up with the tear line under the header. */}
      <div className="slip" style={{ ['--notch-y' as string]: 'calc(5rem - 1px)' }}>
        <div className="perf h-20 px-5 flex items-center justify-between" style={{ borderTop: 'none', borderBottom: '2px dashed var(--border)' }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Ordering from</p>
            <p className="font-display text-xl font-extrabold truncate" style={{ color: 'var(--text-main)' }}>
              {storeStatus.name || 'Your canteen'}
            </p>
          </div>
          <button
            onClick={handleClearCart}
            className="shrink-0 px-3 h-9 rounded-lg text-sm font-bold hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--text-muted)' }}
          >
            Clear cart
          </button>
        </div>

        <ul className="px-5 py-2 divide-y" style={{ borderColor: 'var(--border)' }}>
          {cart_details.map((item, index) => (
            <li key={`${item.id}__${item.portionSize}__${index}`} className="py-3.5" style={{ borderColor: 'var(--border)' }}>
              <CartItemCard
                item_name={item.item_name}
                price={item.price}
                qty={item.qty}
                portionSize={item.portionSize}
                itemId={item.id}
              />
            </li>
          ))}
        </ul>

        <div className="perf px-5 pt-4 pb-5 space-y-3" style={{ borderTop: '2px dashed var(--border)' }}>
          {storeStatus.nightDeliveryEnabled && (
            <label htmlFor="nightDelivery" className="flex items-center justify-between gap-3 cursor-pointer py-1">
              <span>
                <span className="block text-sm font-bold" style={{ color: 'var(--text-main)' }}>Night delivery</span>
                <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>Brought to you after hours for ₹{storeStatus.nightDeliveryCharge} extra</span>
              </span>
              <input
                id="nightDelivery"
                type="checkbox"
                role="switch"
                checked={isNightDelivery}
                onChange={(e) => setIsNightDelivery(e.target.checked)}
                className="w-5 h-5 accent-[#F5B400]"
              />
            </label>
          )}

          <dl className="space-y-1.5 text-sm font-semibold tnum" style={{ color: 'var(--text-main)' }}>
            <div className="flex items-end gap-2">
              <dt>Items ({totalQty})</dt><span className="leader" aria-hidden /><dd>₹{subtotal.toFixed(2)}</dd>
            </div>
            {isNightDelivery && (
              <div className="flex items-end gap-2">
                <dt>Night delivery</dt><span className="leader" aria-hidden /><dd>₹{deliveryCharge.toFixed(2)}</dd>
              </div>
            )}
            <div className="flex items-end gap-2 pt-1 text-xl font-extrabold font-display">
              <dt>Total</dt><span className="leader" aria-hidden /><dd>₹{total.toFixed(2)}</dd>
            </div>
          </dl>

          {cannotOrder && (
            <div className="rounded-xl border p-3 text-sm" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--primary) 55%, transparent)', color: 'var(--text-main)' }} role="alert">
              <p className="font-extrabold">{!storeStatus.open ? 'This canteen is closed' : afterHours ? 'This canteen is closed for the day' : 'App orders are paused'}</p>
              <p className="mt-0.5">
                {!storeStatus.open
                  ? 'The owner has closed the canteen for now. Try again later.'
                  : afterHours && storeStatus.nightDeliveryEnabled
                  ? 'Turn on night delivery above to order after hours.'
                  : afterHours
                  ? 'It is outside opening hours. Come back when it opens.'
                  : 'The kitchen is not taking app orders right now. Try again in a little while.'}
              </p>
            </div>
          )}

          <button
            onClick={() => placeOrder('online')}
            disabled={placing || cannotOrder}
            className="w-full h-12 rounded-xl bg-primary text-on-primary font-extrabold hover:bg-primary-dark active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {placing ? 'Placing your order…' : `Pay online ₹${total.toFixed(2)}`}
          </button>
          <button
            onClick={() => placeOrder('cash')}
            disabled={placing || cannotOrder}
            className="w-full h-12 rounded-xl border-2 font-extrabold hover:bg-[var(--surface-2)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--text-main)', color: 'var(--text-main)' }}
          >
            {placing ? 'Placing your order…' : `Pay at counter ₹${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
