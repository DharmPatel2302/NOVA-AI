import Razorpay from "razorpay";

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  throw new Error(
    "[RAZORPAY CONFIG ERROR] Missing required Razorpay credentials: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be defined."
  );
}

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID.trim(),
  key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
});
