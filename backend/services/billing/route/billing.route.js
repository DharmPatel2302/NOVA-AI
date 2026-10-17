import express from "express";
import { extractUser } from "../middleware/extractUser.middleware.js";
import {
  getPlans,
  createOrder,
  verifyPayment,
  switchToFreePlan,
} from "../controller/billing.controller.js";

const router = express.Router();

router.use(extractUser);

router.get("/plans", getPlans);
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/switch-free", switchToFreePlan);

export default router;
