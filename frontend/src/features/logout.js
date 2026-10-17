import api from "../utils/axios";

/**
 * Log the user out by destroying the server-side session.
 * Returns true on success. Caller is responsible for dispatching
 * clearUser() + resetConversations() to Redux.
 * Throws on real network/system errors.
 */
export const logout = async () => {
  await api.post("/api/auth/logout");
  return true;
};
