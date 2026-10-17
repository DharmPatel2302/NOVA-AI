import crypto from "crypto";
import { razorpay } from "../config/razorpay.js";
import { plans } from "../config/plans.js";
import Payment from "../models/payment.model.js";
import authServiceApi from "../utils/axios.js";

/**
 * GET /plans
 * Public-ish catalog endpoint returning available plan definitions.
 */
export const getPlans = async (req, res) => {
  return res.status(200).json({ plans });
};

/**
 * POST /create-order
 * Creates a Razorpay order and initial Payment record in MongoDB.
 */
export const createOrder = async (req, res) => {
  try {
    const { planId } = req.body;
    const userId = req.userId;

    if (!planId || !plans[planId]) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    if (planId === "free") {
      return res.status(400).json({
        message: "Free plan does not require a payment order. Use switch-free endpoint.",
      });
    }

    const selectedPlan = plans[planId];

    // Create order with Razorpay Node SDK (amount in paise)
    // NOTE: Razorpay enforces a strict 40-character maximum limit on the receipt field.
    const userSuffix = userId ? String(userId).slice(-8) : "user";
    const receiptId = `rcpt_${Date.now()}_${userSuffix}`.substring(0, 40);

    const orderOptions = {
      amount: selectedPlan.price,
      currency: "INR",
      receipt: receiptId,
    };

    const razorpayOrder = await razorpay.orders.create(orderOptions);

    // Save payment record in DB
    await Payment.create({
      userId,
      orderId: razorpayOrder.id,
      amount: selectedPlan.price,
      credits: selectedPlan.credits,
      plan: planId,
      status: "created",
    });

    return res.status(200).json({
      orderId: razorpayOrder.id,
      amount: selectedPlan.price,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(
      "[Billing] createOrder error:",
      error.error?.description || error.message || error
    );
    return res.status(500).json({
      message: "Failed to create payment order: " + (error.error?.description || error.message),
    });
  }
};

/**
 * POST /verify-payment
 * Secure client-driven HMAC payment verification and account plan update.
 */
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.userId;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing required verification credentials" });
    }

    // 1. Find payment doc
    const payment = await Payment.findOne({ orderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ message: "Payment order not found" });
    }

    // 2. Ownership check
    if (payment.userId.toString() !== userId) {
      return res.status(403).json({ message: "Forbidden: Order ownership mismatch" });
    }

    // 3. Idempotency check — if already processed, return success immediately
    if (payment.status === "paid") {
      return res.status(200).json({
        success: true,
        plan: payment.plan,
        credits: payment.credits,
        message: "Payment already verified",
      });
    }

    // 4. HMAC Signature verification using timingSafeEqual
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");
    const receivedBuffer = Buffer.from(razorpay_signature, "utf-8");

    // Length check prevents timingSafeEqual from throwing
    const isValidSignature =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValidSignature) {
      payment.status = "failed";
      await payment.save();
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // 5. Update payment status to paid
    payment.status = "paid";
    payment.paymentId = razorpay_payment_id;
    payment.signature = razorpay_signature;
    await payment.save();

    // 6. Update user's plan and credits in auth service via internal API call
    const planConfig = plans[payment.plan];
    const updatePayload = {
      userId,
      plan: payment.plan,
      credits: payment.credits,
      durationDays: planConfig?.durationDays || 30,
    };

    let authSuccess = false;
    try {
      await authServiceApi.post("/internal/update-plan", updatePayload);
      authSuccess = true;
    } catch (firstErr) {
      console.warn("[Billing] First attempt to update auth plan failed, retrying once...", firstErr.message);
      try {
        await authServiceApi.post("/internal/update-plan", updatePayload);
        authSuccess = true;
      } catch (retryErr) {
        console.error(
          `[BILLING CRITICAL] User paid successfully (Payment ID: ${razorpay_payment_id}), but Auth Service plan update failed after retry:`,
          retryErr.message
        );
      }
    }

    if (!authSuccess) {
      return res.status(200).json({
        success: true,
        plan: payment.plan,
        credits: payment.credits,
        warning: "Payment confirmed — your account credits will be updated shortly.",
      });
    }

    return res.status(200).json({
      success: true,
      plan: payment.plan,
      credits: payment.credits,
    });
  } catch (error) {
    console.error("[Billing] verifyPayment error:", error);
    return res.status(500).json({ message: "Server error verifying payment" });
  }
};

/**
 * POST /switch-free
 * Switches user to the free tier (direct internal auth update).
 */
export const switchToFreePlan = async (req, res) => {
  try {
    const userId = req.userId;
    const freePlan = plans.free;

    await authServiceApi.post("/internal/update-plan", {
      userId,
      plan: "free",
      credits: freePlan.credits,
      durationDays: null,
    });

    return res.status(200).json({
      success: true,
      plan: "free",
      credits: freePlan.credits,
    });
  } catch (error) {
    console.error("[Billing] switchToFreePlan error:", error);
    return res.status(500).json({ message: "Failed to switch to free plan" });
  }
};
