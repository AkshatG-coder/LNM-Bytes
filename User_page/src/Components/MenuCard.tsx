import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { MenuItemCard } from "./MenuItemCard"
import type { MenuCardItemInterface } from "../Util/MenuItemInterface"
import { useSearch } from "../Util/useSearch"
import api from "../Util/api"
import { Pause, Search } from "lucide-react"
import { RushRadar } from "./RushRadar"

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
      className="min-h-screen pt-6 pb-10 sm:pt-8 px-4 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-4 sm:mb-6">
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>
            {storeName}
          </h1>
          <span
            className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-extrabold"
            style={storeStatus === 'closed'
              ? { backgroundColor: 'var(--surface-2)', color: 'var(--text-muted)' }
              : { backgroundColor: 'color-mix(in srgb, var(--veg) 16%, transparent)', color: 'var(--veg)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'currentColor' }} />
            {storeStatus === 'closed' ? 'Closed' : 'Open'}
          </span>
        </div>

        {storeStatus === 'closed' && (
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            You can look at the menu, but orders open when the canteen does.
          </p>
        )}

        {storeStatus !== 'closed' && id && <RushRadar storeId={id} />}

        {/* Orders paused alert */}
        {!isOnlineOrderAvailable && storeStatus === "open" && (
          <div className="mt-4 rounded-xl border p-4 flex items-start gap-3" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--primary) 55%, transparent)' }}>
            <Pause className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--text-main)' }} aria-hidden />
            <div>
              <p className="text-sm font-extrabold" style={{ color: 'var(--text-main)' }}>App orders are paused</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-main)' }}>
                The kitchen is busy. You can browse the menu, but you can't order through the app right now.
              </p>
            </div>
          </div>
        )}

        <div className="relative mt-4 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setsearchText(e.target.value)}
            placeholder="Search this menu"
            aria-label="Search this menu"
            className="w-full h-11 pl-12 pr-10 rounded-xl border font-semibold placeholder:font-medium focus:outline-none focus:border-[var(--text-main)]"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
          />
          {searchText !== debounceSearch && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          )}
        </div>
      </div>

      {/* Category chips. A direct child of the section so it stays pinned under the header for the whole menu */}
      {!isLoading && categories.length > 0 && (
        <div
          ref={stripRef}
          className="sticky z-40 -mx-4 px-4 py-2.5 mb-5 overflow-x-auto no-scrollbar backdrop-blur-md border-b"
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
                className={`px-3.5 h-9 rounded-full text-sm font-bold border whitespace-nowrap capitalize active:scale-95 ${
                  activeCat === cat ? 'bg-primary border-primary text-on-primary' : ''
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
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading menu">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl border animate-pulse" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-9">
          {categories.length > 0 ? (
            categories.map(cat => (
              <div key={cat} id={`category-${cat}`}>
                <h2 className="mb-3 flex items-baseline gap-2.5 text-2xl font-extrabold" style={{ color: 'var(--text-main)' }}>
                  <span className="capitalize">{cat}</span>
                  <span className="text-sm font-semibold tnum" style={{ color: 'var(--text-muted)' }}>
                    {groupedByCategory[cat].length} {groupedByCategory[cat].length === 1 ? 'item' : 'items'}
                  </span>
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
            <div className="py-16 text-center rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-main)' }}>
                {searchText ? `Nothing matches "${searchText}"` : 'This menu is empty'}
              </h2>
              <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                {searchText ? 'Try a different dish name.' : 'The canteen has not added items yet.'}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
