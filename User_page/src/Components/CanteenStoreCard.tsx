import type { CanteenStoreInterface } from "../Util/CanteenStoreInterface"
import { Link } from "react-router-dom"

export function CanteenStoreCard({
  name,
  description,
  location,
  foodType,
  status,
  nightDelivery,
  operationTime,
  _id
}: CanteenStoreInterface) {
  return (
    <Link className="block group" to={`/menu_card_shop/${_id}`}>
      <div
        className="rounded-xl shadow-lg overflow-hidden border transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-2xl"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header accent */}
        <div className="h-32 bg-gradient-to-br from-primary-light/10 to-primary/5 flex items-center justify-center border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-primary text-3xl font-black shadow-md"
            style={{ backgroundColor: 'var(--surface)' }}
          >
            {name.charAt(0)}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">

          {/* Name */}
          <h2
            className="text-xl font-black tracking-tight group-hover:text-primary transition-colors"
            style={{ color: 'var(--text-main)' }}
          >
            {name}
          </h2>

          {/* Description */}
          <p
            className="mt-2 text-sm font-medium line-clamp-2 leading-relaxed"
            style={{ color: 'var(--text-muted)' }}
          >
            {description}
          </p>

          {/* Details */}
          <div
            className="mt-4 space-y-2 border-t pt-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              <span className="text-secondary text-base">📍</span> {location}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              <span className="text-primary text-base">🍽️</span> {foodType}
            </div>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              <span className="text-accent text-base">⏰</span> {operationTime.openTime} - {operationTime.closeTime}
            </div>
          </div>

          {/* Status + Night Delivery */}
          <div className="flex items-center justify-between mt-5">
            <span
              className={`text-[10px] uppercase tracking-widest font-black px-3 py-1 rounded-md ${
                status === "open"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-red-100 text-red-700 border border-red-200"
              }`}
            >
              {status}
            </span>

            {nightDelivery && (
              <span className="text-[10px] uppercase tracking-widest font-black bg-primary/10 text-primary px-3 py-1 rounded-md border border-primary/20">
                Night Owl 🌙
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}