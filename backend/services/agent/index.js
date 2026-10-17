// Load env vars before any other imports (ESM hoisting — same pattern as other services)
import "dotenv/config";

import express from "express";
import morgan from "morgan";
import agentRoutes from "./route/agent.route.js";
import { extractUser } from "./middleware/extractUser.middleware.js";

const PORT = process.env.PORT || 8003;

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────

// Request logging
app.use(morgan("dev"));

// Parse JSON request bodies — ONLY for requests that are actually JSON.
// Multipart requests (file uploads) are parsed by multer in the route layer,
// and express.json() must NOT consume them first.
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    // Skip JSON parsing for multipart — multer will handle it
    return next();
  }
  express.json()(req, res, next);
});

// ─── Routes ─────────────────────────────────────────────────────────

// Health check (no auth required — for monitoring/docker health checks)
app.get("/health", (req, res) => {
  res.json({ message: "Agent Service is running" });
});

// Extract userId from x-user-id header (set by gateway after session verification)
app.use(extractUser);

// Agent routes (POST /prompt)
app.use("/", agentRoutes);

// ─── Start Server ───────────────────────────────────────────────────

// No connectDB() — agent service doesn't own any data,
// it calls chat service's APIs to persist messages.
app.listen(PORT, () => {
  console.log(`Agent service running on port ${PORT}`);
});

