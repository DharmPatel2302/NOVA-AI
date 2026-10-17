import React, { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { signInWithPopup } from "firebase/auth";
import { useDispatch } from "react-redux";
import { auth, googleProvider } from "../utils/firebase";
import api from "../utils/axios";
import { setUser } from "../redux/userSlice";

const GoogleSignInButton = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Open Google sign-in popup via Firebase
      const result = await signInWithPopup(auth, googleProvider);

      // 2. Get the Firebase ID token
      const idToken = await result.user.getIdToken();

      // 3. Send token to backend for verification + session creation
      const response = await api.post("/api/auth/google", { idToken });

      // 4. Store user info in Redux (only non-sensitive display data)
      dispatch(setUser(response.data.user));
    } catch (err) {
      console.error("Google Sign-In error:", err);
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setError(null);
      } else {
        setError(err.message || "Sign-in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="group relative flex items-center gap-3 w-full px-6 py-3.5 bg-white text-gray-700 border border-gray-200 rounded-xl shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-sm font-medium text-base"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
        ) : (
          <FcGoogle className="w-5 h-5" />
        )}
        <span className="flex-1 text-center">
          {loading ? "Signing in..." : "Continue with Google"}
        </span>
      </button>

      {error && (
        <p className="text-red-500 text-sm mt-1 animate-fade-in">{error}</p>
      )}
    </div>
  );
};

export default GoogleSignInButton;
