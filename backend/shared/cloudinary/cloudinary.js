/**
 * Cloudinary SDK Configuration — Shared Module
 *
 * Unlike S3 presigned URLs, Cloudinary URLs do not expire — no refresh
 * mechanism is needed. This is a deliberate simplification over the prior
 * S3 architecture. The secure_url returned at upload time IS the permanent,
 * final URL that can be stored in the database and served to clients directly.
 */
import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

export const ensureCloudinaryConfigured = () => {
  if (isConfigured) return cloudinary;

  const REQUIRED_ENV_VARS = [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ];

  const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `[CLOUDINARY CONFIG ERROR] Missing required Cloudinary environment variables: ${missingEnvVars.join(
        ", "
      )}. Please ensure they are defined in your environment/.env file.`
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
  return cloudinary;
};

// Attempt initial configuration if env vars are already populated
if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  ensureCloudinaryConfigured();
}

export default cloudinary;

