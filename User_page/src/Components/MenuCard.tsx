import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { MenuItemCard } from "./MenuItemCard"
import type { MenuCardItemInterface } from "../Util/MenuItemInterface"
import { useSearch } from "../Util/useSearch"
import api from "../Util/api"

const CACHE_TTL = 60_000 // 60 seconds

function getCacheKey(storeId: string) {
  return `lnm_menu_${storeId}`
}

interface MenuCache {
  data: MenuCardItemInterface[]
  ts: number
}

export function MenuCard() {
  const { id } = useParams<{ id: string }>()
  const [menuItems, setMenuItems] = useState<MenuCardItemInterface[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function fetchMenuItems() {
      try {
        setIsLoading(true)

        // sessionStorage cache per store (60s TTL)
        const cacheKey = getCacheKey(id!)
        try {
          const cached = sessionStorage.getItem(cacheKey)
          if (cached) {
            const { data, ts }: MenuCache = JSON.parse(cached)
            if (Date.now() - ts < CACHE_TTL) {
              setMenuItems(data)
              setIsLoading(false)
              return
            }
          }
        } catch { /* ignore parse errors */ }

        const response = await api.get(`/menu_item/store/${id}`)
        if (response.data?.success) {
          const data: MenuCardItemInterface[] = response.data.data
          setMenuItems(data)
          // Cache per storeId so navigating between stores always fetches fresh data
          sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() } satisfies MenuCache))
        }
      } catch (error) {
        console.error("Failed to fetch menu items:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMenuItems()
  }, [id])

  const {
    searchText,
    setsearchText,
    filteredData,
    debounceSearch
  } = useSearch<MenuCardItemInterface>(
    menuItems,
    (item, search) => item.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section
      className="min-h-screen py-10 px-4 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 text-center md:text-left">
        <h2
          className="text-3xl font-black tracking-tight"
          style={{ color: 'var(--text-main)' }}
        >
          Today's Special <span className="text-primary">Menu</span>
        </h2>
        <p className="mt-2 font-medium" style={{ color: 'var(--text-muted)' }}>
          Freshly prepared items available at LNMIIT canteens
        </p>

        <div className="mt-8 flex flex-col md:flex-row items-center gap-4">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setsearchText(e.target.value)}
              placeholder="What are you craving today?"
              className="w-full px-5 py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-main)',
              }}
            />
            {searchText !== debounceSearch && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-bold animate-pulse">Loading menu...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
          {filteredData.length > 0 ? (
            filteredData.map((item) => (
              <MenuItemCard
                key={item._id}
                _id={item._id}
                storeId={item.storeId}
                name={item.name}
                price={item.price}
                image={item.image}
                isAvailable={item.isAvailable}
                isVeg={item.isVeg}
                category={item.category}
              />
            ))
          ) : (
            <div
              className="col-span-full flex flex-col items-center justify-center py-20 rounded-3xl border border-dashed transition-colors duration-300"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="text-5xl mb-4">🍽️</span>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>No items found</h3>
              <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Try searching for something else!</p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
