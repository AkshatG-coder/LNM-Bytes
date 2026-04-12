import { useAppSelector, useAppDispatch } from "../Util/hook"
import { CartItemCard } from "./Cart_ItemCard"
import { clear_all_item } from "../Util/CartReducer"
import { useAppSelector as useSelector } from "../Util/hook"
import api from "../Util/api"
import { useState } from "react"

export function Cart_Details() {
  const cart_details = useAppSelector((state) => state.Cart.items)
  const user = useSelector((state) => state.User.user)
  const dispatch = useAppDispatch()
  const [placing, setPlacing] = useState(false)

  const total = cart_details.reduce((acc, item) => acc + item.price * item.qty, 0)

  function handleClearCart() {
    dispatch(clear_all_item())
  }

  async function placeOrder(paymentType: 'cash' | 'online') {
    if (!user) {
      alert("Please login to place an order!")
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
        paymentType,
      })

      if (response.data?.success) {
        dispatch(clear_all_item())
        if (paymentType === 'cash') {
          alert("✅ Order placed! Please pick it up at the counter after it's ready.")
        } else {
          // Cashfree integration placeholder
          alert("✅ Order placed! Pay at the counter when ready (online payment coming soon).")
        }
      } else {
        alert("Failed to place order. Please try again.")
      }
    } catch (err) {
      console.error(err)
      alert("Failed to place order. Please try again.")
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
        className="border-b px-4 py-5 sticky top-0 z-10 backdrop-blur-sm"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight">
              🛒 Your Cart
            </h1>
            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {cart_details.length} item{cart_details.length !== 1 ? 's' : ''} · Review before checkout
            </p>
          </div>

          {cart_details.length > 0 && (
            <button
              onClick={handleClearCart}
              className="text-sm font-bold text-red-400 hover:text-red-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent hover:border-red-100"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="flex-1 px-4 py-6 space-y-4 max-w-3xl mx-auto w-full">
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
            className="flex flex-col items-center justify-center py-32 rounded-3xl border-2 border-dashed"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <span className="text-6xl mb-4 opacity-50">🛒</span>
            <h3 className="text-xl font-black" style={{ color: 'var(--text-main)' }}>Cart is empty</h3>
            <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>Browse canteens and add some delicious items!</p>
          </div>
        )}
      </div>

      {/* Checkout Bar */}
      {cart_details.length > 0 && (
        <div
          className="sticky bottom-0 border-t px-4 py-4 backdrop-blur-sm"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Total */}
            <div className="flex justify-between items-center px-1">
              <span className="font-bold" style={{ color: 'var(--text-muted)' }}>Total</span>
              <span className="text-xl font-black text-primary">₹{total.toFixed(2)}</span>
            </div>

            {/* Pay Online */}
            <button
              onClick={() => placeOrder('online')}
              disabled={placing}
              className="w-full bg-primary text-white py-4 rounded-xl font-black text-base hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-[0.98] disabled:opacity-60"
            >
              {placing ? '⏳ Placing...' : `💳 Pay Online ₹${total.toFixed(2)}`}
            </button>

            {/* Pay at Counter */}
            <button
              onClick={() => placeOrder('cash')}
              disabled={placing}
              className="w-full border-2 border-primary/30 text-primary py-3.5 rounded-xl font-black text-base hover:bg-primary/5 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {placing ? '⏳ Placing...' : `💵 Pay at Counter · ₹${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
