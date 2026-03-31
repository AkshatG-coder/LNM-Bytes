import type { FC } from "react"

interface CartItemCardProps {
  item_name: string
  price: number
  qty: number
}

export const CartItemCard: FC<CartItemCardProps> = ({
  item_name,
  price,
  qty,
}) => {
  return (
    <div
      className="rounded-xl border shadow-sm p-4 flex justify-between items-center transition-colors duration-200"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Left Info */}
      <div>
        <h2
          className="text-base font-bold"
          style={{ color: 'var(--text-main)' }}
        >
          {item_name}
        </h2>
        <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Qty: <span className="font-bold">{qty}</span>
        </p>
      </div>

      {/* Right Info */}
      <div className="text-right">
        <p className="text-lg font-black text-primary">
          ₹{(price * qty).toFixed(0)}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ₹{price} each
        </p>
      </div>
    </div>
  )
}
