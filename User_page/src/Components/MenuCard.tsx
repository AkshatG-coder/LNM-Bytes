import { useEffect, useRef, useState } from "react"
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

  // Highlight the chip of the section that is under the sticky bars
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const stripRef = useRef<HTMLDivElement>(null)
  const [headerH, setHeaderH] = useState(64)
  useEffect(() => {
    const measure = () => setHeaderH(document.querySelector('header')?.getBoundingClientRect().height ?? 64)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  const catKey = categories.join('|')
  useEffect(() => {
    if (isLoading || categories.length === 0) return
    let frame = 0
    const update = () => {
      frame = 0
      const line = headerH + 70 + 160 // a little below the chip row, so a heading counts once it is clearly in view
      let current = categories[0]
      for (const c of categories) {
        const el = document.getElementById(`category-${c}`)
        if (el && el.getBoundingClientRect().top <= line) current = c
      }
      setActiveCat(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catKey, isLoading, headerH])
  useEffect(() => {
    // Move the chip row sideways only. scrollIntoView would also scroll the page up and down.
    const strip = stripRef.current
    const chip = activeCat ? chipRefs.current[activeCat] : null
    if (strip && chip) strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [activeCat])

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
        </div>
      </div>

      {/* Category chips. A direct child of the section so it stays pinned under the header for the whole menu */}
      {!isLoading && categories.length > 0 && (
        <div
          ref={stripRef}
          className="sticky z-40 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 mb-6 overflow-x-auto no-scrollbar backdrop-blur-md border-b"
          style={{
            top: headerH,
            backgroundColor: 'color-mix(in srgb, var(--bg) 88%, transparent)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="flex items-center gap-2 w-max max-w-none">
            {categories.map((cat) => (
              <button
                key={cat}
                ref={(el) => { chipRefs.current[cat] = el }}
                aria-current={activeCat === cat ? 'true' : undefined}
                onClick={() => {
                  setActiveCat(cat)
                  const element = document.getElementById(`category-${cat}`)
                  if (element) {
                    const y = element.getBoundingClientRect().top + window.scrollY - headerH - 70
                    window.scrollTo({ top: y, behavior: 'smooth' })
                  }
                }}
                className={`px-4 py-2 rounded-full text-sm font-bold border whitespace-nowrap capitalize transition-colors active:scale-95 ${
                  activeCat === cat ? 'bg-primary border-primary text-white' : ''
                }`}
                style={activeCat === cat ? undefined : { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-bold animate-pulse">Loading menu...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto flex flex-col gap-12">
          {categories.length > 0 ? (
            categories.map(cat => (
              <div key={cat} id={`category-${cat}`} className="space-y-6">
                <h3 className="text-xl sm:text-2xl font-black capitalize tracking-tight relative inline-block" style={{ color: 'var(--text-main)' }}>
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
