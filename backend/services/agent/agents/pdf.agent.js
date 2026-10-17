import { pdfReportModel } from "../config/llmModel.js";
import { generatePdfBuffer } from "../utils/generatePdf.js";
import { uploadToCloudinary } from "../../../shared/cloudinary/uploadToCloudinary.js";

// ─── Structured Content Generation Prompt ────────────────────────────
const SYSTEM_PROMPT = `You are a professional report-writing assistant. Given the user's request, produce a WELL-ORGANIZED document structure as a JSON object.

OUTPUT FORMAT (strict JSON, no markdown, no explanation):
{
  "title": "Report Title",
  "subtitle": "Optional subtitle or null",
  "sections": [
    {
      "heading": "Section Heading",
      "content": "2-5 sentences of substantive prose — real information, not filler.",
      "bullets": ["point 1", "point 2"] or null
    }
  ]
}

RULES:
- Produce AT LEAST 3 sections for any substantive topic. Avoid single-section thin documents.
- Do NOT pad with unnecessary sections for very simple requests.
- Each section's "content" must be 2-5 sentences of real, informative prose.
- Use "bullets" ONLY when the content genuinely calls for a list (key points, steps, comparisons) — not for everything.
- "subtitle" can be null if not needed.
- Output ONLY the JSON object — no markdown fences, no explanation, no preamble.`;

/**
 * Attempts to parse the LLM output as structured PDF content JSON.
 * Validates the expected shape and returns the parsed object, or null on failure.
 */
function parsePdfContentJson(raw) {
  try {
    // Strip markdown fences if the model wrapped the JSON
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    }

    const parsed = JSON.parse(cleaned);

    // Validate shape
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.title !== "string" || !parsed.title.trim()) return null;
    if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) return null;

    // Validate each section
    for (const section of parsed.sections) {
      if (typeof section.heading !== "string" || !section.heading.trim()) return null;
      if (typeof section.content !== "string") return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * PDF agent node — generates structured reports as downloadable PDFs.
 *
 * Flow:
 *   1. LLM generates structured JSON content (title, sections, bullets)
 *   2. generatePdfBuffer renders it into a formatted PDF (PDFKit)
 *   3. Upload to Cloudinary (permanent URL, no presigning needed)
 *   4. Returns response text + pdfTitle + generatedPdfUrl for frontend
 *
 * Error handling produces distinct, honest messages for each failure mode.
 */
export const pdfAgent = async (state) => {
  // ─── STEP 1: Structured content generation via Groq ───────────────
  let pdfContent = null;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: state.userPrompt },
  ];

  try {
    const result = await pdfReportModel.invoke(messages, {
      response_format: { type: "json_object" },
    });
    pdfContent = parsePdfContentJson(result.content || "");

    // Retry once with a stricter reminder if first attempt was malformed
    if (!pdfContent) {
      console.warn("[PdfAgent] First LLM attempt returned malformed JSON, retrying...");
      messages.push({
        role: "user",
        content:
          "Your previous response was not valid JSON or was missing required fields. " +
          "Please output ONLY a valid JSON object with: title (string), subtitle (string|null), " +
          "sections (array of {heading: string, content: string, bullets: string[]|null}). " +
          "No markdown, no explanation.",
      });
      const retryResult = await pdfReportModel.invoke(messages, {
        response_format: { type: "json_object" },
      });
      pdfContent = parsePdfContentJson(retryResult.content || "");
    }
  } catch (llmErr) {
    console.error("[PdfAgent] LLM content generation failed:", llmErr.message);
  }

  if (!pdfContent) {
    return {
      response:
        "I wasn't able to structure the report content properly. Could you rephrase your request or try again?",
      pdfContent: null,
      pdfTitle: null,
      generatedPdfUrl: null,
      generatedPdfPublicId: null,
    };
  }

  const pdfTitle = pdfContent.title;
  console.log(`[PdfAgent] Content generated: "${pdfTitle}" with ${pdfContent.sections.length} sections`);

  // ─── STEP 2: Render to PDF ────────────────────────────────────────
  let pdfBuffer;
  try {
    pdfBuffer = await generatePdfBuffer(pdfContent);
    console.log(`[PdfAgent] PDF rendered: ${pdfBuffer.length} bytes`);
  } catch (renderErr) {
    console.error("[PdfAgent] PDFKit rendering failed:", renderErr.message);
    return {
      response:
        "I prepared the content but hit an issue formatting the PDF — could you try again?",
      pdfContent,
      pdfTitle,
      generatedPdfUrl: null,
      generatedPdfPublicId: null,
    };
  }

  // ─── STEP 3: Upload to Cloudinary ────────────────────────────────
  let uploadResult;
  try {
    // Sanitize title for filename
    const safeFilename =
      pdfTitle.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 60) ||
      `report-${Date.now()}`;

    uploadResult = await uploadToCloudinary({
      buffer: pdfBuffer,
      filename: `${safeFilename}.pdf`,
      fileType: "pdf",
    });

    console.log(`[PdfAgent] PDF uploaded to Cloudinary. URL: "${uploadResult.url.substring(0, 80)}..."`);
  } catch (uploadErr) {
    console.error("[PdfAgent] Cloudinary upload failed (PDF was generated but couldn't be stored):", uploadErr.message);
    return {
      response:
        "I created the report but ran into an issue saving it — could you try again?",
      pdfContent,
      pdfTitle,
      generatedPdfUrl: null,
      generatedPdfPublicId: null,
    };
  }

  // ─── STEP 4: Success response ────────────────────────────────────
  return {
    response: `I've put together a report on **"${pdfTitle}"** — you can view or download it below.`,
    pdfContent,
    pdfTitle,
    generatedPdfUrl: uploadResult.url,
    generatedPdfPublicId: uploadResult.publicId,
  };
};
