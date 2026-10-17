import { tavily } from "@tavily/core";

/**
 * Tavily search client — configured with API key from env.
 * Used by search.agent.js for real web search with image results.
 */
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

/** Check if error is authentication/API key related (non-transient) */
const isAuthError = (err) => {
  const msg = (err.message || "").toLowerCase();
  const status = err.status || err.response?.status;
  return (
    status === 401 ||
    status === 403 ||
    msg.includes("unauthorized") ||
    msg.includes("invalid key") ||
    msg.includes("forbidden") ||
    msg.includes("api key")
  );
};

const executeSearchCall = async (query) => {
  const response = await tvly.search(query, {
    search_depth: "basic",
    include_images: true,
    max_results: 5,
  });

  const textResults = (response.results || []).map((r) => ({
    title: r.title || "",
    url: r.url || "",
    content: r.content || "",
  }));

  const rawImages = response.images || [];
  const images = rawImages.map((img) =>
    typeof img === "string" ? { url: img } : { url: img.url || "" }
  );

  return { textResults, images };
};

/**
 * Perform a web search via Tavily, returning both text results and images.
 *
 * Includes retry logic for transient errors (network, rate limit):
 * 1. If auth/key error -> fail fast (do NOT retry).
 * 2. If transient error -> wait 500ms and retry ONCE.
 * 3. On final failure -> return graceful empty fallback.
 */
export const performSearch = async (query) => {
  try {
    return await executeSearchCall(query);
  } catch (firstError) {
    console.error("[Tavily] Primary search attempt failed:", firstError.message);

    // Fail fast on non-transient auth/key errors
    if (isAuthError(firstError)) {
      console.error("[Tavily] Auth/Key error detected — failing fast without retry.");
      return {
        textResults: [],
        images: [],
        error: "Auth error: " + firstError.message,
        isAuthError: true,
      };
    }

    // Transient error -> single retry after 500ms delay
    console.log("[Tavily] Transient error detected — retrying in 500ms...");
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const retryResult = await executeSearchCall(query);
      console.log("[Tavily] Retry attempt succeeded!");
      return retryResult;
    } catch (retryError) {
      console.error("[Tavily] Retry attempt also failed:", retryError.message);
      return {
        textResults: [],
        images: [],
        error: retryError.message,
        isAuthError: false,
      };
    }
  }
};
