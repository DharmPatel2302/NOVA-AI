import multer from "multer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Multer configuration for file uploads (image + PDF).
 *
 * - Stores files in services/agent/temp/uploads/ with UUID-prefixed filenames
 *   to prevent collisions between concurrent uploads.
 * - Accepts ONLY image/* and application/pdf mimetypes.
 * - 15MB file size cap to prevent DoS/disk-fill attacks.
 */
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../temp/uploads"),
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}-${file.originalname}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only image and PDF files are supported"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

export default upload;
