/**
 * Single source of truth for per-agent credit costs.
 * Keyed off state.selectedAgent / agentType.
 */
export const CREDIT_COSTS = {
  chat: 1,
  search: 5,
  coding: 5,
  pdf: 10,
  ppt: 10,
  image: 10,
  // Hidden agents (triggered by file attachment, not selectable from frontend)
  imageAnalyzer: 6,
  pdfRag: 8,
};

/**
 * Gets the cost for an agentType. Defaults to chat (1) if unrecognized.
 */
export const getCreditCost = (agentType) => {
  if (agentType && typeof CREDIT_COSTS[agentType] === "number") {
    return CREDIT_COSTS[agentType];
  }
  console.warn(`[CreditCost] Unrecognized agentType "${agentType}", defaulting to chat cost (1)`);
  return CREDIT_COSTS.chat;
};
