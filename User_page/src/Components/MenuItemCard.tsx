import { useState } from "react"
import { useAppSelector, useAppDispatch } from "../Util/hook"
import { add_item, increase_item, decrease_item } from "../Util/CartReducer"
import { useFoodImage } from "../Util/useFoodImage"

export interface MenuCardItemInterface {
  _id: string
  name: string
  price: number          // full price
  halfPrice?: number | null
  hasHalf?: boolean
  image?: string
  isAvailable: boolean
  isVeg?: boolean
  category?: string
  storeId: string
  storeStatus?: string // added to check if store is open
  isOnlineOrderAvailable?: boolean
}

export function MenuItemCard({
  _id,
  name,
  price,
  halfPrice,
  hasHalf,
  image,
  isAvailable,
  isVeg,
  category,
  storeId,
  storeStatus = "open",
  isOnlineOrderAvailable = true,
}: MenuCardItemInterface) {
  const dispatch = useAppDispatch()
  const cart_items = useAppSelector((state) => state.Cart.items)

  const [selectedPortion, setSelectedPortion] = useState<'full' | 'half'>('full')

  const selectedPrice = selectedPortion === 'half' && halfPrice ? halfPrice : price

  const cartItem = cart_items.find(
    (item) => item.id === _id && item.portionSize === selectedPortion
  )
  const qty = cartItem?.qty ?? 0

  // Fetch Pexels image only when no manual image is supplied
  const pexelsImage = useFoodImage(image ? "" : name)
  const displayImage = image || pexelsImage

  function handleAdd() {
    if (storeStatus !== "open") {
      alert("Sorry, this shop is currently closed 🚫")
      return
    }
    if (!isOnlineOrderAvailable) {
      alert("App orders are currently paused for this shop ⏸️")
      return
    }
    if (cart_items.length === 0) {
      dispatch(add_item({ id: _id, item_name: name, price: selectedPrice, qty: 1, canteen_id: storeId, portionSize: selectedPortion }))
      return
    }
    if (cart_items[0].canteen_id !== storeId) {
      alert("You can only add items from the same canteen 🍽️")
      return
    }
    if (cartItem) {
      dispatch(increase_item({ id: _id, portionSize: selectedPortion }))
    } else {
      dispatch(add_item({ id: _id, item_name: name, price: selectedPrice, qty: 1, canteen_id: storeId, portionSize: selectedPortion }))
    }
  }

  function handleRemove() {
    if (qty > 0) dispatch(decrease_item({ id: _id, portionSize: selectedPortion }))
  }

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-md hover:shadow-xl transition-all duration-300 group"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Image */}
      <div className="h-32 sm:h-40 relative overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
        {displayImage ? (
          <img
            src={displayImage}
            alt={name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          /* Shimmer skeleton while Pexels loads */
          <div className="h-full w-full animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700" />
        )}

        {!isAvailable && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-white/90 text-red-600 px-3 py-1 rounded-full font-bold text-xs shadow-sm">
              Sold Out
            </span>
          </div>
        )}
        {isVeg !== undefined && (
          <div className="absolute top-2 right-2">
            <span className={`text-[10px] font-black px-2 py-1 rounded-full shadow-sm ${isVeg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
              {isVeg ? '🟢' : '🔴'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 flex flex-col gap-2 sm:gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold line-clamp-1" style={{ color: 'var(--text-main)' }}>
            {name}
          </h2>
          {category && (
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
              {category}
            </span>
          )}
        </div>

        {/* Full / Half Toggle */}
        {hasHalf && halfPrice && isAvailable && (
          <div
            className="flex rounded-lg p-0.5 gap-0.5 border"
            style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
          >
            <button
              onClick={() => setSelectedPortion('full')}
              className={`flex-1 py-1 rounded-md text-[11px] font-black transition-all ${
                selectedPortion === 'full'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Full · ₹{price}
            </button>
            <button
              onClick={() => setSelectedPortion('half')}
              className={`flex-1 py-1 rounded-md text-[11px] font-black transition-all ${
                selectedPortion === 'half'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Half · ₹{halfPrice}
            </button>
          </div>
        )}

        {/* Price row */}
        <div className="flex justify-between items-center">
          <span className="text-primary font-extrabold text-lg sm:text-xl">₹{selectedPrice}</span>
          {isAvailable && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md bg-green-100 text-green-700 font-bold border border-green-200">
              In Stock
            </span>
          )}
        </div>

        {/* Quantity Controls or Paused Badge */}
        {isAvailable && (
          isOnlineOrderAvailable ? (
            <div
              className="flex items-center justify-between rounded-lg p-1.5 sm:p-2 mt-0.5"
              style={{ backgroundColor: 'var(--bg)' }}
            >
              <button
                onClick={handleRemove}
                disabled={qty === 0}
                className="w-8 h-8 rounded-md border flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg transition-colors"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                −
              </button>
              <span className="font-bold text-base" style={{ color: 'var(--text-main)' }}>{qty}</span>
              <button
                onClick={handleAdd}
                className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors shadow-sm font-bold text-lg"
              >
                +
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg p-3 mt-0.5 border border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50">
              <span className="font-bold text-xs text-gray-400 uppercase tracking-widest">
                ⏸️ Orders Paused
              </span>
            </div>
          )
        )}
      </div>
    </div>
  )
}
