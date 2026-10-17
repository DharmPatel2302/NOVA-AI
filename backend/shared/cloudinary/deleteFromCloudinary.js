import cloudinary, { ensureCloudinaryConfigured } from "./cloudinary.js";

/**
 * Delete an asset from Cloudinary by public_id and resource_type.
 *
 * Both parameters are required because Cloudinary stores images and raw files
 * in separate namespaces — calling destroy with the wrong resource_type will
 * silently return "not found" even if the asset exists under the correct type.
 *
 * @param {string} publicId - Cloudinary public_id (e.g. "nova-ai/uuid-filename")
 * @param {string} resourceType - Cloudinary resource_type: 'image' or 'raw'
 */
export const deleteFromCloudinary = async (publicId, resourceType) => {
  if (!publicId) return;

  try {
    ensureCloudinaryConfigured();
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    console.log(
      `[CLOUDINARY] Successfully deleted asset: "${publicId}" (type: ${resourceType}), result: ${result.result}`
    );
  } catch (err) {
    console.error(
      `[CLOUDINARY] Failed to delete asset "${publicId}" (type: ${resourceType}):`,
      err.message
    );
    throw err;
  }
};
