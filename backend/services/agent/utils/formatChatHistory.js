import { HumanMessage, AIMessage } from "@langchain/core/messages";

/**
 * Format raw {role, content} history objects into LangChain BaseMessage instances.
 *
 * role === 'user'      --> HumanMessage
 * role === 'assistant' --> AIMessage
 */
export const formatChatHistory = (chatHistory = []) => {
  if (!Array.isArray(chatHistory)) return [];

  return chatHistory
    .map((item) => {
      if (item.role === "user") {
        return new HumanMessage(item.content);
      } else if (item.role === "assistant") {
        return new AIMessage(item.content);
      }
      return null;
    })
    .filter(Boolean);
};
