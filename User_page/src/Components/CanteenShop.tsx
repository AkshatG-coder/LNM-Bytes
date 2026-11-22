import type { CanteenStoreInterface } from '../Util/CanteenStoreInterface'
import { CanteenStoreCard } from './CanteenStoreCard'
import { useSearch } from '../Util/useSearch'
import { useEffect, useState } from 'react'
import api from '../Util/api'
import { Search, X } from 'lucide-react'
import { useAppSelector } from '../Util/hook'



export function CanteenShop() {
  const [canteenStores, setCanteenStores] = useState<CanteenStoreInterface[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function GetStoreDetails() {
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

  const user = useAppSelector((s) => s.User.user)
  const firstName = user?.name?.split(' ')[0]
  // Open canteens first, so the top of the list is always somewhere you can order from
  const sorted = [...filteredData].sort((a, b) => Number(b.status === 'open') - Number(a.status === 'open'))
  const openCount = canteenStores.filter((s) => s.status === 'open').length

  return (
    <section className="max-w-6xl mx-auto px-4 pt-6 pb-10 sm:pt-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight" style={{ color: 'var(--text-main)' }}>
          {firstName ? `What are you eating, ${firstName}?` : 'What are you eating today?'}
        </h1>
        {!isLoading && canteenStores.length > 0 && (
          <p className="mt-1.5 text-sm sm:text-base font-medium" style={{ color: 'var(--text-muted)' }}>
            {openCount === 0
              ? 'Every canteen is closed right now.'
              : `${openCount} of ${canteenStores.length} ${canteenStores.length === 1 ? 'canteen is' : 'canteens are'} open now.`}
          </p>
        )}

        <div className="relative mt-5 max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: 'var(--text-muted)' }} aria-hidden />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setsearchText(e.target.value)}
            placeholder="Search canteens"
            aria-label="Search canteens"
            className="w-full h-12 pl-12 pr-12 rounded-xl border font-semibold placeholder:font-medium focus:outline-none focus:border-[var(--text-main)]"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }}
          />
          {searchText && (
            <button
              onClick={() => setsearchText('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchText !== debounceSearch && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true" aria-label="Loading canteens">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-2xl border animate-pulse" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      ) : sorted.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {sorted.map((store) => (
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
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-extrabold" style={{ color: 'var(--text-main)' }}>
            {searchText ? `No canteen matches "${searchText}"` : 'No canteens are listed yet'}
          </h2>
          <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            {searchText ? 'Check the spelling or try a shorter name.' : 'Check back in a little while.'}
          </p>
          {searchText && (
            <button onClick={() => setsearchText('')} className="mt-4 px-4 h-10 rounded-lg bg-primary text-on-primary font-extrabold text-sm hover:bg-primary-dark">
              Clear search
            </button>
          )}
        </div>
      )}
    </section>
  )
}
