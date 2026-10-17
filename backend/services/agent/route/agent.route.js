import { Router } from "express";
import upload from "../config/multer.js";
import { handlePrompt } from "../controller/agent.controller.js";
import { deleteQdrantCollectionForConversation } from "../config/vectorDb.js";

const router = Router();

/**
 * POST /prompt — invoke the multi-agent graph.
 */
router.post(
  "/prompt",
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        // Handle multer-specific errors with clean 400 responses
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ message: "File too large — maximum size is 15MB" });
        }
        if (err.message === "Only image and PDF files are supported") {
          return res.status(400).json({ message: err.message });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      next();
    });
  },
  handlePrompt
);

/**
 * DELETE /internal/qdrant/:conversationId — internal microservice endpoint
 * to drop Qdrant vector collections when a conversation is deleted.
 */
router.delete("/internal/qdrant/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    await deleteQdrantCollectionForConversation(conversationId);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[AgentRoute] Qdrant cleanup error:", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
