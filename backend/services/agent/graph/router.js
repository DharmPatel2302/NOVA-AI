import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { routerModel } from "../config/llmModel.js";
import { hasDocumentsForConversation } from "../config/vectorDb.js";

// Valid agent names — reused for both LLM classification and manual override validation
const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "image"];

// Hidden agents that are only reachable via file attachment — NOT selectable from frontend
const HIDDEN_FILE_AGENTS = ["imageAnalyzer", "pdfRag"];

// Zod schema for structured output
const routerSchema = z.object({
  selectedAgent: z
    .enum(["chat", "search", "coding", "pdf", "ppt", "image"])
    .describe("The name of the agent best suited to handle this user prompt"),
});

const ROUTER_SYSTEM_PROMPT = `You are a routing classifier for a multi-agent AI system.
Your ONLY job is to classify the user's message into exactly ONE of these 6 categories:

1. "chat" — General conversation, greetings, small talk, opinions, explanations of concepts, 
   anything that doesn't clearly fit another category.
   Examples: "hello", "how are you", "explain quantum computing", "tell me a joke"

2. "search" — Questions requiring current/live information, news, real-time data, prices, 
   latest events, or anything the user explicitly asks to search for.
   Examples: "what's the latest news about AI", "search for best restaurants in NYC", 
   "what is the current price of Bitcoin", "who won the game yesterday"

3. "coding" — Code-related questions, debugging, writing functions, explaining code, 
   reviewing code, or anything programming-related.
   Examples: "write a function that sorts an array", "debug this Python code", 
   "explain what this regex does", "convert this to TypeScript"

4. "pdf" — Questions that reference an uploaded PDF, document, or file, asking to 
   analyze, summarize, or answer questions about document content.
   Examples: "summarize this PDF", "what does page 5 say about revenue", 
   "extract key points from the uploaded document"

5. "ppt" — Requests to create a presentation, slides, or PowerPoint about a topic.
   Examples: "make a presentation about climate change", "create slides on machine learning",
   "build a 10-slide deck about our quarterly results"

6. "image" — Requests to generate, create, or draw an image or picture.
   Examples: "generate an image of a sunset", "create a picture of a cat wearing a hat",
   "draw a logo for my startup"

CONTINUITY RULE:
If the previous message in this conversation was handled by a specialized agent AND the current user message is a short follow-up, correction, or continuation of that same topic with no new distinct topic, classify it as the SAME agent as before, not "chat".

Classify the user's message into exactly one category. When in doubt, choose "chat".`;

const routerPrompt = ChatPromptTemplate.fromMessages([
  ["system", ROUTER_SYSTEM_PROMPT],
  ["human", "Previous assistant agent: {lastAgentType}\nUser message: {userPrompt}"],
]);

const structuredRouterModel = routerModel.withStructuredOutput(routerSchema, {
  name: "route_classifier",
});

/**
 * Detects whether a user message is a short, ambiguous follow-up
 * (e.g. "try again", "ok", "?", "do it again", "yes", "retry").
 * Used to prevent misrouting after file-based hidden agents.
 */
const isShortAmbiguousFollowUp = (prompt) => {
  if (!prompt) return true;
  const trimmed = prompt.trim();
  if (trimmed.length < 25) return true; // Very short messages are ambiguous

  const lower = trimmed.toLowerCase();
  const ambiguousPatterns = [
    "try again", "retry", "do it again", "again", "redo",
    "one more time", "can you try", "please try",
    "yes", "ok", "okay", "sure", "go ahead", "do it",
    "what", "huh", "?", "explain", "tell me more",
    "what happened", "why", "how",
  ];
  return ambiguousPatterns.some((p) => lower.includes(p));
};

/**
 * Router node for the LangGraph workflow.
 */
export const routerNode = async (state) => {
  try {
    // ─── Priority 1 (HIGHEST): Attached file auto-routing ──────────
    if (state.fileType === "image") {
      console.log(`[Router] File-based override: "imageAnalyzer" (attached image detected)`);
      return { selectedAgent: "imageAnalyzer" };
    }
    if (state.fileType === "pdf") {
      console.log(`[Router] File-based override: "pdfRag" (attached PDF detected)`);
      return { selectedAgent: "pdfRag" };
    }

    // ─── Determine previous agent type from chat history ───────────
    let lastAgentType = "none";
    if (Array.isArray(state.chatHistory)) {
      for (let i = state.chatHistory.length - 1; i >= 0; i--) {
        const msg = state.chatHistory[i];
        if (msg.role === "assistant" && msg.agentType) {
          lastAgentType = msg.agentType;
          break;
        }
      }
    }

    // ─── Priority 1.5: Hidden agent follow-up short-circuit ────────
    // If the previous response was from a HIDDEN file-based agent (imageAnalyzer/pdfRag)
    // AND no new file is attached in THIS message AND the message looks like a short
    // follow-up, we CANNOT re-run those agents (the temp file is already deleted).
    // Short-circuit with a helpful "please re-attach" response instead of misrouting
    // to an unrelated agent (e.g. image generation).
    if (
      HIDDEN_FILE_AGENTS.includes(lastAgentType) &&
      !state.fileType &&
      isShortAmbiguousFollowUp(state.userPrompt)
    ) {
      // Special case: pdfRag with existing documents in Qdrant can still be queried
      // without re-attaching (the chunks persist in vector storage).
      if (lastAgentType === "pdfRag") {
        const hasExistingDoc = await hasDocumentsForConversation(state.conversationId);
        if (hasExistingDoc) {
          console.log(`[Router] pdfRag follow-up with existing documents — routing to pdfRag`);
          return { selectedAgent: "pdfRag" };
        }
      }

      // For imageAnalyzer (or pdfRag with no persisted docs): the original file is gone.
      // Produce a direct response asking the user to re-attach, skip credit deduction.
      const fileTypeLabel = lastAgentType === "imageAnalyzer" ? "image" : "document";
      console.log(`[Router] Short-circuit: previous agent was "${lastAgentType}" but no new file attached — asking user to re-attach`);
      return {
        selectedAgent: "chat",
        response: `I'd be happy to help with that! Since the previous ${fileTypeLabel} is no longer available, could you please re-attach it so I can take another look?`,
        skipCredits: true,
      };
    }

    // ─── Priority 1.5b: Conversation Document Continuity ──────────
    // If no new file was attached in THIS message, but the current conversation
    // already has ingested documents in Qdrant, check if this is a document follow-up.
    const hasExistingDoc = await hasDocumentsForConversation(state.conversationId);

    // ─── Priority 2: Manual override from frontend ────────────────
    if (state.agentOverride && VALID_AGENTS.includes(state.agentOverride)) {
      // If user selected "pdf" chip and conversation has documents, route to pdfRag
      if (state.agentOverride === "pdf" && hasExistingDoc) {
        console.log(`[Router] Routing to "pdfRag" via PDF manual chip for existing document`);
        return { selectedAgent: "pdfRag" };
      }
      console.log(`[Router] Manual override: "${state.agentOverride}"`);
      return { selectedAgent: state.agentOverride };
    }

    // ─── Priority 3: Auto-classify via LLM with Continuity Context ─────
    // If previous agent was pdfRag and conversation has documents, auto-route follow-ups to pdfRag
    if (hasExistingDoc && (lastAgentType === "pdfRag" || lastAgentType === "pdf")) {
      console.log(`[Router] Document continuity override: "pdfRag" (existing document in conversation)`);
      return { selectedAgent: "pdfRag" };
    }

    const chain = routerPrompt.pipe(structuredRouterModel);
    const result = await chain.invoke({
      userPrompt: state.userPrompt || "",
      lastAgentType,
    });

    let selected = VALID_AGENTS.includes(result.selectedAgent)
      ? result.selectedAgent
      : "chat";

    if (hasExistingDoc && selected === "pdf") {
      selected = "pdfRag";
    }

    console.log(`[Router] Auto-classified: "${selected}"`);
    return { selectedAgent: selected };
  } catch (error) {
    console.error("Router classification failed:", error.message);
    return { selectedAgent: "chat", error: error.message };
  }
};
