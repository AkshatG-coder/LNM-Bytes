import { configureStore } from '@reduxjs/toolkit'
import CartReducer from "./CartReducer"
export const store=configureStore({
    reducer:{
        Cart:CartReducer
    }
})
store.subscribe(()=>{
    const cart_items=store.getState().Cart.items
    localStorage.setItem("cart",JSON.stringify(cart_items))
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch