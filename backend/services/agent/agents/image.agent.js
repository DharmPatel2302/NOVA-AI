import { chatModel } from "../config/llmModel.js";
import { generateImage } from "../config/pollinations.js";
import { uploadToCloudinary } from "../../../shared/cloudinary/uploadToCloudinary.js";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// ─── Prompt Refinement System Prompt ─────────────────────────────────
const REFINE_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert image prompt engineer. Your job is to take the user's raw image request and expand it into a detailed, vivid image-generation prompt that will produce a stunning result.

RULES:
- Add specific details about style, lighting, composition, color palette, mood, and artistic technique where the user's request is sparse.
- Do NOT change the fundamental subject or intent of what the user asked for.
- Output ONLY the refined prompt text — no explanations, no prefixes, no quotes, no markdown.
- Keep the refined prompt under 200 words.
- If the user already provided a very detailed prompt, enhance it slightly but don't over-embellish.`,
  ],
  ["human", "{userPrompt}"],
]);

/**
 * Image agent node — generates images via Pollinations.ai with Groq prompt refinement.
 *
 * Flow:
 *   1. Refine user prompt via Groq chatModel (enhancement, not generation)
 *   2. Generate image via Pollinations.ai (binary buffer)
 *   3. Upload to Cloudinary (permanent URL, no presigning needed)
 *   4. Set response text + generatedImageUrl/generatedImagePublicId for frontend display
 *
 * Error handling produces distinct, honest messages for each failure mode.
 */
export const imageAgent = async (state) => {
  let refinedPrompt = state.userPrompt; // Fallback: use raw prompt if refinement fails

  // ─── STEP 1: Prompt refinement via Groq ───────────────────────────
  try {
    const chain = REFINE_PROMPT.pipe(chatModel);
    const result = await chain.invoke({ userPrompt: state.userPrompt });
    const refined = result.content?.trim();

    if (refined && refined.length > 10) {
      refinedPrompt = refined;
      console.log(`[ImageAgent] Refined prompt: "${refinedPrompt.substring(0, 100)}..."`);
    } else {
      console.warn("[ImageAgent] Refinement returned empty/short result, using raw prompt");
    }
  } catch (refineErr) {
    console.warn("[ImageAgent] Prompt refinement failed, using raw prompt:", refineErr.message);
    // Not a blocking failure — refinement is an enhancement, not a hard dependency
  }

  // ─── STEP 2: Generate image via Pollinations ──────────────────────
  let imageBuffer, contentType;
  try {
    const result = await generateImage(refinedPrompt);
    imageBuffer = result.buffer;
    contentType = result.contentType;
  } catch (genErr) {
    console.error("[ImageAgent] Pollinations generation failed:", genErr.message);
    return {
      response:
        "I wasn't able to generate that image just now — this can happen if the image service is temporarily unavailable or rate-limited. Want me to try again?",
      refinedImagePrompt: refinedPrompt,
      generatedImageUrl: null,
      generatedImagePublicId: null,
    };
  }

  // ─── STEP 3: Upload to Cloudinary ─────────────────────────────────
  let uploadResult;
  try {
    // Determine file extension from content type
    const ext = contentType.includes("png") ? "png" : "jpg";
    const filename = `${Date.now()}.${ext}`;

    uploadResult = await uploadToCloudinary({
      buffer: imageBuffer,
      filename,
      fileType: "image",
    });

    console.log(`[ImageAgent] Image uploaded to Cloudinary. URL: "${uploadResult.url.substring(0, 80)}..."`);
  } catch (uploadErr) {
    // Distinct error: image was generated but couldn't be saved — this is an infra issue
    console.error("[ImageAgent] Cloudinary upload failed (image was generated but couldn't be stored):", uploadErr.message);
    return {
      response:
        "I generated the image but ran into an issue saving it — could you try again?",
      refinedImagePrompt: refinedPrompt,
      generatedImageUrl: null,
      generatedImagePublicId: null,
    };
  }

  // ─── STEP 4: Success response ─────────────────────────────────────
  return {
    response: `Here is the image I generated for: **"${state.userPrompt}"**`,
    refinedImagePrompt: refinedPrompt,
    generatedImageUrl: uploadResult.url,
    generatedImagePublicId: uploadResult.publicId,
  };
};
