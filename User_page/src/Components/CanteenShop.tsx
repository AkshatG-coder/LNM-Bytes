import type { CanteenStoreInterface } from '../Util/CanteenStoreInterface'
import { CanteenStoreCard } from './CanteenStoreCard'
import { useSearch } from '../Util/useSearch'
import { useEffect, useState } from 'react'
import api from '../Util/api'

const CACHE_KEY = 'lnm_stores_cache'
const CACHE_TTL = 60_000 // 60 seconds

interface StoreCache {
  data: CanteenStoreInterface[]
  ts: number
}

export function CanteenShop() {
  const [canteenStores, setCanteenStores] = useState<CanteenStoreInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function GetStoreDetails() {
    // Check sessionStorage cache first (TTL: 60s)
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data, ts }: StoreCache = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) {
          setCanteenStores(data)
          setIsLoading(false)
          return
        }
      }
    } catch { /* ignore parse errors */ }

    try {
      setIsLoading(true);
      const response = await api.get("/store_handler/");
      if (response.data?.success) {
        const data = response.data.data
        // Filter out internal admin/super-admin placeholder stores
        const publicStores = data.filter(
          (s: CanteenStoreInterface) => !s.name.toLowerCase().includes('admin')
        )
        setCanteenStores(publicStores)
        // Cache the filtered result for 60 seconds
        sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: publicStores, ts: Date.now() } satisfies StoreCache))
      }
    } catch (error) {
      console.error("Failed to fetch stores:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const {
    searchText,
    setsearchText,
    filteredData,
    debounceSearch
  } = useSearch<CanteenStoreInterface>(
    canteenStores,
    (store, search) =>
      store.name.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    GetStoreDetails()
  }, [])

  return (
    <section
      className="min-h-screen py-16 px-4 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="max-w-7xl mx-auto mb-12 text-center">
        <h1
          className="text-4xl md:text-5xl font-black tracking-tighter uppercase transition-colors duration-300"
          style={{ color: 'var(--text-main)' }}
        >
          LNMIIT <span className="text-primary border-b-4 border-secondary pb-1">Canteen</span> Services
        </h1>

        <p
          className="mt-6 font-bold max-w-2xl mx-auto text-lg leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          The heart of campus flavors. Explore food courts, cafes, and late-night snacks across the LNMIIT campus.
        </p>

        <div className="mt-10 flex flex-col items-center">
          {/* Search Input */}
          <div className="relative w-full max-w-xl">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setsearchText(e.target.value)}
              placeholder="Search your favorite store..."
              className="w-full px-6 py-4 border rounded-2xl shadow-xl focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all font-bold text-lg placeholder-gray-400"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-main)',
              }}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {searchText !== debounceSearch && (
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              )}
              <span className="text-2xl opacity-20">🔍</span>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
          <p className="text-primary font-black tracking-widest animate-pulse uppercase text-sm">Initializing Flavor Radar...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {filteredData.length > 0 ? (
            filteredData.map((store) => (
              <CanteenStoreCard
                key={store?._id}
                _id={store?._id}
                name={store.name}
                description={store.description}
                location={store.location}
                foodType={store.foodType}
                status={store.status}
                nightDelivery={store.nightDelivery}
                operationTime={store.operationTime}
              />
            ))
          ) : (
            <div
              className="col-span-full flex flex-col items-center justify-center py-24 rounded-[2rem] border-2 border-dashed shadow-inner transition-colors duration-300"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <span className="text-7xl mb-6 grayscale opacity-50">🍔</span>
              <h3
                className="text-2xl font-black tracking-tight"
                style={{ color: 'var(--text-main)' }}
              >No canteens found</h3>
              <p style={{ color: 'var(--text-muted)' }} className="font-bold mt-2">Maybe they are hiding? Try another search!</p>
              <button
                onClick={() => setsearchText('')}
                className="mt-6 text-primary font-black underline hover:text-primary-dark transition-colors"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
