import redisClient from "../../../shared/redis/redis.js";

/**
 * Redis-backed conversation memory caching layer.
 *
 * Source of truth remains MongoDB (accessed via chat service).
 * Redis acts as a fast performance cache for the 20 most recent messages.
 */

export const HISTORY_LIMIT = 20; // Bound prompt size & cache memory
export const HISTORY_TTL_SECONDS = 86400; // 24-hour sliding TTL — refreshed on every read/write
export const SENTINEL = "__INIT__"; // Sentinel value to mark a cached empty conversation

/** Key helper for Redis namespace */
export const getHistoryKey = (conversationId) => `chat:history:${conversationId}`;

/**
 * Check if conversation history is currently cached in Redis.
 * Required because LRANGE on a missing key returns an empty array,
 * making it impossible to distinguish a cache miss from an empty conversation without EXISTS.
 */
export const existsInCache = async (conversationId) => {
  try {
    const key = getHistoryKey(conversationId);
    const count = await redisClient.exists(key);
    return count > 0;
  } catch (error) {
    console.error("Redis existsInCache error:", error.message);
    return false; // Treat Redis errors as cache miss
  }
};

/**
 * Retrieve cached message history for a conversation from Redis.
 * Should only be called after confirming existsInCache returns true.
 * Filters out sentinel values and parses JSON entries.
 */
export const getHistoryFromCache = async (conversationId) => {
  try {
    const key = getHistoryKey(conversationId);
    const rawItems = await redisClient.lrange(key, 0, -1);

    // Refresh sliding TTL on read
    await redisClient.expire(key, HISTORY_TTL_SECONDS);

    const messages = [];
    for (const item of rawItems) {
      // Filter out sentinel value used for empty cached conversations
      if (item === SENTINEL) continue;
      try {
        messages.push(JSON.parse(item));
      } catch (parseErr) {
        console.error("Failed to parse cached message item:", parseErr.message);
      }
    }

    return messages;
  } catch (error) {
    console.error("Redis getHistoryFromCache error:", error.message);
    return [];
  }
};

/**
 * Populate Redis cache with a fresh array of messages (e.g. after a cache miss fallback to MongoDB).
 * Clears old key first to prevent duplicates, applies HISTORY_LIMIT and sliding TTL.
 *
 * SENTINEL TRICK:
 * If messagesArray is empty (genuinely new conversation with 0 messages in MongoDB),
 * we still store a sentinel string "__INIT__" so redisClient.exists(key) returns true.
 * Otherwise, the next prompt would get another cache miss and needlessly query MongoDB again.
 */
export const hydrateCache = async (conversationId, messagesArray = []) => {
  try {
    const key = getHistoryKey(conversationId);

    // Delete existing key to prevent stale/duplicate entries
    await redisClient.del(key);

    if (messagesArray && messagesArray.length > 0) {
      // Keep only the last 20 messages if larger array provided
      const recentMessages = messagesArray.slice(-HISTORY_LIMIT);
      const serialized = recentMessages.map((m) =>
        JSON.stringify({
          role: m.role,
          content: m.content,
          ...(m.agentType ? { agentType: m.agentType } : {}),
        })
      );

      await redisClient.rpush(key, ...serialized);
      await redisClient.ltrim(key, -HISTORY_LIMIT, -1);
    } else {
      // Cache empty conversation using sentinel value
      await redisClient.rpush(key, SENTINEL);
    }

    // Set 24-hour sliding TTL
    await redisClient.expire(key, HISTORY_TTL_SECONDS);
  } catch (error) {
    console.error("Redis hydrateCache error:", error.message);
  }
};

/**
 * Append new messages (e.g. user prompt + assistant response) to an existing Redis cache list.
 * Applies HISTORY_LIMIT (drops oldest if count > 20) and refreshes sliding TTL.
 * Note: If key does not exist yet when called, Redis auto-creates the list cleanly.
 */
export const appendMessagesToCache = async (conversationId, newMessagesArray = []) => {
  try {
    if (!newMessagesArray || newMessagesArray.length === 0) return;

    const key = getHistoryKey(conversationId);
    const serialized = newMessagesArray.map((m) =>
      JSON.stringify({
        role: m.role,
        content: m.content,
        ...(m.agentType ? { agentType: m.agentType } : {}),
      })
    );

    await redisClient.rpush(key, ...serialized);
    await redisClient.ltrim(key, -HISTORY_LIMIT, -1);
    await redisClient.expire(key, HISTORY_TTL_SECONDS);
  } catch (error) {
    console.error("Redis appendMessagesToCache error:", error.message);
  }
};
