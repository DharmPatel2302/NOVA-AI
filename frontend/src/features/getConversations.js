import api from "../utils/axios";

/**
 * Fetch all conversations for the current authenticated user.
 * Returns the conversations array if successful, null if 401 (unauthenticated),
 * or throws on real system/network errors.
 * Matches the success/expected-empty/real-error pattern from getCurrentUser.js.
 */
export const getConversations = async () => {
  try {
    const response = await api.get("/api/chat/conversations");
    return response.data.conversations;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return null; // Unauthenticated — expected during initial load race
    }
    throw error;
  }
};
