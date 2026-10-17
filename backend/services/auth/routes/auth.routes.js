import { Router } from "express";
import {
  googleSignIn,
  getMe,
  logout,
  updatePlanAndCredits,
  checkCreditsAvailable,
  deductCredits,
} from "../controllers/auth.controller.js";
import { internalAuth } from "../middlewares/internalAuth.middleware.js";

const router = Router();

// Public / Client auth endpoints (forwarded via Gateway /api/auth/*)
router.post("/google", googleSignIn);
router.get("/me", getMe);
router.post("/logout", logout);

// Internal microservice endpoints (called directly by billing/agent services, NOT via Gateway)
router.post("/internal/update-plan", internalAuth, updatePlanAndCredits);
router.post("/internal/check-credits", internalAuth, checkCreditsAvailable);
router.post("/internal/deduct-credits", internalAuth, deductCredits);

export default router;
