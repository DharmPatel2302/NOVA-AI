import api from "../utils/axios";

/**
 * Fetch the current authenticated user's session data.
 * Returns the user object if authenticated, null if 401 (unauthenticated),
 * or throws the error if a real system/network failure occurs.
 */
export const getCurrentUser = async () => {
  try {
    const response = await api.get("/api/auth/me");
    return response.data?.user || null;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return null; // Unauthenticated fallback
    }
    throw error;
  }
};
