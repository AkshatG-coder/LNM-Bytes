import api from './api'
import type { ItemInfoInterface } from './CartReducer'

export interface ReorderLine {
  menuItemId: string
  name: string
  quantity: number
  portionSize: 'full' | 'half'
  price: number
  previousPrice: number
  isVeg: boolean
}

export interface ReorderPlan {
  storeId: string
  storeName: string
  canOrder: boolean
  closedReason?: string
  lines: ReorderLine[]
  unavailable: string[]
  notes: string[]
  priceChanged: boolean
}

export interface FavoriteItem {
  id: string
  name: string
  price: number
  halfPrice: number | null
  hasHalf: boolean
  isVeg: boolean
  storeId: string
  storeName: string
  timesOrdered: number
  canOrder: boolean
  closedReason?: string
}

export async function fetchReorderPlan(orderId: string): Promise<ReorderPlan> {
  const res = await api.get(`/order/${orderId}/reorder`)
  return res.data.data as ReorderPlan
}

export async function fetchFavorites(): Promise<FavoriteItem[]> {
  const res = await api.get('/order/favorites')
  return (res.data?.data ?? []) as FavoriteItem[]
}

/** The cart only holds one canteen at a time. True when adding from `storeId` would clash. */
export function cartHasOtherCanteen(cart: ItemInfoInterface[], storeId: string): boolean {
  return cart.length > 0 && cart[0].canteen_id !== storeId
}

/** One sentence per thing the student should know before checking out. */
export function reorderSummary(plan: ReorderPlan): string[] {
  const lines: string[] = []
  if (plan.unavailable.length > 0) {
    lines.push(`Not available now: ${plan.unavailable.join(', ')}.`)
  }
  if (plan.priceChanged) lines.push('Some prices have changed since your last order.')
  lines.push(...plan.notes)
  return lines
}

export function planToCartItems(plan: ReorderPlan): ItemInfoInterface[] {
  return plan.lines.map((l) => ({
    id: l.menuItemId,
    item_name: l.name,
    price: l.price,
    qty: l.quantity,
    canteen_id: plan.storeId,
    portionSize: l.portionSize,
  }))
}
