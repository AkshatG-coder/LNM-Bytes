import { useAppSelector, useAppDispatch } from "../Util/hook"
import { add_item, increase_item, decrease_item } from "../Util/CartReducer"

export interface MenuCardItemInterface {
  _id: string
  name: string
  price: number
  image?: string
  isAvailable: boolean
  isVeg?: boolean
  category?: string
  storeId: string
}

export function MenuItemCard({
  _id,
  name,
  price,
  image,
  isAvailable,
  isVeg,
  category,
  storeId,
}: MenuCardItemInterface) {
  const dispatch = useAppDispatch()
  const cart_items = useAppSelector((state) => state.Cart.items)

  const cartItem = cart_items.find((item) => item.id === _id)
  const qty = cartItem?.qty ?? 0

  function handleAdd() {
    if (cart_items.length === 0) {
      dispatch(add_item({ id: _id, item_name: name, price, qty: 1, canteen_id: storeId }))
      return
    }
    if (cart_items[0].canteen_id !== storeId) {
      alert("You can only add items from the same canteen 🍽️")
      return
    }
    if (cartItem) {
      dispatch(increase_item(_id))
    } else {
      dispatch(add_item({ id: _id, item_name: name, price, qty: 1, canteen_id: storeId }))
    }
  }

  function handleRemove() {
    if (qty > 0) dispatch(decrease_item(_id))
  }

  return (
    <div
      className="rounded-xl overflow-hidden border shadow-lg hover:shadow-xl transition-all duration-300 group"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Image */}
      <div className="h-40 relative overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
        <img
          src={image ?? `https://picsum.photos/seed/${_id}/400/300`}
          alt={name}
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="bg-white/90 text-red-600 px-3 py-1 rounded-full font-bold text-sm shadow-sm">
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
      <div className="p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-base font-bold line-clamp-1" style={{ color: 'var(--text-main)' }}>
            {name}
          </h2>
          {category && (
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
              {category}
            </span>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-primary font-extrabold text-xl">₹{price}</span>
          {isAvailable && (
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-green-100 text-green-700 font-bold border border-green-200">
              In Stock
            </span>
          )}
        </div>

        {/* Quantity Controls */}
        {isAvailable && (
          <div
            className="flex items-center justify-between rounded-lg p-2 mt-1"
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
        )}
      </div>
    </div>
  )
}
