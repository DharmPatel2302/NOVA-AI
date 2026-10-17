// Load env vars before any other imports (ESM hoisting — same pattern as auth service)
import "dotenv/config";

import express from "express";
import morgan from "morgan";
import connectDB from "./config/db.js";
import chatRoutes from "./route/chat.route.js";
import { extractUser } from "./middleware/extractUser.middleware.js";

const PORT = process.env.PORT || 8002;

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────

// Request logging
app.use(morgan("dev"));

// Parse JSON request bodies
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────

// Health check (no auth required — for monitoring/docker health checks)
app.get("/health", (req, res) => {
  res.json({ message: "Chat Service is running" });
});

// Extract userId from x-user-id header (set by gateway after session verification)
// Applied to all chat routes below — every API requires an authenticated user
app.use(extractUser);

// Chat routes (conversations + messages)
app.use("/", chatRoutes);

// ─── Start Server ───────────────────────────────────────────────────

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Chat service running on port ${PORT}`);
  });
};

startServer();

