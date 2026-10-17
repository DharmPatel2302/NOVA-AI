import api from "../utils/axios";

/**
 * Send a prompt to the agent service.
 * The agent service runs the LangGraph, saves both user + assistant messages
 * to the chat service internally, and returns { response, selectedAgent, searchImages }.
 *
 * Supports optional file attachment — when a file is present, sends as
 * multipart/form-data (FormData) instead of JSON. The Content-Type header
 * is NOT set manually for FormData — the browser/axios sets it automatically
 * with the correct multipart boundary. Setting it manually is a common
 * mistake that breaks the boundary parameter.
 *
 * @param {string} conversationId
 * @param {string} userPrompt
 * @param {string|null} agentOverride
 * @param {File|null} attachedFile - Browser File object for upload
 */
export const sendMessage = async ({ conversationId, userPrompt, agentOverride = null, attachedFile = null }) => {
  if (attachedFile) {
    // ─── Multipart: file upload ─────────────────────────────────
    const formData = new FormData();
    formData.append("file", attachedFile);
    formData.append("conversationId", conversationId);
    formData.append("userPrompt", userPrompt || "");
    if (agentOverride) {
      formData.append("agentOverride", agentOverride);
    }

    const response = await api.post("/api/agent/prompt", formData, {
      // Do NOT set Content-Type manually — let axios/browser auto-set with boundary
      timeout: 120000, // Longer timeout for file uploads
    });
    return response.data;
  }

  // ─── JSON: no file ──────────────────────────────────────────
  const response = await api.post("/api/agent/prompt", {
    conversationId,
    userPrompt,
    agentOverride,
  });
  return response.data;
};
