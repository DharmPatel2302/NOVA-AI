import { codingModelCall } from "../config/llmModel.js";

// ─── Valid Coding Intents ────────────────────────────────────────────
const VALID_INTENTS = ["code_generation", "code_review", "explanation", "debugging"];

// ─── STEP 1: Intent Classification Prompt ────────────────────────────
const INTENT_SYSTEM_PROMPT = `You are a coding intent classifier. Classify the user's coding request into exactly ONE of these 4 categories. Respond with ONLY a JSON object.

Categories:
1. "code_generation" — User wants something BUILT, CREATED, or MADE.
   Examples: "build a calculator", "create a landing page", "make a to-do app", "write a Python script that..."
2. "code_review" — User wants existing code REVIEWED, CRITIQUED, or IMPROVED.
   Examples: "review this code", "what's wrong with this function", "how can I improve this code"
3. "explanation" — User wants code or a concept EXPLAINED.
   Examples: "explain how async/await works", "what does this regex do", "how does this algorithm work"
4. "debugging" — User is hitting an ERROR and wants it FIXED.
   Examples: "why am I getting this error", "fix this bug", "this code throws TypeError, help"

Response format (strict JSON, no other text):
{"intent": "code_generation"}`;

// ─── STEP 2a: Code Generation System Prompt ──────────────────────────
const CODE_GEN_SYSTEM_PROMPT = `You are an expert full-stack developer. The user wants you to BUILD something.

OUTPUT FORMAT: You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no explanation outside the JSON). The JSON must have this exact shape:

{
  "projectTitle": "Short Project Name",
  "summary": "A 1-3 sentence description of what was built and its key features. This is shown in the chat bubble — keep it concise and informative.",
  "files": [
    {
      "filename": "index.html",
      "language": "html",
      "content": "<!DOCTYPE html>..."
    },
    {
      "filename": "style.css",
      "language": "css",
      "content": "body { ... }"
    },
    {
      "filename": "script.js",
      "language": "javascript",
      "content": "// ..."
    }
  ]
}

RULES:
- For web projects (calculator, landing page, to-do app, etc.), generate exactly 3 files: index.html, style.css, script.js.
- For single-file requests (e.g. "write a Python script"), generate just 1 file with the appropriate filename and language.
- Match the "language" field to Monaco editor language identifiers: "html", "css", "javascript", "python", "typescript", "java", "cpp", "c", "rust", "go", "json", "markdown", etc.
- Write COMPLETE, WORKING, PRODUCTION-QUALITY code — not stubs or placeholders.
- INDENTATION AND NEWLINES (CRITICAL): The "content" field of each file MUST be formatted properly with standard code indentation (2 or 4 spaces) and real newline characters (\n). Do NOT compress, minify, or output the code as a single line. It must be highly readable and look like professional source code in an IDE.
- STRICT FILE ISOLATION: Put ONLY HTML code in .html files, ONLY CSS code in .css files, and ONLY JavaScript code in .js files. NEVER mix internal <style> or inline <script> inside the HTML file when generating multi-file web projects.
- NO ESCAPED SEQUENCES: Do NOT output double-escaped newline literal text (like \\\\n). Use raw, real newlines inside JSON strings.
- For web projects: use modern CSS (flexbox/grid, CSS variables, smooth animations, gradients, premium dark-mode design). Make it look stunning.
- For images in HTML: use https://picsum.photos/WIDTH/HEIGHT?random=N for placeholder images (e.g. https://picsum.photos/400/300?random=1). These are real, freely hotlinkable photo placeholders.
- Include proper error handling and edge cases.
- The HTML file should be fully self-contained for preview — reference style.css and script.js via relative paths, but the preview system will inline them automatically.`;

// ─── STEP 2b: Code Review System Prompt ──────────────────────────────
const CODE_REVIEW_PROMPT = `You are a senior code reviewer. Provide specific, actionable feedback organized by severity:

1. **Critical Issues** — Bugs, security vulnerabilities, data loss risks
2. **Improvements** — Performance, readability, maintainability suggestions
3. **Style** — Naming conventions, formatting, idiomatic patterns

For each issue:
- Quote the specific line/block
- Explain WHY it's a problem
- Provide the corrected code

Use markdown formatting with code blocks.`;

// ─── STEP 2c: Explanation System Prompt ──────────────────────────────
const EXPLANATION_PROMPT = `You are a patient coding teacher. Explain the concept or code step-by-step:

- Break complex topics into digestible sections with clear headers
- Use code examples with comments to illustrate each point
- Explain the "why" behind patterns, not just the "what"
- Use analogies when helpful for abstract concepts
- Include common pitfalls and edge cases

Use markdown formatting with proper code blocks and language tags.`;

// ─── STEP 2d: Debugging System Prompt ────────────────────────────────
const DEBUGGING_PROMPT = `You are an expert debugger. When the user reports a bug or error:

1. **Root Cause Analysis** — Identify the EXACT root cause before suggesting fixes. Explain why the error occurs.
2. **The Fix** — Provide the corrected code with clear before/after comparison.
3. **Prevention** — Suggest how to prevent similar bugs in the future (patterns, tools, tests).

Do NOT just paste corrected code blindly — understanding the root cause is more valuable than a fix without explanation.
Use markdown formatting with code blocks.`;

/**
 * Coding agent node — intent classification + branched execution.
 *
 * STEP 1: Classify intent via codingModelCall (uses Claude Sonnet 4 on OpenRouter).
 *   Using the same model for classification (not a separate lightweight model)
 *   because: (a) the classification is a trivial single-JSON-object response that
 *   adds negligible latency, (b) the model is already warm for the follow-up
 *   generation call, and (c) using a separate classifier model would add
 *   complexity without meaningful cost savings for a single small call.
 *
 * STEP 2: Branch by intent:
 *   - code_generation → structured JSON output with files → opens Artifact panel
 *   - code_review / explanation / debugging → normal markdown text response
 */
export const codingAgent = async (state) => {
  try {
    // ─── STEP 1: Intent Classification ──────────────────────────────
    let codingIntent = "code_generation"; // Default fallback
    try {
      const classificationResult = await codingModelCall([
        { role: "system", content: INTENT_SYSTEM_PROMPT },
        { role: "user", content: state.userPrompt },
      ]);

      // Parse the JSON response, stripping any accidental markdown fences
      const cleanedResult = classificationResult
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();
      const parsed = JSON.parse(cleanedResult);

      if (parsed.intent && VALID_INTENTS.includes(parsed.intent)) {
        codingIntent = parsed.intent;
      } else {
        console.warn(`[CodingAgent] Invalid intent "${parsed.intent}", defaulting to code_generation`);
      }
    } catch (classifyErr) {
      console.warn("[CodingAgent] Intent classification failed, defaulting to code_generation:", classifyErr.message);
    }

    console.log(`[CodingAgent] Intent: "${codingIntent}" for prompt: "${state.userPrompt.substring(0, 80)}..."`);

    // ─── STEP 2: Branch by Intent ───────────────────────────────────

    // ---------- code_generation ----------
    if (codingIntent === "code_generation") {
      return await handleCodeGeneration(state, codingIntent);
    }

    // ---------- code_review / explanation / debugging ----------
    const systemPrompts = {
      code_review: CODE_REVIEW_PROMPT,
      explanation: EXPLANATION_PROMPT,
      debugging: DEBUGGING_PROMPT,
    };

    const textResult = await codingModelCall([
      { role: "system", content: systemPrompts[codingIntent] },
      { role: "user", content: state.userPrompt },
    ]);

    return {
      response: textResult,
      codingIntent,
      artifactFiles: null,
      artifactTitle: null,
    };
  } catch (error) {
    console.error("Coding agent error:", error.message);
    return {
      response: "I'm sorry, I couldn't process your coding request right now. Please try again.",
      codingIntent: null,
      artifactFiles: null,
      artifactTitle: null,
      error: error.message,
    };
  }
};

/**
 * Handle code_generation intent — structured JSON output with retry-once logic.
 */
async function handleCodeGeneration(state, codingIntent) {
  let attempt = 0;
  let lastError = "";

  while (attempt < 2) {
    attempt++;
    try {
      const messages = [
        { role: "system", content: CODE_GEN_SYSTEM_PROMPT + (attempt > 1
          ? "\n\nIMPORTANT RETRY: Your previous response was not valid JSON. You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON."
          : "")
        },
        { role: "user", content: state.userPrompt },
      ];

      const rawResult = await codingModelCall(messages);

      // Strip markdown code fences if the model wrapped JSON in them
      const cleaned = rawResult
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      // Validate required shape
      if (!parsed.projectTitle || !parsed.summary || !Array.isArray(parsed.files) || parsed.files.length === 0) {
        throw new Error("Missing required fields: projectTitle, summary, or files");
      }

      // Validate each file
      for (const file of parsed.files) {
        if (!file.filename || !file.language || !file.content) {
          throw new Error(`Invalid file entry: missing filename, language, or content`);
        }
      }

      console.log(`[CodingAgent] Generated ${parsed.files.length} files for "${parsed.projectTitle}"`);

      return {
        response: parsed.summary,
        codingIntent,
        artifactFiles: parsed.files,
        artifactTitle: parsed.projectTitle,
      };
    } catch (parseErr) {
      lastError = parseErr.message;
      console.warn(`[CodingAgent] code_generation attempt ${attempt} failed:`, lastError);
      if (attempt >= 2) break;
    }
  }

  // Both attempts failed — graceful text fallback
  console.error(`[CodingAgent] code_generation failed after 2 attempts: ${lastError}`);
  return {
    response: "I tried to generate the code but encountered a formatting issue. Could you try rephrasing your request? For example: \"build a calculator app with HTML, CSS, and JavaScript\".",
    codingIntent,
    artifactFiles: null,
    artifactTitle: null,
    error: lastError,
  };
}
