export interface CanteenStoreInterface {
  _id: string       // MongoDB document ID from backend
  id?: string       // alias (optional)
  name: string
  description: string
  phone?: string
  ownerName?: string
  location: string
  status: "open" | "closed"
  foodType: "veg" | "non-veg" | "both"
  nightDelivery: boolean
  isOnlineOrderAvailable?: boolean
  operationTime: {
    openTime: string
    closeTime: string
  }
  createdAt?: string
  updatedAt?: string
}