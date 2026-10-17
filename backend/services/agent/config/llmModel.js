import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// ─── Gemini Model Selection Note ────────────────────────────────────
// All Gemini models in this file use 'gemini-2.5-flash'.
//
// WHY THIS MODEL:
//   - gemini-2.5-flash is active and verified working with valid quota
//     on Google AI Studio.
//   - gemini-2.0-flash returns 429 quota exceeded (limit: 0 on free tier).
//   - gemini-2.5-flash-lite returns 404 (deprecated/unavailable for new users).
//   - gemini-1.5-flash returns 404 (deprecated).
//   - Multimodal support: gemini-2.5-flash supports text + image input
//     (required for the visionModel / imageAnalyzer agent) and document RAG.
// ─────────────────────────────────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

// ─── Groq Models ────────────────────────────────────────────────────
// NOTE: llama-3.1-8b-instant and llama-3.3-70b-versatile were deprecated
// by Groq on August 16, 2026. Replaced with:
//   - openai/gpt-oss-20b  (fast, lightweight — router/chat/search)
//   - openai/gpt-oss-120b (heavy, complex — coding/PDF reports)

/**
 * Router model — fastest/cheapest, runs on every request.
 * Only classifies the prompt into one of 6 agent categories.
 */
export const routerModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0, // Deterministic classification
});

/**
 * Chat model — fast conversational replies.
 */
export const chatModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0.7,
});

/**
 * Search model — summarizing search-augmented results.
 * Uses same fast model since the heavy lifting is in the search tool (future).
 */
export const searchModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-20b",
  temperature: 0.5,
});

// ─── Gemini Models ──────────────────────────────────────────────────

/**
 * PDF model — large context window for document Q&A.
 * Used by the pdf.agent.js for generating PDF report content via Gemini.
 */
export const pdfModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: GEMINI_MODEL,
  temperature: 0.3,
});

/**
 * PPT model — reasoning + structure for slide content generation.
 * Uses Gemini for its strong structured output and reasoning capabilities.
 */
export const pptModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: GEMINI_MODEL,
  temperature: 0.5,
});

// ─── OpenRouter / Coding Model (Temporarily Disabled due to credit limit) ───
// import OpenAI from "openai";
// const openRouterClient = new OpenAI({
//   apiKey: process.env.OPENROUTER_API_KEY,
//   baseURL: "https://openrouter.ai/api/v1",
//   defaultHeaders: {
//     "HTTP-Referer": "http://localhost:5173",
//     "X-Title": "NOVA AI",
//   },
// });

// ─── Groq Coding Model (Option A) ───────────────────────────────────

/**
 * Coding model — High-quality reasoning on Groq.
 * Uses GPT-OSS 120B for high-performance code generation/review.
 */
const groqCodingModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.2, // Lower temperature for deterministic code structure
  maxTokens: 2500,  // Standard max tokens for output size
});

/**
 * Call the Groq coding model.
 * @param {Array<{role: string, content: string}>} messages - OpenAI-format messages
 * @param {boolean} jsonMode - if true, sets response_format to json_object
 * @returns {Promise<string>} - the assistant's response content
 */
export const codingModelCall = async (messages, jsonMode = false) => {
  // Convert standard OpenAI roles/messages to format accepted by LangChain BaseChatModel
  const response = await groqCodingModel.invoke(
    messages,
    jsonMode ? { response_format: { type: "json_object" } } : {}
  );
  return response.content || "";
};

// ─── Image Model ────────────────────────────────────────────────────
// NOTE: Image generation requires a dedicated image API (e.g. OpenAI DALL-E,
// Stability AI, or Gemini Imagen). Chat LLMs (Groq/Gemini) cannot generate images.
// No model is exported here — image.agent.js uses Pollinations.ai for generation.

// ─── PDF Report Model ───────────────────────────────────────────────

/**
 * PDF report content model — generates structured document content.
 * Uses GPT-OSS 120B for strong reasoning and well-organized
 * multi-section report output. Separate from pdfModel (Gemini)
 * which is used for RAG/Q&A over uploaded PDFs.
 */
export const pdfReportModel = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "openai/gpt-oss-120b",
  temperature: 0.3,
  maxTokens: 3000,
});

// ─── Vision Model (Image Analysis) ─────────────────────────────────

/**
 * Vision model — Gemini multimodal for image understanding.
 * Supports text + image input via multimodal HumanMessage.
 * Used by the hidden imageAnalyzer agent (triggered by image file attachment).
 *
 * Model: gemini-2.5-flash — verified active with active free quota and vision support.
 */
export const visionModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: GEMINI_MODEL,
  temperature: 0.3,
});

// ─── RAG Answer Model ──────────────────────────────────────────────

/**
 * RAG answer model — generates answers from retrieved PDF context.
 * Uses Gemini for its large context window, ideal for ingesting
 * multiple RAG chunks and producing a well-grounded answer.
 */
export const ragModel = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
  model: GEMINI_MODEL,
  temperature: 0.2,
});
