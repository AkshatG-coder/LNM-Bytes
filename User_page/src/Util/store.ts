import { configureStore } from '@reduxjs/toolkit'
import CartReducer from "./CartReducer"
import UserReducer from "./UserReducer"

export const store = configureStore({
    reducer: {
        Cart: CartReducer,
        User: UserReducer,
    }
})
store.subscribe(() => {
    const cart_items = store.getState().Cart.items
    localStorage.setItem("cart", JSON.stringify(cart_items))
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch