import api from "../utils/axios";

/**
 * Create a new conversation.
 * Returns the created conversation object.
 * Throws on error — caller handles dispatch.
 */
export const createConversation = async (title) => {
  const response = await api.post("/api/chat/conversation", {
    title: title || "New Conversation",
  });
  return response.data.conversation;
};
