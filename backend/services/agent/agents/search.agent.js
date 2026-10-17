import { searchModel } from "../config/llmModel.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { performSearch } from "../config/tavily.js";

/**
 * TIMEZONE DICTIONARY & DETERMINISTIC TIME HELPER
 *
 * DELIBERATE CARVE-OUT: Narrow deterministic check for "time in [location]" queries.
 * Avoids web search for exact real-time clock values which indexed web pages cannot provide.
 */
const TIMEZONE_MAP = {
  india: { name: "India", tz: "Asia/Kolkata" },
  mumbai: { name: "Mumbai, India", tz: "Asia/Kolkata" },
  delhi: { name: "Delhi, India", tz: "Asia/Kolkata" },
  bangalore: { name: "Bangalore, India", tz: "Asia/Kolkata" },
  tokyo: { name: "Tokyo, Japan", tz: "Asia/Tokyo" },
  japan: { name: "Japan", tz: "Asia/Tokyo" },
  usa: { name: "USA (Eastern Time)", tz: "America/New_York" },
  us: { name: "USA (Eastern Time)", tz: "America/New_York" },
  "united states": { name: "USA (Eastern Time)", tz: "America/New_York" },
  america: { name: "USA (Eastern Time)", tz: "America/New_York" },
  "new york": { name: "New York, USA", tz: "America/New_York" },
  nyc: { name: "New York, USA", tz: "America/New_York" },
  london: { name: "London, UK", tz: "Europe/London" },
  uk: { name: "United Kingdom", tz: "Europe/London" },
  england: { name: "United Kingdom", tz: "Europe/London" },
  britain: { name: "United Kingdom", tz: "Europe/London" },
  "united kingdom": { name: "United Kingdom", tz: "Europe/London" },
  paris: { name: "Paris, France", tz: "Europe/Paris" },
  france: { name: "France", tz: "Europe/Paris" },
  berlin: { name: "Berlin, Germany", tz: "Europe/Berlin" },
  germany: { name: "Germany", tz: "Europe/Berlin" },
  sydney: { name: "Sydney, Australia", tz: "Australia/Sydney" },
  australia: { name: "Australia (Sydney Time)", tz: "Australia/Sydney" },
  singapore: { name: "Singapore", tz: "Asia/Singapore" },
  dubai: { name: "Dubai, UAE", tz: "Asia/Dubai" },
  uae: { name: "Dubai, UAE", tz: "Asia/Dubai" },
  "los angeles": { name: "Los Angeles, USA", tz: "America/Los_Angeles" },
  la: { name: "Los Angeles, USA", tz: "America/Los_Angeles" },
  california: { name: "California, USA", tz: "America/Los_Angeles" },
  chicago: { name: "Chicago, USA", tz: "America/Chicago" },
  toronto: { name: "Toronto, Canada", tz: "America/Toronto" },
  canada: { name: "Canada (Eastern Time)", tz: "America/Toronto" },
  beijing: { name: "Beijing, China", tz: "Asia/Shanghai" },
  china: { name: "China", tz: "Asia/Shanghai" },
};

const checkDeterministicTimeQuery = (promptText) => {
  if (!promptText) return null;
  const clean = promptText.trim().toLowerCase();

  const match =
    clean.match(/(?:what(?:'s|\s+is)\s+the\s+)?(?:current\s+)?time\s+(?:in|of|at)\s+([a-z\s]+)/i) ||
    clean.match(/(?:what\s+time\s+is\s+it\s+in)\s+([a-z\s]+)/i) ||
    clean.match(/^in\s+([a-z\s]+)/i); // e.g. "in usa", "in japan" when following a time question

  if (match && match[1]) {
    const loc = match[1].replace(/\b(now|today|please|currently)\b/gi, "").trim();
    const tzEntry = TIMEZONE_MAP[loc];
    if (tzEntry) {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: tzEntry.tz,
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        timeZone: tzEntry.tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      return `The current time in **${tzEntry.name}** is **${timeString}** (${dateString}).`;
    }
  }
  return null;
};

const SYSTEM_PROMPT = `You are a search-augmented AI assistant. You have been given real web search results to base your answer on.

IMPORTANT RULES:
- Base your answer ONLY on the provided search results, not your training knowledge.
- If the search results don't contain enough information to answer the question, say so explicitly rather than guessing.

INLINE PRODUCT & ITEM LINKS (CRITICAL):
- When mentioning specific products, articles, shopping items, or entities in your response, insert DIRECT markdown links on the product name or title itself: e.g., \`[Garmin Printed T-Shirt](https://example.com/item)\` using the exact URL from the search results.
- NEVER substitute real links with generic text like 'Search Term: X' or say you cannot provide links when URLs are present in search results.

SOURCES SECTION (MANDATORY):
- ALWAYS include a \`### Sources\` section at the end of your response whenever search results are available.
- Format as a numbered list with title and link:
  1. [Source Title](URL)
  2. [Source Title](URL)

REAL-TIME / VOLATILE DATA:
- If the query asks about volatile live values that change second-by-second or minute-by-minute (live sports scores in progress, real-time stock ticks), caveat explicitly that web search results represent indexed web page snapshots and live values may have changed.

FORMATTING:
- Use markdown headers, bullet points, and bold text for visual structure.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  [
    "human",
    `Search query: {searchQuery}

Search results:
{searchContext}

Original user question: {userPrompt}

Please provide a comprehensive answer based on the search results above, including inline links and a mandatory ### Sources section at the end.`,
  ],
]);

/**
 * Search agent node — performs real web search via Tavily then synthesizes
 * a natural-language answer using the searchModel (RAG-style).
 */
export const searchAgent = async (state) => {
  try {
    const rawPrompt = state.userPrompt || "";
    const searchQuery = state.refinedQuery || rawPrompt;

    // ─── 0. Deterministic carve-out for time-in-location queries ────
    const deterministicTime = checkDeterministicTimeQuery(rawPrompt) || checkDeterministicTimeQuery(searchQuery);
    if (deterministicTime) {
      console.log(`[SearchAgent] Deterministic time query resolved without web search.`);
      return {
        response: deterministicTime,
        searchResults: { textResults: [], images: [] },
      };
    }

    console.log(`[SearchAgent] Searching for: "${searchQuery}"`);

    // ─── 1. Perform Tavily search ────────────────────────────────
    const searchData = await performSearch(searchQuery);

    // If Tavily failed entirely, degrade gracefully with specific message
    if (searchData.error && searchData.textResults.length === 0) {
      console.warn(`[SearchAgent] Tavily error: ${searchData.error}`);
      const failureMsg = searchData.isAuthError
        ? "I couldn't perform a web search because the search service authentication configuration is invalid. Please check API keys."
        : "I wasn't able to search for that just now due to a transient issue — want me to try again?";
      return {
        response: failureMsg,
        searchResults: { textResults: [], images: [] },
        error: searchData.error,
      };
    }

    // ─── 2. Format search results as context for the LLM ─────────
    const searchContext =
      searchData.textResults.length > 0
        ? searchData.textResults
            .map(
              (r, i) =>
                `[Result ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.content}`
            )
            .join("\n\n---\n\n")
        : "No search results were found.";

    // ─── 3. Synthesize answer via LLM (RAG) ──────────────────────
    const chain = prompt.pipe(searchModel);
    const result = await chain.invoke({
      searchQuery,
      searchContext,
      userPrompt: rawPrompt,
    });

    console.log(
      `[SearchAgent] Got ${searchData.textResults.length} text results, ${searchData.images.length} images`
    );

    return {
      response: result.content,
      searchResults: {
        textResults: searchData.textResults,
        images: searchData.images,
      },
    };
  } catch (error) {
    console.error("Search agent error:", error.message);
    return {
      response:
        "I wasn't able to search for that just now — want me to try again?",
      searchResults: { textResults: [], images: [] },
      error: error.message,
    };
  }
};
