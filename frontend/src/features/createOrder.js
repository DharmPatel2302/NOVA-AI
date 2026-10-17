import api from "../utils/axios";

/**
 * Create a Razorpay payment order for a selected plan.
 * @param {Object} params
 * @param {string} params.planId - e.g. 'starter' | 'pro'
 * @returns {Promise<{orderId: string, amount: number, currency: string, keyId: string}>}
 */
export const createOrder = async ({ planId }) => {
  try {
    const response = await api.post("/api/billing/create-order", { planId });
    return response.data;
  } catch (error) {
    console.error("Failed to create billing order:", error);
    throw error;
  }
};
