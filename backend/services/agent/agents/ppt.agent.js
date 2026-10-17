import { pdfReportModel } from "../config/llmModel.js";
import { generatePptBuffer } from "../utils/generatePpt.js";
import { uploadToCloudinary } from "../../../shared/cloudinary/uploadToCloudinary.js";

// Reuse pdfReportModel (same Groq llama-3.3-70b-versatile, temp 0.3, 3000 tokens)
// — identical config works well for both structured PDF and PPT content generation.
const pptModel = pdfReportModel;

// ─── Structured Content Generation Prompt ────────────────────────────
const SYSTEM_PROMPT = `You are a professional presentation-writing assistant. Given the user's request, produce a WELL-ORGANIZED slide deck structure as a JSON object.

OUTPUT FORMAT (strict JSON, no markdown, no explanation):
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle or null",
  "slides": [
    {
      "heading": "Slide Heading",
      "bullets": ["point 1", "point 2", "point 3"] or null,
      "content": "A short paragraph for this slide" or null
    }
  ]
}

RULES:
- Produce between 5-10 content slides for a typical request (not counting cover/closing slides).
- PREFER bullets over paragraph content for most slides — real presentations use concise bullet points, not dense paragraphs.
- Use paragraph "content" ONLY when a slide is genuinely better as flowing text (e.g. a key takeaway, mission statement, or quote).
- Maximum 5-6 bullets per slide. Each bullet should be concise (aim for one line, not multi-sentence bullets).
- Each slide must have at least one of "bullets" or "content" (both can be null, but at least one should be populated).
- "subtitle" can be null if not needed.
- Output ONLY the JSON object — no markdown fences, no explanation, no preamble.`;

/**
 * Attempts to parse the LLM output as structured PPT content JSON.
 * Validates the expected shape and returns the parsed object, or null on failure.
 */
function parsePptContentJson(raw) {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);

    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.title !== "string" || !parsed.title.trim()) return null;
    if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) return null;

    for (const slide of parsed.slides) {
      if (typeof slide.heading !== "string" || !slide.heading.trim()) return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * PPT agent node — generates structured presentations as downloadable .pptx files.
 *
 * Flow:
 *   1. LLM generates structured JSON content (title, slides with headings/bullets)
 *   2. generatePptBuffer renders it into a formatted .pptx (pptxgenjs)
 *   3. Upload to Cloudinary (permanent URL, no presigning needed)
 *   4. Returns response text + pptTitle + generatedPptUrl for frontend
 *
 * Error handling produces distinct, honest messages for each failure mode
 * (matching pdf.agent.js's pattern).
 */
export const pptAgent = async (state) => {
  // ─── STEP 1: Structured content generation via Groq ───────────────
  let pptContent = null;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: state.userPrompt },
  ];

  try {
    const result = await pptModel.invoke(messages, {
      response_format: { type: "json_object" },
    });
    pptContent = parsePptContentJson(result.content || "");

    // Retry once with a stricter reminder if first attempt was malformed
    if (!pptContent) {
      console.warn("[PptAgent] First LLM attempt returned malformed JSON, retrying...");
      messages.push({
        role: "user",
        content:
          "Your previous response was not valid JSON or was missing required fields. " +
          "Please output ONLY a valid JSON object with: title (string), subtitle (string|null), " +
          "slides (array of {heading: string, bullets: string[]|null, content: string|null}). " +
          "No markdown, no explanation.",
      });
      const retryResult = await pptModel.invoke(messages, {
        response_format: { type: "json_object" },
      });
      pptContent = parsePptContentJson(retryResult.content || "");
    }
  } catch (llmErr) {
    console.error("[PptAgent] LLM content generation failed:", llmErr.message);
  }

  if (!pptContent) {
    return {
      response:
        "I wasn't able to structure the presentation content properly. Could you rephrase your request or try again?",
      pptContent: null,
      pptTitle: null,
      generatedPptUrl: null,
      generatedPptPublicId: null,
    };
  }

  const pptTitle = pptContent.title;
  console.log(`[PptAgent] Content generated: "${pptTitle}" with ${pptContent.slides.length} slides`);

  // ─── STEP 2: Render to PPTX ───────────────────────────────────────
  let pptBuffer;
  try {
    pptBuffer = await generatePptBuffer(pptContent);
    console.log(`[PptAgent] PPTX rendered: ${pptBuffer.length} bytes`);
  } catch (renderErr) {
    console.error("[PptAgent] pptxgenjs rendering failed:", renderErr.message);
    return {
      response:
        "I prepared the content but hit an issue formatting the presentation — could you try again?",
      pptContent,
      pptTitle,
      generatedPptUrl: null,
      generatedPptPublicId: null,
    };
  }

  // ─── STEP 3: Upload to Cloudinary ────────────────────────────────
  let uploadResult;
  try {
    const safeFilename =
      pptTitle.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 60) ||
      `presentation-${Date.now()}`;

    uploadResult = await uploadToCloudinary({
      buffer: pptBuffer,
      filename: `${safeFilename}.pptx`,
      fileType: "ppt",
    });

    console.log(`[PptAgent] PPTX uploaded to Cloudinary. URL: "${uploadResult.url.substring(0, 80)}..."`);
  } catch (uploadErr) {
    console.error("[PptAgent] Cloudinary upload failed (PPTX was generated but couldn't be stored):", uploadErr.message);
    return {
      response:
        "I created the presentation but ran into an issue saving it — could you try again?",
      pptContent,
      pptTitle,
      generatedPptUrl: null,
      generatedPptPublicId: null,
    };
  }

  // ─── STEP 4: Success response ────────────────────────────────────
  return {
    response: `I've put together a presentation on **"${pptTitle}"** — you can download it below.`,
    pptContent,
    pptTitle,
    generatedPptUrl: uploadResult.url,
    generatedPptPublicId: uploadResult.publicId,
  };
};
