import { Router } from "express";
import {
  getUserConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  saveMessage,
  getMessagesByConversation,
} from "../controller/chat.controller.js";

const router = Router();

// GET /conversations — list all conversations for the authenticated user
router.get("/conversations", getUserConversations);

// POST /conversation — create a new conversation
router.post("/conversation", createConversation);

// PATCH /conversation/:conversationId — update conversation (e.g. title)
router.patch("/conversation/:conversationId", updateConversation);

// DELETE /conversation/:conversationId — delete conversation and messages
router.delete("/conversation/:conversationId", deleteConversation);

// POST /message — save a message to a conversation
router.post("/message", saveMessage);

// GET /message/:conversationId — get all messages for a conversation
router.get("/message/:conversationId", getMessagesByConversation);

export default router;
