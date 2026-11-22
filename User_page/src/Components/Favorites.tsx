import { useCallback, useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppSelector } from '../Util/hook'
import { add_item, clear_all_item, increase_item } from '../Util/CartReducer'
import { cartHasOtherCanteen, fetchFavorites, type FavoriteItem } from '../Util/reorder'

/** The student's most-ordered items, one tap to add to the cart. Hidden until they have some. */
export default function Favorites() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const cart = useAppSelector((s) => s.Cart.items)
  const [items, setItems] = useState<FavoriteItem[]>([])

  useEffect(() => {
    let alive = true
    fetchFavorites()
      .then((f) => { if (alive) setItems(f) })
      .catch(() => { /* favourites are a bonus, so a failure just hides the strip */ })
    return () => { alive = false }
  }, [])

  const add = useCallback((f: FavoriteItem) => {
    if (!f.canOrder) {
      toast.error(f.closedReason || `${f.storeName} is not taking orders right now.`)
      return
    }
    if (cartHasOtherCanteen(cart, f.storeId)) {
      const ok = window.confirm('Your cart has items from another canteen. Replace it with this item?')
      if (!ok) return
      dispatch(clear_all_item())
    }
    const inCart = cart.find((c) => c.id === f.id && c.portionSize === 'full' && c.canteen_id === f.storeId)
    if (inCart) {
      dispatch(increase_item({ id: f.id, portionSize: 'full' }))
    } else {
      dispatch(add_item({ id: f.id, item_name: f.name, price: f.price, qty: 1, canteen_id: f.storeId, portionSize: 'full' }))
    }
    toast.success(`${f.name} added to cart`, { id: `fav-${f.id}` })
  }, [cart, dispatch])

  if (items.length === 0) return null

  return (
    <section className="mb-6" aria-label="Your favourites">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-lg font-extrabold" style={{ color: 'var(--text-main)' }}>Your favourites</h2>
        {cart.length > 0 && (
          <button
            onClick={() => navigate('/cart')}
            className="text-sm font-bold text-brand hover:underline"
          >
            View cart ({cart.reduce((n, c) => n + c.qty, 0)})
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map((f) => (
          <div
            key={f.id}
            className="snap-start shrink-0 w-44 rounded-2xl border p-3 flex flex-col"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', opacity: f.canOrder ? 1 : 0.6 }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`inline-block w-2.5 h-2.5 rounded-sm border ${f.isVeg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center`}
                aria-label={f.isVeg ? 'Veg' : 'Non-veg'}
              >
                <span className={`block w-1.5 h-1.5 rounded-full mx-auto ${f.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
              </span>
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-main)' }} title={f.name}>{f.name}</p>
            </div>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{f.storeName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ordered {f.timesOrdered}×</p>
            <div className="mt-auto pt-2 flex items-center justify-between">
              <span className="text-sm font-black" style={{ color: 'var(--text-main)' }}>₹{f.price}</span>
              <button
                onClick={() => add(f)}
                aria-disabled={!f.canOrder}
                className="px-3 h-8 rounded-lg text-sm font-extrabold bg-primary text-on-primary active:scale-95 transition-transform"
              >
                {f.canOrder ? 'Add' : 'Closed'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
