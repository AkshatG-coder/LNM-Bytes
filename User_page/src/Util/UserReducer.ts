import { createAsyncThunk,createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { RootState } from './store'
import axios from 'axios'


export const checkauth=createAsyncThunk("user/checkauth",
    async(_,{rejectWithValue})=>{
        try{
            const res=await axios.get("/auth/me",{withCredentials:true})
            return res.data
        }
        catch(err){
            return rejectWithValue(err)
        }
    }
)
interface UserInfoInterface {
  id: string
  name: string
  email: string
  role: string
}

interface UserState {
  user: UserInfoInterface | null
  isAuthenticated: boolean
  loading: boolean
}

const stored_user_info=localStorage.getItem("user_info");

const initialState: UserState = {
  user: stored_user_info ? JSON.parse(stored_user_info) : null,
  isAuthenticated: !!stored_user_info,
  loading: true,
}
export const UserSlice=createSlice({
    name:"UserDetails",
    initialState:initialState,
    reducers:{
        logout:(state)=>{
            state.user=null
            state.isAuthenticated=false
            state.loading=false
            localStorage.removeItem("user_info")
        }
    },
    extraReducers(builder) {
        builder.addCase(checkauth.pending,(state)=>{
            state.loading=true
        })
        .addCase(checkauth.fulfilled,(state,action:PayloadAction<UserInfoInterface>)=>{
            state.user=action.payload
            state.isAuthenticated=true
            state.loading=false
            localStorage.setItem("user_info",JSON.stringify(action.payload))
        })
        .addCase(checkauth.rejected,(state)=>{
            state.user=null
            state.isAuthenticated=false
            state.loading=false
            localStorage.removeItem("user_info")
        })
    },
})
