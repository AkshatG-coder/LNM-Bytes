export interface MenuCardItemInterface {
  _id: string         // MongoDB id
  name: string        // item name from backend
  image?: string      // optional image URL
  price: number
  halfPrice?: number | null
  hasHalf?: boolean
  rating?: number
  category?: string
  isVeg?: boolean
  isAvailable: boolean
  storeId: string
  storeStatus?: string // Added
  // Legacy aliases kept for backwards compat
  item_name?: string
  photo?: string
}
