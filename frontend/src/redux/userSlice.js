import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,          // {id, name, email, photoURL}
  isAuthenticated: false,
  loading: true,        // true while the initial /me check is in progress
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
    },
    clearUser(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.loading = false;
    },
    setLoading(state, action) {
      state.loading = action.payload;
    },
    updateUserCredits(state, action) {
      if (state.user && typeof action.payload === "number") {
        state.user.credits = action.payload;
      }
    },
  },
});

export const { setUser, clearUser, setLoading, updateUserCredits } = userSlice.actions;
export default userSlice.reducer;
