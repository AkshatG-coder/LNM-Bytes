import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
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
  token: string | null
}

const stored_user_info = localStorage.getItem("user_info");
const stored_token = localStorage.getItem("user_token");

const initialState: UserState = {
  user: stored_user_info ? JSON.parse(stored_user_info) : null,
  isAuthenticated: !!stored_user_info,
  loading: false,
  token: stored_token || null,
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

// ─── Update Phone Thunk ───────────────────────────────────────────────────────
export const updateUserPhone = createAsyncThunk(
  "user/updatePhone",
  async ({ userId, phone }: { userId: string; phone: string }, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/auth/phone/${userId}`, { phone });
      return res.data;
    } catch (err: any) {
      return rejectWithValue(err?.response?.data?.message || "Failed to update phone");
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
      state.token = null;
      localStorage.removeItem("user_info");
      localStorage.removeItem("user_token");
    },
    setPhone: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.phone = action.payload;
        localStorage.setItem("user_info", JSON.stringify(state.user));
      }
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loginWithGoogle.pending, (state) => { state.loading = true; })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        const { token, user } = action.payload.data;
        state.token = token;
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
      .addCase(updateUserPhone.fulfilled, (state, action) => {
        if (state.user) {
          state.user.phone = action.payload.data.phone;
          localStorage.setItem("user_info", JSON.stringify(state.user));
        }
      });
  },
});

export const { logout, setPhone } = UserSlice.actions;
export default UserSlice.reducer;
