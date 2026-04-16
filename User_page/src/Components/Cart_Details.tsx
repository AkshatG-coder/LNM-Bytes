import { useAppSelector, useAppDispatch } from "../Util/hook"
import { CartItemCard } from "./Cart_ItemCard"
import { clear_all_item } from "../Util/CartReducer"
import { useAppSelector as useSelector } from "../Util/hook"
import api from "../Util/api"
import { useState, useEffect } from "react"
import toast from "react-hot-toast"

export function Cart_Details() {
  const cart_details = useAppSelector((state) => state.Cart.items)
  const user = useSelector((state) => state.User.user)
  const dispatch = useAppDispatch()
  const [placing, setPlacing] = useState(false)
  const [isNightDelivery, setIsNightDelivery] = useState(false)
  const [storeStatus, setStoreStatus] = useState({ open: true, onlineAvailable: true, nightDeliveryCharge: 10, nightDeliveryEnabled: false })

  // Fetch store status for the canteen in cart
  const canteenId = cart_details[0]?.canteen_id
  useEffect(() => {
    if (canteenId) {
      api.get(`/store_handler/${canteenId}`)
        .then(res => {
          if (res.data?.success) {
            setStoreStatus({
              open: res.data.data.status === 'open',
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
      toast.error("Please login to place an order!")
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
          if (isNightDelivery) {
            toast.success("Night Delivery order placed! Your food will be delivered to you soon. 🌙")
          } else {
            toast.success("Order placed! Please pick it up at the counter after it's ready.")
          }
        } else {
          // ── Cashfree online payment flow ──────────────────────────────────
          // IMPORTANT: Do NOT clear the cart here — if the user cancels or payment
          // fails, the cart should still be intact. Cart is cleared after the
          // payment is successfully verified in MyOrders (via /verify-payment).
          const sessionId = response.data.data?.payment_session_id

          if (sessionId && window.Cashfree) {
            const cashfree = window.Cashfree({ mode: "sandbox" })
            cashfree.checkout({ paymentSessionId: sessionId })
            // Cashfree redirects back to /orders?order_id=... on success
            // MyOrders page calls /verify-payment and then clears the cart
          } else if (sessionId && !window.Cashfree) {
            toast.error("Cashfree SDK not loaded. Please refresh and try again.")
          } else {
            toast.error("No payment session returned. Please try again.")
          }
        }
      } else {
        const errMsg = response.data?.message || "Failed to place order."
        toast.error(errMsg)
      }
    } catch (err: any) {
      console.error(err)
      const msg = err.response?.data?.message || "Failed to place order. Please try again."
      toast.error(msg)
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="border-b px-4 py-4 sticky top-0 z-10 backdrop-blur-sm"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-primary tracking-tight">
              🛒 Your Cart
            </h1>
            <p className="text-xs sm:text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {cart_details.length} item{cart_details.length !== 1 ? 's' : ''} · Review before checkout
            </p>
          </div>

          {cart_details.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-xs sm:text-sm font-bold text-red-400 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-3 max-w-2xl mx-auto w-full">
        {cart_details.length > 0 ? (
          cart_details.map((item, index) => (
            <CartItemCard
              key={`${item.id}__${item.portionSize}__${index}`}
              item_name={item.item_name}
              price={item.price}
              qty={item.qty}
              portionSize={item.portionSize}
              itemId={item.id}
            />
          ))
        ) : (
          <div
            className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <span className="text-5xl sm:text-6xl mb-4 opacity-50">🛒</span>
            <h3 className="text-lg sm:text-xl font-black" style={{ color: 'var(--text-main)' }}>Cart is empty</h3>
            <p className="mt-2 font-medium text-center px-4" style={{ color: 'var(--text-muted)' }}>
              Browse canteens and add some delicious items!
            </p>
          </div>
        )}
      </div>

      {/* Checkout Bar */}
      {cart_details.length > 0 && (
        <div
          className="sticky bottom-0 border-t px-3 sm:px-4 py-4 backdrop-blur-sm"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Night Delivery Toggle */}
            <div className="flex justify-between items-center px-1">
              <label htmlFor="nightDelivery" className="font-bold flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-muted)' }}>
                <input
                  id="nightDelivery"
                  type="checkbox"
                  checked={isNightDelivery}
                  onChange={(e) => setIsNightDelivery(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                🌙 Night Delivery
              </label>
              <span className="text-xs font-bold text-gray-400 dark:text-gray-500">(If available)</span>
            </div>

            {/* Subtotal (Optional but good if fee applies) */}
            {isNightDelivery && (
              <>
                <div className="flex justify-between items-center px-1">
                  <span className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>Items Subtotal</span>
                  <span className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center px-1 mb-1">
                  <span className="font-bold text-sm flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Delivery Charge</span>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">Night</span>
                  </span>
                  <span className="font-black text-sm text-primary">+ ₹{deliveryCharge.toFixed(2)}</span>
                </div>
              </>
            )}

            {/* Total */}
            <div className="flex justify-between items-center px-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
              <span className="font-black" style={{ color: 'var(--text-main)' }}>Grand Total</span>
              <span className="text-xl font-black text-primary">₹{total.toFixed(2)}</span>
            </div>

            {/* Paused Banner */}
            {(!storeStatus.onlineAvailable || (!storeStatus.open && (!isNightDelivery || !storeStatus.nightDeliveryEnabled))) && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
                <p className="text-yellow-600 font-bold text-xs">
                  {!storeStatus.open ? '🔴 Canteen is currently CLOSED' : '⚠️ App Ordering is Paused'}
                </p>
                <p className="text-gray-500 text-[10px] mt-0.5">
                  {!storeStatus.open && storeStatus.nightDeliveryEnabled
                    ? 'Check "Night Delivery" above to order after-hours!'
                    : 'The kitchen is not accepting new app orders right now.'}
                </p>
              </div>
            )}

            {/* Pay Online */}
            <button
              onClick={() => placeOrder('online')}
              disabled={placing || !storeStatus.onlineAvailable || (!storeStatus.open && (!isNightDelivery || !storeStatus.nightDeliveryEnabled))}
              className="w-full bg-primary text-white py-4 rounded-xl font-black text-sm sm:text-base hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-40 disabled:grayscale-[0.5]"
            >
              {placing ? '⏳ Placing...' : `💳 Pay Online ₹${total.toFixed(2)}`}
            </button>

            {/* Pay at Counter */}
            <button
              onClick={() => placeOrder('cash')}
              disabled={placing || !storeStatus.onlineAvailable || (!storeStatus.open && (!isNightDelivery || !storeStatus.nightDeliveryEnabled))}
              className="w-full border-2 border-primary/30 text-primary py-3.5 rounded-xl font-black text-sm sm:text-base hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {placing ? '⏳ Placing...' : `💵 Pay at Counter · ₹${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
