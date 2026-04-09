import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface ItemInfoInterface {
  id: string           // MongoDB _id
  item_name: string
  price: number        // price for the selected portion
  qty: number
  canteen_id: string   // MongoDB storeId
  portionSize: 'full' | 'half'
}

interface Item {
  items: ItemInfoInterface[]
}

const storedCart = localStorage.getItem("cart")
const initial_item: Item = {
  items: storedCart ? JSON.parse(storedCart) : [],
}

// Cart key = id + portionSize, so same item can have full AND half simultaneously
const makeKey = (id: string, portionSize: 'full' | 'half') => `${id}__${portionSize}`

export const CartSlice = createSlice({
  name: "cart",
  initialState: initial_item,
  reducers: {
    add_item: (state, action: PayloadAction<ItemInfoInterface>) => {
      const key = makeKey(action.payload.id, action.payload.portionSize)
      const exists = state.items.find((item) => makeKey(item.id, item.portionSize) === key)
      if (!exists) {
        state.items.push(action.payload)
        localStorage.setItem("cart", JSON.stringify(state.items))
      }
    },
    delete_item: (state, action: PayloadAction<{ id: string; portionSize: 'full' | 'half' }>) => {
      const key = makeKey(action.payload.id, action.payload.portionSize)
      state.items = state.items.filter((item) => makeKey(item.id, item.portionSize) !== key)
      localStorage.setItem("cart", JSON.stringify(state.items))
    },
    increase_item: (state, action: PayloadAction<{ id: string; portionSize: 'full' | 'half' }>) => {
      const key = makeKey(action.payload.id, action.payload.portionSize)
      const item = state.items.find((item) => makeKey(item.id, item.portionSize) === key)
      if (item) {
        item.qty += 1
        localStorage.setItem("cart", JSON.stringify(state.items))
      }
    },
    decrease_item: (state, action: PayloadAction<{ id: string; portionSize: 'full' | 'half' }>) => {
      const key = makeKey(action.payload.id, action.payload.portionSize)
      const item = state.items.find((item) => makeKey(item.id, item.portionSize) === key)
      if (item) {
        item.qty -= 1
        if (item.qty === 0) {
          state.items = state.items.filter((i) => makeKey(i.id, i.portionSize) !== key)
        }
        localStorage.setItem("cart", JSON.stringify(state.items))
      }
    },
    clear_all_item: (state) => {
      state.items = []
      localStorage.removeItem("cart")
    },
  },
})

export const { add_item, increase_item, decrease_item, delete_item, clear_all_item } = CartSlice.actions
export default CartSlice.reducer