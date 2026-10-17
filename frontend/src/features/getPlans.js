import api from "../utils/axios";

/**
 * Fetch available billing plans.
 */
export const getPlans = async () => {
  try {
    const response = await api.get("/api/billing/plans");
    return response.data.plans;
  } catch (error) {
    console.error("Failed to fetch billing plans:", error);
    throw error;
  }
};
