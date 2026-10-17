import { chatModel } from "../config/llmModel.js";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { formatChatHistory } from "../utils/formatChatHistory.js";

const SYSTEM_PROMPT = `You are Nova, a multi-agent AI assistant.

Guidelines:
- Be helpful, warm, and concise. Get straight to the point — avoid preamble like "Sure, I'd be happy to help!" before every answer.
- Maintain continuity with earlier parts of the conversation. Avoid re-introducing yourself or re-explaining things already covered earlier in the same conversation.
- Reference earlier context naturally when relevant (e.g. "as you mentioned earlier...") rather than treating every message as an isolated question.
- Use markdown formatting where it genuinely helps readability: **bold** for emphasis, bullet lists for multi-item answers, \`inline code\` for technical terms, and fenced code blocks with language tags (\`\`\`python) for any code.
- Keep responses reasonably concise by default. Provide depth only when the user's question clearly calls for it.
- If you don't know something, say so honestly rather than fabricating an answer.
- Never claim to have capabilities you don't (e.g., don't say you can browse the web or generate images — other specialized agents handle those).`;

/**
 * System prompt specifically for the query-refinement role during the search flow.
 * Instructs the LLM to produce ONLY a clean search query string, not a full response.
 */
const SEARCH_REFINE_PROMPT = `You are a search query refiner. Your ONLY job is to take the user's raw message and conversation history and produce a clean, optimized web search query.

Rules:
- Strip conversational filler ("hey", "can you", "I was wondering", etc.)
- Resolve pronouns and references using conversation history (e.g. if user said "weather in Tokyo" earlier and now says "what about India?", produce "weather in India"; if user says "in usa" after "time of india", produce "current time in USA")
- RETRY / AGREEMENT MANDATE: If the user says "yes", "sure", "try again", "retry", or agrees to retry after a previous search error/apology, extract the ORIGINAL underlying subject/query from earlier in the conversation history (e.g. "current time in USA") — NEVER output "yes" or "try again" as the search query!
- Output ONLY the refined search query string — no explanation, no markdown, no quotes, just the query itself
- Keep the query concise (typically 3-8 words)
- If the message is already a good search query, return it as-is`;

/**
 * Chat agent node — serves TWO distinct roles depending on the graph path:
 *
 * ROLE 1 — Standalone chat (state.selectedAgent === 'chat'):
 *   Handles general conversation with full multi-turn memory context.
 *   Sets state.response directly (this is the final node for chat requests).
 *
 * ROLE 2 — Search query refiner (state.selectedAgent === 'search'):
 *   This is the FIRST hop in the search flow (router → chatAgent → searchAgent).
 *   Instead of producing a user-facing response, it takes the raw user prompt
 *   and conversation history and produces a refined search query — stripping
 *   conversational filler and resolving pronouns (e.g. "what about in India?"
 *   + prior context about Tokyo → "weather in India").
 *   Sets state.refinedQuery (NOT state.response — the search agent produces
 *   the final response after performing the actual web search).
 *
 * WHY one node serves two roles:
 *   Both roles need the same chatModel + conversation history access. Splitting
 *   into separate files would duplicate the model setup and history formatting.
 *   The branching is a simple if/else on state.selectedAgent, documented here
 *   since it's non-obvious that one node file serves two different behaviors.
 */
export const chatAgent = async (state) => {
  try {
    const formattedHistory = formatChatHistory(state.chatHistory || []);

    // ─── ROLE 2: Search query refinement ─────────────────────────
    if (state.selectedAgent === "search") {
      const messages = [
        new SystemMessage(SEARCH_REFINE_PROMPT),
        ...formattedHistory,
        new HumanMessage(state.userPrompt),
      ];

      const result = await chatModel.invoke(messages);
      const refinedQuery = result.content.trim();

      console.log(`[ChatAgent → Search] Refined query: "${refinedQuery}"`);

      return {
        refinedQuery,
        intermediateSteps: [{ agent: "chat", output: refinedQuery }],
      };
    }

    // ─── ROLE 1: Standalone chat response ────────────────────────
    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...formattedHistory,
      new HumanMessage(state.userPrompt),
    ];

    const result = await chatModel.invoke(messages);

    return { response: result.content };
  } catch (error) {
    console.error("Chat agent error:", error.message);
    return {
      response: "I'm sorry, something went wrong. Please try again.",
      error: error.message,
    };
  }
};
