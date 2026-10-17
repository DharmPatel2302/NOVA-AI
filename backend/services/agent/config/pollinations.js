/**
 * Pollinations.ai image generation client.
 *
 * Uses the image.pollinations.ai GET endpoint to generate images from text prompts.
 * If POLLINATIONS_API_KEY is set, it's included as a query parameter to reduce
 * rate-limiting and improve reliability. Without a key, the anonymous endpoint
 * still works but may be less reliable under load.
 *
 * The response is raw binary image data (not JSON), fetched as a Buffer.
 */

// ─── Startup warning for missing API key ────────────────────────────
if (!process.env.POLLINATIONS_API_KEY) {
  console.warn(
    "[Pollinations] ⚠️  POLLINATIONS_API_KEY is not set. " +
      "Image generation will use the anonymous endpoint, which may be rate-limited. " +
      "Get a free key at https://enter.pollinations.ai for improved reliability."
  );
}

/**
 * Generate an image from a text prompt using Pollinations.ai.
 *
 * @param {string} prompt - The image description/prompt
 * @param {Object} [options] - Generation options
 * @param {number} [options.width=1024] - Image width in pixels
 * @param {number} [options.height=1024] - Image height in pixels
 * @param {string} [options.model='flux'] - Model to use for generation
 * @returns {Promise<{buffer: Buffer, contentType: string}>} The generated image data
 */
export const generateImage = async (prompt, options = {}) => {
  const { width = 1024, height = 1024, model = "flux" } = options;

  // Build URL with query parameters
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: "true",
  });

  // Include API key if available for reduced rate-limiting
  if (process.env.POLLINATIONS_API_KEY) {
    params.set("key", process.env.POLLINATIONS_API_KEY);
  }

  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

  console.log(`[Pollinations] Generating image with model "${model}" (${width}x${height})...`);

  let response = await fetch(url);

  // If key failed with 401/402 (unauthorized or unpaid), fall back to anonymous generation
  if (!response.ok && (response.status === 401 || response.status === 402) && params.has("key")) {
    console.warn(
      `[Pollinations] Key failed with ${response.status}. Retrying anonymously without key...`
    );
    params.delete("key");
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    const statusText = response.statusText || "Unknown error";
    throw new Error(
      `Pollinations API returned ${response.status} ${statusText}. ` +
        (response.status === 429
          ? "Rate limit reached — try again in a moment."
          : "Image generation failed.")
    );
  }

  // Read binary image data
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length === 0) {
    throw new Error("Pollinations returned an empty response — no image data received.");
  }

  // Read actual content type from response headers (usually image/jpeg or image/png)
  const contentType = response.headers.get("content-type") || "image/jpeg";

  console.log(`[Pollinations] Image generated successfully (${buffer.length} bytes, ${contentType})`);

  return { buffer, contentType };
};
