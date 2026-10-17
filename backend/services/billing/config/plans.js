/**
 * Single source of truth for plan definitions.
 * NOTE: Prices are strictly specified in PAISE (smallest INR currency unit):
 * - ₹199 = 19900 paise
 * - ₹499 = 49900 paise
 */
export const plans = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    credits: 100,
    durationDays: null,
    description: "Ideal for exploring Nova AI capabilities with daily basic usage.",
    features: ["100 Credits", "Access to all AI agents", "Standard response speed"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 19900, // ₹199 in paise
    credits: 500,
    durationDays: 30,
    description: "Great for regular individual usage and project generation.",
    features: ["500 Credits / month", "Faster agent processing", "Full PDF & PPT exports"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 49900, // ₹499 in paise
    credits: 2000,
    durationDays: 30,
    description: "For heavy power users needing extensive code & media generation.",
    features: ["2000 Credits / month", "Priority processing", "Unlimited high-res image & doc generation"],
  },
};
