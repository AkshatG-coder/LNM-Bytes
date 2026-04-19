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
  const [isOnlineOrderAvailable, setIsOnlineOrderAvailable] = useState<boolean>(true)
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
          setIsOnlineOrderAvailable(storeRes.data.data.isOnlineOrderAvailable ?? true)
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
      className="min-h-screen py-6 sm:py-10 px-3 sm:px-4 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 sm:mb-10">
        <div className="flex items-center gap-2 sm:gap-3 mb-1">
          <h2
            className="text-2xl sm:text-3xl font-black tracking-tight"
            style={{ color: 'var(--text-main)' }}
          >
            {storeName} <span className="text-primary">Menu</span>
          </h2>
          {storeStatus === "closed" && (
            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold text-xs">
              Closed
            </span>
          )}
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          Freshly prepared items available here
        </p>

        {/* Global Pause Alert */}
        {!isOnlineOrderAvailable && storeStatus === "open" && (
          <div className="mt-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <span className="text-yellow-600 text-xl">⚠️</span>
            <div>
              <h4 className="text-sm font-black text-yellow-700 dark:text-yellow-500">App Orders Paused</h4>
              <p className="text-xs font-semibold text-yellow-600/80 dark:text-yellow-500/80 mt-0.5">
                The kitchen is currently busy. You can browse the menu but cannot place orders through the app right now.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 sm:mt-8">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setsearchText(e.target.value)}
              placeholder="What are you craving today?"
              className="w-full px-4 py-2.5 sm:py-3 border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium text-sm"
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
          
          {/* Category Tabs / Quick Links */}
          {!isLoading && categories.length > 0 && (
            <div className="mt-6 w-full overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-3 pb-2 w-max">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      const element = document.getElementById(`category-${cat}`);
                      if (element) {
                        // Offset for sticky headers if any, or just scroll to center/start
                        const y = element.getBoundingClientRect().top + window.scrollY - 100;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                      }
                    }}
                    className="px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap transition-all shadow-sm active:scale-95"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--text-main)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--primary)';
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--surface)';
                      e.currentTarget.style.color = 'var(--text-main)';
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              <div key={cat} id={`category-${cat}`} className="space-y-6 scroll-mt-24">
                <h3 className="text-2xl font-black uppercase tracking-wider relative inline-block" style={{ color: 'var(--text-main)' }}>
                  {cat}
                  <div className="absolute -bottom-2 left-0 w-12 h-1 bg-primary rounded-full"></div>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pt-4">
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
                      isOnlineOrderAvailable={isOnlineOrderAvailable}
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
