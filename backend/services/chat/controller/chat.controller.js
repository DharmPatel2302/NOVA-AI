import mongoose from "mongoose";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

/**
 * GET /conversations
 * Fetch all conversations for the authenticated user, sorted by most recent activity first.
 * Returns empty array if user has no conversations (not an error).
 */
export const getUserConversations = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const conversations = await Conversation.find({ userId: req.userId })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .select("-__v");

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("getUserConversations error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /conversation
 * Create a new conversation for the authenticated user.
 */
export const createConversation = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { title } = req.body;

    const conversation = await Conversation.create({
      userId: req.userId,
      title: title || "New Conversation",
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error("createConversation error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /conversation/:conversationId
 * Update a conversation (e.g. title). Validates ownership.
 */
export const updateConversation = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId format" });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Forbidden — not your conversation" });
    }

    // Apply partial update — only fields provided in the body
    const allowedFields = ["title"];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updated = await Conversation.findByIdAndUpdate(
      conversationId,
      { $set: updates },
      { new: true }
    );

    return res.status(200).json({ conversation: updated });
  } catch (error) {
    console.error("updateConversation error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /conversation/:conversationId
 * Deletes a conversation and all its messages.
 * Cascading cleanup: best-effort deletes Cloudinary assets & Qdrant vector collection.
 */
export const deleteConversation = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId format" });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Forbidden — not your conversation" });
    }

    // ─── 1. Find all messages & collect Cloudinary asset info ──────
    const messages = await Message.find({ conversationId }).lean();

    // Collect {publicId, resourceType} pairs for Cloudinary cleanup.
    // resourceType is a fixed 1:1 mapping per field name: image→'image', pdf/ppt→'raw'.
    const cloudinaryAssetsToDelete = [];
    for (const msg of messages) {
      if (msg.generatedImagePublicId) {
        cloudinaryAssetsToDelete.push({ publicId: msg.generatedImagePublicId, resourceType: "image" });
      }
      if (msg.generatedPdfPublicId) {
        cloudinaryAssetsToDelete.push({ publicId: msg.generatedPdfPublicId, resourceType: "raw" });
      }
      if (msg.generatedPptPublicId) {
        cloudinaryAssetsToDelete.push({ publicId: msg.generatedPptPublicId, resourceType: "raw" });
      }
    }

    // ─── 2. Delete DB records ─────────────────────────────────────
    await Message.deleteMany({ conversationId });
    await Conversation.deleteOne({ _id: conversationId });

    console.log(`[ChatController] Deleted conversation ${conversationId} and ${messages.length} messages.`);

    // ─── 3. Best-effort Cloudinary asset cleanup ──────────────────
    // Uses dynamic import so the chat service doesn't hard-depend on the
    // Cloudinary SDK at startup (the SDK is installed in the agent service;
    // chat service accesses it via the shared module which reads from env vars
    // that may not be present in chat's env — so this is wrapped defensively).
    if (cloudinaryAssetsToDelete.length > 0) {
      (async () => {
        try {
          const { deleteFromCloudinary } = await import("../../../shared/cloudinary/deleteFromCloudinary.js");
          for (const asset of cloudinaryAssetsToDelete) {
            try {
              await deleteFromCloudinary(asset.publicId, asset.resourceType);
            } catch (err) {
              console.warn(`[ChatController Cleanup Warning] Failed to delete Cloudinary asset ${asset.publicId}:`, err.message);
            }
          }
        } catch (importErr) {
          console.warn("[ChatController Cleanup Warning] Cloudinary delete utility error:", importErr.message);
        }
      })();
    }

    // ─── 4. Best-effort Qdrant vector collection cleanup ───────────
    (async () => {
      try {
        const axios = (await import("axios")).default;
        const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8003";
        await axios.delete(`${agentUrl}/internal/qdrant/${conversationId}`);
        console.log(`[ChatController] Best-effort Qdrant collection deleted for ${conversationId}`);
      } catch (qdrantErr) {
        console.warn(`[ChatController Cleanup Warning] Qdrant cleanup failed for ${conversationId}:`, qdrantErr.message);
      }
    })();

    return res.status(200).json({ success: true, message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("deleteConversation error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /message
 * Save a new message to a conversation. Validates ownership.
 */
export const saveMessage = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      conversationId, role, content, agentType, searchImages,
      artifactTitle, artifactFiles,
      generatedImageUrl, generatedImagePublicId,
      generatedPdfUrl, generatedPdfPublicId, pdfTitle,
      generatedPptUrl, generatedPptPublicId, pptTitle,
    } = req.body;

    // Validate required fields
    if (!conversationId) {
      return res.status(400).json({ message: "conversationId is required" });
    }
    if (!role) {
      return res.status(400).json({ message: "role is required" });
    }
    if (!content) {
      return res.status(400).json({ message: "content is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId format" });
    }

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Ownership check
    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Forbidden — not your conversation" });
    }

    // Create the message — all optional fields spread conditionally
    const message = await Message.create({
      conversationId,
      role,
      content,
      ...(agentType ? { agentType } : {}),
      ...(searchImages && Array.isArray(searchImages) && searchImages.length > 0
        ? { searchImages }
        : {}),
      ...(artifactTitle ? { artifactTitle } : {}),
      ...(artifactFiles && Array.isArray(artifactFiles) && artifactFiles.length > 0
        ? { artifactFiles }
        : {}),
      ...(generatedImageUrl ? { generatedImageUrl } : {}),
      ...(generatedImagePublicId ? { generatedImagePublicId } : {}),
      ...(generatedPdfUrl ? { generatedPdfUrl } : {}),
      ...(generatedPdfPublicId ? { generatedPdfPublicId } : {}),
      ...(pdfTitle ? { pdfTitle } : {}),
      ...(generatedPptUrl ? { generatedPptUrl } : {}),
      ...(generatedPptPublicId ? { generatedPptPublicId } : {}),
      ...(pptTitle ? { pptTitle } : {}),
    });

    // Update parent conversation's lastMessageAt
    conversation.lastMessageAt = new Date();
    await conversation.save();

    return res.status(201).json({ message });
  } catch (error) {
    console.error("saveMessage error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /message/:conversationId
 * Fetch all messages for a conversation, sorted oldest-first. Validates ownership.
 *
 * NOTE: No URL refresh step is needed here. Cloudinary URLs stored on messages
 * are permanent and never expire — unlike the old S3 presigned URLs which
 * required regeneration on every fetch. This is a deliberate simplification
 * from the S3→Cloudinary migration.
 */
export const getMessagesByConversation = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { conversationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: "Invalid conversationId format" });
    }

    // Check conversation exists
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Ownership check
    if (conversation.userId.toString() !== req.userId) {
      return res.status(403).json({ message: "Forbidden — not your conversation" });
    }

    // Fetch messages sorted by createdAt ascending (natural chat order)
    // Cloudinary URLs are permanent — messages are returned exactly as stored,
    // with no per-fetch URL regeneration step needed.
    const messages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .select("-__v")
      .lean();

    return res.status(200).json({ messages });
  } catch (error) {
    console.error("getMessagesByConversation error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};
