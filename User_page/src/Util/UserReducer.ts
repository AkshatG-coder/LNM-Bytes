import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'

import api from './api'

export interface UserInfoInterface {
  id: string
  name: string
  email: string
  phone: string | null
  picture: string | null
  role: string
}

interface UserState {
  user: UserInfoInterface | null
  isAuthenticated: boolean
  loading: boolean
}

const stored_user_info = localStorage.getItem("user_info");


const initialState: UserState = {
  user: stored_user_info ? JSON.parse(stored_user_info) : null,
  isAuthenticated: !!stored_user_info,
  loading: false,
}

// ─── Google Login Thunk ───────────────────────────────────────────────────────
export const loginWithGoogle = createAsyncThunk(
  "user/loginWithGoogle",
  async (idToken: string, { rejectWithValue }) => {
    try {
      const res = await api.post("/auth/google", { idToken });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || "Login failed");
    }
  }
);

export const UserSlice = createSlice({
  name: "UserDetails",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
      localStorage.removeItem("user_info");
      localStorage.removeItem("user_token");
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loginWithGoogle.pending, (state) => { state.loading = true; })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        const { token, user } = action.payload.data;
        state.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          picture: user.picture ?? null,
          role: user.role,
        };
        state.isAuthenticated = true;
        state.loading = false;
        localStorage.setItem("user_info", JSON.stringify(state.user));
        localStorage.setItem("user_token", token);
      })
      .addCase(loginWithGoogle.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
      })
  },
});

export const { logout } = UserSlice.actions;
export default UserSlice.reducer;
