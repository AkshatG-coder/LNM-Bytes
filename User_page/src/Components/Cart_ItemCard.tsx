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

export const CartItemCard: FC<CartItemCardProps> = ({
  item_name,
  price,
  qty,
  portionSize,
  itemId,
}) => {
  const dispatch = useAppDispatch()

  return (
    <div
      className="rounded-xl border shadow-sm p-4 transition-colors duration-200"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex justify-between items-start">
        {/* Left Info */}
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2
              className="text-base font-bold"
              style={{ color: 'var(--text-main)' }}
            >
              {item_name}
            </h2>
            {/* Portion badge */}
            <span
              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                portionSize === 'full'
                  ? 'bg-orange-100 text-orange-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {portionSize === 'full' ? '🍱 Full' : '🍜 Half'}
            </span>
          </div>
          <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
            ₹{price} each
          </p>
        </div>

        {/* Right Info */}
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-black text-primary">
            ₹{(price * qty).toFixed(0)}
          </p>
        </div>
      </div>

      {/* Quantity Controls */}
      <div className="mt-3 flex items-center justify-between">
        <div
          className="flex items-center gap-3 rounded-lg px-3 py-1.5 border"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}
        >
          <button
            onClick={() => dispatch(decrease_item({ id: itemId, portionSize }))}
            className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-lg transition-colors hover:bg-red-50 hover:text-red-500"
            style={{ color: 'var(--text-muted)' }}
          >
            −
          </button>
          <span className="font-bold text-base w-5 text-center" style={{ color: 'var(--text-main)' }}>
            {qty}
          </span>
          <button
            onClick={() => dispatch(increase_item({ id: itemId, portionSize }))}
            className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors font-bold text-lg"
          >
            +
          </button>
        </div>

        <button
          onClick={() => dispatch(delete_item({ id: itemId, portionSize }))}
          className="text-xs font-bold text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
