import Redis from "ioredis";

// ─── Singleton Redis Client ─────────────────────────────────────────
// Every service that imports this module gets the SAME connection instance.
// Reads REDIS_URL from environment (e.g. redis://localhost:6379 for local dev;
// in production use a managed Redis URL from AWS ElastiCache or similar).

const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

redisClient.on("connect", () => {
  console.log("✅ Redis connected successfully");
});

redisClient.on("error", (err) => {
  console.error("❌ Redis connection error:", err.message);
});

// ─── Generic Session Helpers ────────────────────────────────────────
// These are convenience wrappers — not tied to any specific service's logic.

/**
 * Store a value in Redis with an expiry (in seconds).
 * Value is JSON-stringified automatically.
 */
export const setSession = async (key, value, expiryInSeconds) => {
  await redisClient.set(key, JSON.stringify(value), "EX", expiryInSeconds);
};

/**
 * Retrieve a value from Redis by key.
 * Returns parsed JSON or null if not found.
 */
export const getSession = async (key) => {
  const data = await redisClient.get(key);
  return data ? JSON.parse(data) : null;
};

/**
 * Delete a session/key from Redis.
 */
export const deleteSession = async (key) => {
  await redisClient.del(key);
};

export default redisClient;
