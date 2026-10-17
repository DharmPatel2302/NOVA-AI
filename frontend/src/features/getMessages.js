import api from "../utils/axios";

/**
 * Fetch all messages for a conversation.
 * Returns the messages array (empty array is a valid result, not an error).
 * Throws on real system/network errors.
 */
export const getMessages = async (conversationId) => {
  try {
    const response = await api.get(`/api/chat/message/${conversationId}`);
    return response.data.messages;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return [];
    }
    throw error;
  }
};
