import { agentGraph } from "../graph/graph.js";
import chatApi from "../utils/axios.js";
import { getConversationHistory } from "../utils/getMessages.js";
import { appendMessagesToCache } from "../config/memory.js";
import { deductCredits } from "../utils/deductCredits.js";

// Valid agent names for server-side validation of agentOverride
// NOTE: 'imageAnalyzer' and 'pdfRag' are INTERNAL ONLY — not valid overrides
const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "image"];

/**
 * POST /prompt
 * Fetches recent chat history, checks credits, invokes the multi-agent graph,
 * saves messages to chat service (MongoDB), updates Redis memory cache, deducts credits, and returns response.
 *
 * Supports optional file attachment (req.file from multer) which auto-routes
 * to hidden agents (imageAnalyzer or pdfRag) via the router's file-type priority.
 */
export const handlePrompt = async (req, res) => {
  try {
    console.log(`[handlePrompt] Received request. Has file: ${!!req.file}, Content-Type: ${req.headers["content-type"]}`);
    const { userPrompt, conversationId, agentOverride } = req.body;
    const userId = req.userId;

    // ─── Validate inputs ──────────────────────────────────────────
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Allow empty userPrompt IF a file is attached (user can send image/PDF with no caption)
    if (!userPrompt && !req.file) {
      return res.status(400).json({ message: "userPrompt is required (or attach a file)" });
    }
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }

    // Validate agentOverride server-side
    let validatedOverride = null;
    if (agentOverride && VALID_AGENTS.includes(agentOverride)) {
      validatedOverride = agentOverride;
    } else if (agentOverride) {
      console.warn(
        `[Controller] Invalid agentOverride "${agentOverride}" from client — falling back to auto`
      );
    }

    // ─── Derive file attachment metadata ───────────────────────────
    let attachedFile = null;
    let fileType = null;

    if (req.file) {
      attachedFile = {
        path: req.file.path,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      };

      if (req.file.mimetype.startsWith("image/")) {
        fileType = "image";
      } else if (req.file.mimetype === "application/pdf") {
        fileType = "pdf";
      } else {
        // Shouldn't reach here given multer's fileFilter, but handle defensively
        return res.status(400).json({ message: "Unsupported file type" });
      }

      console.log(`[Controller] File attached: "${req.file.originalname}" (${fileType}), path: ${req.file.path}, size: ${req.file.size} bytes`);
    }

    // ─── 1. Fetch recent conversation history ─────────────────────
    const chatHistory = await getConversationHistory(conversationId, userId);

    // ─── 2. Save user message to chat service (MongoDB) ───────────
    let userMsgSaved = false;
    try {
      await chatApi.post(
        "/message",
        { conversationId, role: "user", content: userPrompt || "" },
        { headers: { "x-user-id": userId } }
      );
      userMsgSaved = true;
    } catch (saveError) {
      console.error("Failed to save user message to chat service:", saveError.message);
    }

    // ─── 3. Invoke LangGraph workflow with conversation context ───
    const result = await agentGraph.invoke({
      userPrompt: userPrompt || "",
      conversationId,
      userId,
      chatHistory,
      agentOverride: validatedOverride,
      attachedFile,
      fileType,
    });

    // ─── 4. Check if creditCheckNode flagged insufficient credits ──
    if (result.creditCheckFailed) {
      // Pre-check failed: no agent node ran, skip saving assistant message & deduction
      return res.status(200).json({
        response: result.response,
        selectedAgent: result.selectedAgent || "chat",
        conversationId,
        creditCheckFailed: true,
      });
    }

    // ─── 4.5 Check if router short-circuited (no-credit response) ──
    // The router can produce a direct response + skipCredits flag for
    // trivial short-circuit cases (e.g. "re-attach your file" prompts)
    // that require no LLM work and should not cost credits.
    const skipCredits = result.skipCredits === true;

    // ─── 5. Save assistant response to chat service (MongoDB) ─────
    // Cloudinary URLs are permanent — no presigned URL generation needed.
    // URLs and publicIds are sent directly from graph state to the chat service.
    let assistantMsgSaved = false;
    try {
      await chatApi.post(
        "/message",
        {
          conversationId,
          role: "assistant",
          content: result.response,
          agentType: result.selectedAgent,
          searchImages: result.searchResults?.images || [],
          artifactTitle: result.artifactTitle || null,
          artifactFiles: result.artifactFiles || [],
          generatedImageUrl: result.generatedImageUrl || null,
          generatedImagePublicId: result.generatedImagePublicId || null,
          generatedPdfUrl: result.generatedPdfUrl || null,
          generatedPdfPublicId: result.generatedPdfPublicId || null,
          pdfTitle: result.pdfTitle || null,
          generatedPptUrl: result.generatedPptUrl || null,
          generatedPptPublicId: result.generatedPptPublicId || null,
          pptTitle: result.pptTitle || null,
        },
        { headers: { "x-user-id": userId } }
      );
      assistantMsgSaved = true;
    } catch (saveError) {
      console.error("Failed to save assistant message to chat service:", saveError.message);
    }

    // ─── 6. Update Redis memory cache ─────────────────────────────
    if (userMsgSaved && assistantMsgSaved) {
      await appendMessagesToCache(conversationId, [
        { role: "user", content: userPrompt || "" },
        {
          role: "assistant",
          content: result.response,
          agentType: result.selectedAgent,
        },
      ]);
    } else {
      console.warn("Skipping Redis cache update due to failed MongoDB persistence");
    }

    // ─── 7. Post-execution credit deduction ────────────────────────
    let remainingCredits = null;
    if (!skipCredits) {
      const deductRes = await deductCredits(userId, result.selectedAgent);
      if (deductRes && typeof deductRes.remainingCredits === "number") {
        remainingCredits = deductRes.remainingCredits;
      }
    } else {
      console.log(`[Controller] Skipping credit deduction for short-circuit response (agent: ${result.selectedAgent})`);
    }

    // ─── 8. Return result to client ───────────────────────────────
    // Cloudinary URLs are permanent and already final — no presigned URL
    // generation step needed (this was removed during the S3→Cloudinary migration).
    // The URL field names (generatedImageUrl, generatedPdfUrl, generatedPptUrl)
    // match what the frontend already expects.
    return res.status(200).json({
      response: result.response,
      selectedAgent: result.selectedAgent,
      conversationId,
      remainingCredits,
      searchImages: result.searchResults?.images || [],
      artifactTitle: result.artifactTitle || null,
      artifactFiles: result.artifactFiles || [],
      generatedImageUrl: result.generatedImageUrl || null,
      generatedPdfUrl: result.generatedPdfUrl || null,
      pdfTitle: result.pdfTitle || null,
      generatedPptUrl: result.generatedPptUrl || null,
      pptTitle: result.pptTitle || null,
      ...(result.error && { warning: "Partial error occurred: " + result.error }),
    });
  } catch (error) {
    console.error("[handlePrompt] FATAL — unhandled error in prompt handler:");
    console.error(error.stack || error);
    return res.status(500).json({
      message: "Something went wrong processing your request. Please try again.",
    });
  }
};
