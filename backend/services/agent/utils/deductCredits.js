import axios from "axios";

const authServiceApi = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || "http://localhost:8001",
  headers: {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET,
  },
  timeout: 5000,
});

/**
 * Pre-execution credit check.
 * On infra/network error talking to Auth Service, logs a warning and fails open
 * ({ sufficient: true }) to prevent temporary auth blips from blocking users.
 */
export const checkCreditsAvailable = async (userId, agentType) => {
  try {
    const response = await authServiceApi.post("/internal/check-credits", {
      userId,
      agentType,
    });
    return response.data; // { sufficient: boolean, required: number, available: number }
  } catch (error) {
    console.warn(
      `[CreditCheck Infra Warning] Failed to check credits for user ${userId} (${agentType}): ${error.message}. Failing open.`
    );
    return { sufficient: true, required: 0, available: 9999 };
  }
};

/**
 * Post-execution credit deduction.
 * Deducts credits for completed agent executions.
 * Returns { success: boolean, remainingCredits: number } or null on failure.
 */
export const deductCredits = async (userId, agentType) => {
  try {
    const response = await authServiceApi.post("/internal/deduct-credits", {
      userId,
      agentType,
    });
    return response.data; // { success: true, deducted: number, remainingCredits: number }
  } catch (error) {
    if (error.response && error.response.status === 402) {
      console.warn(
        `[CreditDeduct Warning] User ${userId} ran out of credits at deduction stage (${agentType}).`
      );
      return { success: false, message: "Insufficient credits", remainingCredits: 0 };
    }
    console.error(
      `[CREDIT DEDUCT CRITICAL] Infra error deducting credits for user ${userId} (${agentType}): ${error.message}`
    );
    return null;
  }
};
