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
  const [storeStatus, setStoreStatus] = useState<string>("open")
  const [storeName, setStoreName] = useState<string>("Today's Special")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!id) return

    async function fetchData() {
      try {
        setIsLoading(true)

        // 1. Fetch Store Details
        const storeRes = await api.get(`/store_handler/${id}`)
        if (storeRes.data?.success) {
          setStoreStatus(storeRes.data.data.status)
          setStoreName(storeRes.data.data.name)
        }

        // 2. Fetch Menu Items (Check Cache)
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
        console.error("Failed to fetch menu items/store info:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
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

  // Group items by category
  const groupedByCategory = filteredData.reduce((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, MenuCardItemInterface[]>);

  // Sort categories (you can customize the order if needed)
  const categories = Object.keys(groupedByCategory).sort();

  return (
    <section
      className="min-h-screen py-10 px-4 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-10 text-center md:text-left">
        <div className="flex items-center gap-3 justify-center md:justify-start mb-2">
          <h2
            className="text-3xl font-black tracking-tight"
            style={{ color: 'var(--text-main)' }}
          >
            {storeName} <span className="text-primary">Menu</span>
          </h2>
          {storeStatus === "closed" && (
            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold text-sm">
              Closed
            </span>
          )}
        </div>
        <p className="font-medium" style={{ color: 'var(--text-muted)' }}>
          Freshly prepared items available here
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
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          {categories.length > 0 ? (
            categories.map(cat => (
              <div key={cat} className="space-y-6">
                <h3 className="text-2xl font-black uppercase tracking-wider relative inline-block" style={{ color: 'var(--text-main)' }}>
                  {cat}
                  <div className="absolute -bottom-2 left-0 w-12 h-1 bg-primary rounded-full"></div>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 pt-4">
                  {groupedByCategory[cat].map((item) => (
                    <MenuItemCard
                      key={item._id}
                      _id={item._id}
                      storeId={item.storeId}
                      name={item.name}
                      price={item.price}
                      halfPrice={item.halfPrice}
                      hasHalf={item.hasHalf}
                      image={item.image}
                      isAvailable={item.isAvailable}
                      isVeg={item.isVeg}
                      category={item.category}
                      storeStatus={storeStatus}
                    />
                  ))}
                </div>
              </div>
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
