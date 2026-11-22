import type { FC } from "react"
import { useAppDispatch } from "../Util/hook"
import { increase_item, decrease_item, delete_item } from "../Util/CartReducer"

interface CartItemCardProps {
  item_name: string
  price: number
  qty: number
  portionSize: 'full' | 'half'
  itemId: string
}

/** One line on the order slip: name ........ price, with the quantity controls underneath. */
export const CartItemCard: FC<CartItemCardProps> = ({ item_name, price, qty, portionSize, itemId }) => {
  const dispatch = useAppDispatch()

  return (
    <div>
      <div className="flex items-end gap-2">
        <span className="font-bold leading-snug" style={{ color: 'var(--text-main)' }}>
          {item_name}
          {portionSize === 'half' && (
            <span className="ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-extrabold align-middle" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              Half
            </span>
          )}
        </span>
        <span className="leader" aria-hidden />
        <span className="font-extrabold tnum" style={{ color: 'var(--text-main)' }}>₹{(price * qty).toFixed(0)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="inline-flex items-center h-9 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => dispatch(decrease_item({ id: itemId, portionSize }))}
              aria-label={`Remove one ${item_name}`}
              className="w-9 h-full flex items-center justify-center text-lg font-extrabold rounded-l-lg hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-main)' }}
            >
              −
            </button>
            <span className="w-8 text-center font-extrabold text-sm tnum" style={{ color: 'var(--text-main)' }} aria-live="polite">{qty}</span>
            <button
              onClick={() => dispatch(increase_item({ id: itemId, portionSize }))}
              aria-label={`Add one more ${item_name}`}
              className="w-9 h-full flex items-center justify-center text-lg font-extrabold bg-primary text-on-primary rounded-r-[7px] hover:bg-primary-dark"
            >
              +
            </button>
          </div>
          <span className="ml-2 text-xs font-medium tnum" style={{ color: 'var(--text-muted)' }}>₹{price} each</span>
        </div>

        <button
          onClick={() => dispatch(delete_item({ id: itemId, portionSize }))}
          className="px-2 h-8 rounded-lg text-xs font-bold hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--text-muted)' }}
        >
          Remove
        </button>
      </div>
    </div>
  )
}
