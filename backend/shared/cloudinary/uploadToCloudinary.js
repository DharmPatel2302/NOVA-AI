import cloudinary, { ensureCloudinaryConfigured } from "./cloudinary.js";
import { Readable } from "stream";
import crypto from "crypto";

/**
 * Uploads a binary buffer to Cloudinary.
 *
 * Returns { url, publicId, resourceType } — the url is a permanent, non-expiring
 * secure_url from Cloudinary. The publicId and resourceType are BOTH required
 * for later deletion (Cloudinary's destroy call needs resource_type to find the asset).
 *
 * IMPORTANT: resource_type must be explicitly set per file type:
 *   - 'image' for images (png, jpg, etc.)
 *   - 'raw' for non-image binary files (PDFs, PPTX)
 * Do NOT use 'auto' — it can misclassify PDFs/PPTX and break retrieval.
 *
 * Uses upload_stream (not upload) because we have in-memory buffers,
 * not file paths. The buffer is piped through a Readable stream.
 *
 * @param {Object} params
 * @param {Buffer} params.buffer - The file binary content
 * @param {string} params.filename - Original filename (used for public_id derivation)
 * @param {'image'|'pdf'|'ppt'} params.fileType - Logical file type for resource_type mapping
 * @returns {Promise<{url: string, publicId: string, resourceType: string}>}
 */
export const uploadToCloudinary = async ({ buffer, filename, fileType }) => {
  try {
    ensureCloudinaryConfigured();
    if (!buffer) throw new Error("Cloudinary Upload Error: Buffer is required.");
    if (!filename) throw new Error("Cloudinary Upload Error: Filename is required.");

    // Map logical fileType to Cloudinary's resource_type
    const resourceType = fileType === "image" ? "image" : "raw";

    // Generate a unique public_id: strip extension, sanitize, prefix with UUID
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-]/g, "_");
    const publicId = `${crypto.randomUUID()}-${sanitizedName}`;

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          public_id: publicId,
          folder: "nova-ai",
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // Pipe the buffer into the Cloudinary upload stream
      Readable.from(buffer).pipe(uploadStream);
    });

    console.log(
      `[CLOUDINARY SUCCESS] File uploaded successfully. Public ID: "${result.public_id}", URL: "${result.secure_url.substring(0, 80)}..."`
    );

    return {
      url: result.secure_url,
      publicId: result.public_id,
      resourceType,
    };
  } catch (error) {
    console.error(
      `[CLOUDINARY UPLOAD FAILED] Error uploading file "${filename}":`,
      error.message
    );
    throw new Error(`Cloudinary Upload failed for "${filename}": ${error.message}`);
  }
};
