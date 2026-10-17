import api from "../utils/axios";

/**
 * Verify Razorpay payment signature after successful client checkout.
 * @param {Object} paymentResponse - { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * @returns {Promise<{success: boolean, plan: string, credits: number}>}
 */
export const verifyPayment = async (paymentResponse) => {
  try {
    const response = await api.post("/api/billing/verify-payment", paymentResponse);
    return response.data;
  } catch (error) {
    console.error("Failed to verify payment signature:", error);
    throw error;
  }
};
