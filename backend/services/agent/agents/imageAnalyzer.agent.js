import fs from "fs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { visionModel } from "../config/llmModel.js";

const VISION_SYSTEM_PROMPT = `You are an expert image analysis assistant. Your job is to provide detailed, accurate, and insightful descriptions and answers about images.

When analyzing an image:
1. Describe what you see in detail — objects, people, text, colors, composition, setting.
2. If the user asked a specific question about the image, answer it directly and thoroughly.
3. If no specific question was asked, provide a comprehensive general description covering:
   - Main subject/focus of the image
   - Background and setting
   - Notable details, colors, and composition
   - Any text visible in the image
   - Overall mood or context
4. Be precise and factual. Don't speculate beyond what's clearly visible.
5. Use clear, well-structured markdown formatting for readability.`;

/**
 * Image Analyzer Agent — hidden agent triggered by image file attachment.
 *
 * Reads the uploaded image from disk, base64-encodes it, and sends it
 * to Gemini's vision model along with the user's question (if any).
 * Temp file is ALWAYS cleaned up in the finally block.
 */
export const imageAnalyzerAgent = async (state) => {
  // Diagnostic log: capture file metadata on every invocation for crash diagnosis
  console.log(`[ImageAnalyzer] Invoked. attachedFile:`, JSON.stringify(state.attachedFile));

  let filePath = state.attachedFile?.path;

  try {
    if (!filePath) {
      return {
        response: "I couldn't access the uploaded image — please try attaching it again.",
      };
    }

    // ─── Read + encode image ──────────────────────────────────────
    let imageBuffer;
    try {
      imageBuffer = await fs.promises.readFile(filePath);
    } catch (readErr) {
      console.error("[ImageAnalyzer] File read failure:", readErr.message);
      return {
        response: "I couldn't access the uploaded image — the file may have been moved or deleted. Please try attaching it again.",
      };
    }

    const base64Data = imageBuffer.toString("base64");
    const mimetype = state.attachedFile.mimetype || "image/jpeg";

    // ─── Construct multimodal message ─────────────────────────────
    const userQuestion = state.userPrompt?.trim()
      ? state.userPrompt.trim()
      : "Describe this image in detail.";

    // @langchain/google-genai v0.2.x supports image_url: { url: "data:..." }
    // which it converts to Gemini's native inlineData format internally.
    // See: node_modules/@langchain/google-genai/dist/utils/common.js L204-232
    const humanMessage = new HumanMessage({
      content: [
        { type: "text", text: userQuestion },
        {
          type: "image_url",
          image_url: {
            url: `data:${mimetype};base64,${base64Data}`,
          },
        },
      ],
    });

    // ─── Invoke vision model ──────────────────────────────────────
    let visionResponse;
    try {
      visionResponse = await visionModel.invoke([
        new SystemMessage(VISION_SYSTEM_PROMPT),
        humanMessage,
      ]);
    } catch (visionErr) {
      console.error("[ImageAnalyzer] Gemini vision call failed:", visionErr.message);
      return {
        response: "I had trouble analyzing this image — the vision service may be temporarily unavailable. Please try again in a moment.",
      };
    }

    console.log(`[ImageAnalyzer] Successfully analyzed image: "${state.attachedFile.originalname}"`);

    return {
      response: visionResponse.content || "I couldn't generate a description for this image.",
    };
  } catch (error) {
    console.error("[ImageAnalyzer] Unexpected error:", error.message);
    return {
      response: "Something went wrong while analyzing your image. Please try again.",
      error: error.message,
    };
  } finally {
    // ─── CLEANUP: Always delete the temp file ─────────────────────
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`[ImageAnalyzer] Cleaned up temp file: ${filePath}`);
      } catch (cleanupErr) {
        console.warn(`[ImageAnalyzer] Failed to clean up temp file: ${cleanupErr.message}`);
      }
    }
  }
};
