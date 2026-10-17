import {
  existsInCache,
  getHistoryFromCache,
  hydrateCache,
  HISTORY_LIMIT,
} from "../config/memory.js";
import chatApi from "./axios.js";

/**
 * Cache-aside orchestrator for conversation history.
 *
 * 1. Checks Redis cache first (fast path).
 * 2. On cache miss, fetches full history from MongoDB via chat service API.
 * 3. Takes the 20 most recent messages, hydrates Redis cache for future calls, and returns them.
 * 4. Safe fallback: Returns empty array on error so LLM execution is never blocked.
 */
export const getConversationHistory = async (conversationId, userId) => {
  try {
    if (!conversationId) return [];

    // 1. Cache hit check
    const isCached = await existsInCache(conversationId);
    if (isCached) {
      return await getHistoryFromCache(conversationId);
    }

    // 2. Cache miss — fetch from MongoDB source of truth via Chat Service
    const headers = userId ? { "x-user-id": userId } : {};
    const response = await chatApi.get(`/message/${conversationId}`, { headers });
    const fullHistory = response.data?.messages || [];

    // 3. Slice to last 20 messages & normalize format
    const recentHistory = fullHistory.slice(-HISTORY_LIMIT).map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.agentType ? { agentType: m.agentType } : {}),
    }));

    // 4. Hydrate Redis cache for subsequent requests
    await hydrateCache(conversationId, recentHistory);

    return recentHistory;
  } catch (error) {
    console.error("getConversationHistory cache-aside error:", error.message);
    return []; // Safe fallback — return empty history rather than crashing request
  }
};
