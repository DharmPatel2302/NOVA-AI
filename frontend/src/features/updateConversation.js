import api from "../utils/axios";

/**
 * Update a conversation title via PATCH /api/chat/conversation/:conversationId
 * Returns the updated conversation object.
 */
export const updateConversationTitle = async ({ conversationId, title }) => {
  const response = await api.patch(`/api/chat/conversation/${conversationId}`, {
    title,
  });
  return response.data.conversation;
};
