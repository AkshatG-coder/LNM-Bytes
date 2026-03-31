import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

interface ItemInfoInterface {
  id: string          // MongoDB _id (string)
  item_name: string
  price: number
  qty: number
  canteen_id: string  // MongoDB storeId (string)
}

interface Item {
  items: ItemInfoInterface[]
}

const storedCart = localStorage.getItem("cart")
const initial_item: Item = {
  items: storedCart ? JSON.parse(storedCart) : [],
}

export const CartSlice = createSlice({
  name: "cart",
  initialState: initial_item,
  reducers: {
    add_item: (state, action: PayloadAction<ItemInfoInterface>) => {
      const exists = state.items.find((item) => item.id === action.payload.id)
      if (!exists) {
        state.items.push(action.payload)
        localStorage.setItem("cart", JSON.stringify(state.items))
      }
    },
    delete_item: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload)
      localStorage.setItem("cart", JSON.stringify(state.items))
    },
    increase_item: (state, action: PayloadAction<string>) => {
      const item = state.items.find((item) => item.id === action.payload)
      if (item) {
        item.qty += 1
        localStorage.setItem("cart", JSON.stringify(state.items))
      }
    },
    decrease_item: (state, action: PayloadAction<string>) => {
      const item = state.items.find((item) => item.id === action.payload)
      if (item) {
        item.qty -= 1
        if (item.qty === 0) {
          state.items = state.items.filter((i) => i.id !== action.payload)
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