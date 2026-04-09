export interface MenuCardItemInterface {
  _id: string         // MongoDB id
  name: string        // item name from backend
  image?: string      // optional image URL
  price: number
  rating?: number
  category?: string
  isVeg?: boolean
  isAvailable: boolean
  storeId: string
  // Legacy aliases kept for backwards compat
  item_name?: string
  photo?: string
}
