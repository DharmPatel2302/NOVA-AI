import auth from "../config/firebase.js";
import User from "../models/user.model.js";
import { getCreditCost } from "../config/creditCosts.js";

/**
 * Helper to structure user payload consistently.
 */
const formatUserPayload = (user) => ({
  _id: user._id,
  uid: user.uid,
  email: user.email,
  name: user.name,
  photoURL: user.photoURL,
  plan: user.plan || "free",
  credits: typeof user.credits === "number" ? user.credits : 100,
  totalCredits: typeof user.totalCredits === "number" ? user.totalCredits : 100,
  planExpiresAt: user.planExpiresAt || null,
});

/**
 * POST /google
 * Verify Firebase ID token → find or create user → create session → set cookie.
 */
export const googleSignIn = async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "ID token is required" });
    }

    // Verify the Firebase ID token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture: photoURL } = decodedToken;

    // Find existing user or create a new one
    let user = await User.findOne({ uid });

    if (user) {
      // Existing user — update lastLogin
      user.lastLogin = new Date();
      await user.save();
    } else {
      // New user — create document with default free plan & 100 credits
      user = await User.create({
        uid,
        email,
        name: name || "",
        photoURL: photoURL || "",
        plan: "free",
        credits: 100,
        totalCredits: 100,
        planExpiresAt: null,
        lastLogin: new Date(),
        createdAt: new Date(),
      });
    }

    // Store user info in session
    req.session.userId = user._id.toString();
    req.session.loginAt = Date.now();

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.status(200).json({
      message: "Sign-in successful",
      user: formatUserPayload(user),
    });
  } catch (error) {
    console.error("Google Sign-In error:", error.message);
    return res.status(401).json({ message: "Authentication failed", error: error.message });
  }
};

/**
 * GET /me
 * Check current session → return user info if valid, else 401.
 */
export const getMe = async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(200).json({ user: null });
    }

    const user = await User.findById(req.session.userId).select("-__v");

    if (!user) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: formatUserPayload(user),
    });
  } catch (error) {
    console.error("getMe error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /logout
 * Destroy session → clear cookie.
 */
export const logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err.message);
        return res.status(500).json({ message: "Logout failed" });
      }

      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
      return res.status(200).json({ message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Logout error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── INTERNAL ENDPOINTS (guarded by internalAuth middleware) ───────────

/**
 * POST /internal/update-plan
 * Internal endpoint called by Billing Service after payment verification or free tier switch.
 */
export const updatePlanAndCredits = async (req, res) => {
  try {
    const { userId, plan, credits, durationDays } = req.body;

    if (!userId || !plan || typeof credits !== "number") {
      return res.status(400).json({ message: "Missing required plan update fields" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Set new plan, credits, and totalCredits ceiling
    user.plan = plan;
    user.credits = credits;
    user.totalCredits = credits;
    user.planExpiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000) : null;

    await user.save();

    console.log(`[Auth Internal] Plan updated for user ${userId}: ${plan} (${credits} credits)`);

    return res.status(200).json({
      success: true,
      plan: user.plan,
      credits: user.credits,
      totalCredits: user.totalCredits,
      planExpiresAt: user.planExpiresAt,
    });
  } catch (error) {
    console.error("updatePlanAndCredits error:", error.message);
    return res.status(500).json({ message: "Internal server error updating plan" });
  }
};

/**
 * POST /internal/check-credits
 * Internal endpoint called by Agent Service prior to running agent nodes.
 */
export const checkCreditsAvailable = async (req, res) => {
  try {
    const { userId, agentType } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const cost = getCreditCost(agentType);
    const user = await User.findById(userId).select("credits");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const sufficient = user.credits >= cost;

    return res.status(200).json({
      sufficient,
      required: cost,
      available: user.credits,
    });
  } catch (error) {
    console.error("checkCreditsAvailable error:", error.message);
    return res.status(500).json({ message: "Internal server error checking credits" });
  }
};

/**
 * POST /internal/deduct-credits
 * Internal endpoint called by Agent Service after successful agent execution.
 * Uses Mongoose atomic findOneAndUpdate with credit threshold to prevent race conditions.
 */
export const deductCredits = async (req, res) => {
  try {
    const { userId, agentType } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const cost = getCreditCost(agentType);

    // ATOMIC UPDATE: find user with sufficient credits and decrement
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits for this action",
      });
    }

    console.log(
      `[Auth Internal] Deducted ${cost} credits for ${agentType} from user ${userId}. Remaining: ${updatedUser.credits}`
    );

    return res.status(200).json({
      success: true,
      deducted: cost,
      remainingCredits: updatedUser.credits,
    });
  } catch (error) {
    console.error("deductCredits error:", error.message);
    return res.status(500).json({ message: "Internal server error deducting credits" });
  }
};
