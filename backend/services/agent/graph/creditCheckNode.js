import { checkCreditsAvailable } from "../utils/deductCredits.js";

/**
 * LangGraph node that validates credit sufficiency post-router and pre-agent node.
 * If user has insufficient credits, sets a friendly response message and flags creditCheckFailed = true.
 */
export const creditCheckNode = async (state) => {
  try {
    // If no userId provided, let execution proceed (fails open gracefully)
    if (!state.userId) {
      return { creditCheckFailed: false };
    }

    const { sufficient, required, available } = await checkCreditsAvailable(
      state.userId,
      state.selectedAgent
    );

    if (!sufficient) {
      console.warn(
        `[CreditCheckNode] User ${state.userId} has insufficient credits (${available} available < ${required} required for ${state.selectedAgent}).`
      );
      return {
        response:
          "⚡ **You don't have enough credits for this request.**\n\n" +
          `This action requires **${required} credits** (you currently have **${available} credits**).\n` +
          "Please upgrade your plan to continue using Nova AI agents.",
        creditCheckFailed: true,
      };
    }

    return { creditCheckFailed: false };
  } catch (error) {
    console.error("[CreditCheckNode] Unexpected error:", error.message);
    return { creditCheckFailed: false }; // Fail open on error
  }
};
