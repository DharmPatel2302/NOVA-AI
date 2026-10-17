import api from "../utils/axios";

/**
 * Delete a conversation by ID.
 * Calls DELETE /api/chat/conversation/:conversationId.
 *
 * @param {string} conversationId
 * @returns {Promise<{success: boolean}>}
 */
export const deleteConversation = async (conversationId) => {
  const response = await api.delete(`/api/chat/conversation/${conversationId}`);
  return response.data;
};
