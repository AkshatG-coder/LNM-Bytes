import type { CanteenStoreInterface } from "../Util/CanteenStoreInterface"
import { Link } from "react-router-dom"
import { Clock, MapPin, Moon } from "lucide-react"
import { RushChip } from "./RushRadar"

const FOOD_TYPE: Record<string, string> = { veg: 'Veg only', 'non-veg': 'Non-veg' }

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
  const open = status === "open"
  return (
    <Link
      to={`/menu_card_shop/${_id}`}
      className="group block rounded-2xl border p-4 sm:p-5 transition-colors hover:border-[var(--text-main)]"
      style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', opacity: open ? 1 : 0.78 }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>
          {name}
        </h2>
        <span
          className="shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-extrabold"
          style={open
            ? { backgroundColor: 'color-mix(in srgb, var(--veg) 16%, transparent)', color: 'var(--veg)' }
            : { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
          {open ? 'Open' : 'Closed'}
        </span>
      </div>

      {open && <div className="mt-2.5 flex"><RushChip storeId={_id} /></div>}

      <p className="mt-2 text-sm line-clamp-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>

      <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-main)' }}>
        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} aria-hidden />{location}</span>
        <span className="flex items-center gap-1.5 tnum"><Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} aria-hidden />{operationTime.openTime} to {operationTime.closeTime}</span>
        {FOOD_TYPE[foodType] && (
          <span className="flex items-center gap-1.5">
            <span className="flex w-3.5 h-3.5 items-center justify-center rounded-[3px] border-2" style={{ borderColor: foodType === 'veg' ? 'var(--veg)' : 'var(--nonveg)' }} aria-hidden>
              <span className="block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: foodType === 'veg' ? 'var(--veg)' : 'var(--nonveg)' }} />
            </span>
            {FOOD_TYPE[foodType]}
          </span>
        )}
        {nightDelivery && (
          <span className="flex items-center gap-1.5"><Moon className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} aria-hidden />Night delivery</span>
        )}
      </div>
    </Link>
  )
}
