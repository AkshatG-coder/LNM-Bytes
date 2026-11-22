import { useState } from "react"
import { useAppSelector, useAppDispatch } from "../Util/hook"
import { add_item, increase_item, decrease_item } from "../Util/CartReducer"
import { useFoodImage } from "../Util/useFoodImage"
import toast from "react-hot-toast"

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
      toast.error("This canteen is closed right now.")
      return
    }
    if (!isOnlineOrderAvailable) {
      toast.error("This canteen has paused app orders for now.")
      return
    }
    if (cart_items.length === 0) {
      dispatch(add_item({ id: _id, item_name: name, price: selectedPrice, qty: 1, canteen_id: storeId, portionSize: selectedPortion }))
      return
    }
    if (cart_items[0].canteen_id !== storeId) {
      toast.error("Your cart has items from another canteen. Finish or clear that order first.")
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

  const portionPicker = hasHalf && halfPrice && isAvailable

  return (
    <div
      className="flex gap-3 rounded-2xl border p-3 sm:p-4"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start gap-2">
          {isVeg !== undefined && (
            <span
              role="img"
              aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
              className="mt-1 shrink-0 flex w-4 h-4 items-center justify-center rounded-[3px] border-2"
              style={{ borderColor: isVeg ? 'var(--veg)' : 'var(--nonveg)' }}
            >
              <span className="block w-2 h-2 rounded-full" style={{ backgroundColor: isVeg ? 'var(--veg)' : 'var(--nonveg)' }} />
            </span>
          )}
          <h3 className="text-base font-bold leading-snug line-clamp-2" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
            {name}
          </h3>
        </div>

        <p className="mt-1.5 text-lg font-extrabold tnum" style={{ color: isAvailable ? 'var(--text-main)' : 'var(--text-muted)' }}>
          ₹{selectedPrice}
        </p>

        {portionPicker && (
          <div role="radiogroup" aria-label={`Portion for ${name}`} className="mt-2 inline-flex self-start rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: 'var(--surface-2)' }}>
            {(['full', 'half'] as const).map((p) => (
              <button
                key={p}
                role="radio"
                aria-checked={selectedPortion === p}
                onClick={() => setSelectedPortion(p)}
                className={`px-3 h-7 rounded-md text-xs font-bold ${selectedPortion === p ? 'bg-primary text-on-primary' : ''}`}
                style={selectedPortion === p ? undefined : { color: 'var(--text-muted)' }}
              >
                {p === 'full' ? 'Full' : 'Half'}
              </button>
            ))}
          </div>
        )}

        {!isAvailable && (
          <p className="mt-2 text-xs font-bold" style={{ color: 'var(--nonveg)' }}>Sold out for now</p>
        )}
      </div>

      {/* Photo with the order control tucked under it */}
      <div className="shrink-0 w-28 flex flex-col items-center">
        <div className="w-28 h-24 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--surface-2)' }}>
          {displayImage ? (
            <img
              src={displayImage}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover ${isAvailable ? '' : 'grayscale opacity-60'}`}
            />
          ) : (
            <div className="h-full w-full animate-pulse" style={{ backgroundColor: 'var(--surface-2)' }} />
          )}
        </div>

        {isAvailable && (
          isOnlineOrderAvailable ? (
            qty === 0 ? (
              <button
                onClick={handleAdd}
                aria-label={`Add ${name}${portionPicker ? ` (${selectedPortion})` : ''} to cart`}
                className="relative z-10 -mt-4 w-24 h-9 rounded-lg bg-primary text-on-primary font-extrabold text-sm border-2 hover:bg-primary-dark active:scale-95 transition-transform"
                style={{ borderColor: 'var(--surface)' }}
              >
                Add
              </button>
            ) : (
              <div
                className="relative z-10 -mt-4 w-24 h-9 rounded-lg border-2 flex items-center justify-between bg-primary text-on-primary"
                style={{ borderColor: 'var(--surface)' }}
              >
                <button onClick={handleRemove} aria-label={`Remove one ${name}`} className="w-8 h-full flex items-center justify-center text-lg font-extrabold active:scale-90">
                  −
                </button>
                <span className="font-extrabold text-sm tnum" aria-live="polite">{qty}</span>
                <button onClick={handleAdd} aria-label={`Add one more ${name}`} className="w-8 h-full flex items-center justify-center text-lg font-extrabold active:scale-90">
                  +
                </button>
              </div>
            )
          ) : (
            <p className="mt-2 text-xs font-bold text-center" style={{ color: 'var(--text-muted)' }}>Orders paused</p>
          )
        )}
      </div>
    </div>
  )
}
