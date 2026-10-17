import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setUser, clearUser } from "./redux/userSlice";
import { getCurrentUser } from "./features/getCurrentUser";
import Home from "./pages/Home";

function App() {
  const dispatch = useDispatch();
  const { loading } = useSelector((state) => state.user);

  // On mount — check if there's an existing valid session (cookie-based)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const userData = await getCurrentUser();
        if (userData) {
          dispatch(setUser(userData));
        } else {
          dispatch(clearUser());
        }
      } catch (error) {
        console.error("Failed to check auth session on load:", error);
        dispatch(clearUser()); // safe fallback
      }
    };

    checkSession();
  }, [dispatch]);

  // Show spinner while the session check is in progress
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App;