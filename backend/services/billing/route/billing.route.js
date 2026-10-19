import express from "express";
import { extractUser } from "../middleware/extractUser.middleware.js";
import {
  getPlans,
  createOrder,
  verifyPayment,
  switchToFreePlan,
} from "../controller/billing.controller.js";

const router = express.Router();

// Public — no session required (plan catalog is not user-specific)
router.get("/plans", getPlans);

// All routes below require an authenticated session
router.use(extractUser);

router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/switch-free", switchToFreePlan);

export default router;
