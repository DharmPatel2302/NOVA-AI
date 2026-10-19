// MUST be first import — loads .env vars during ESM import phase,
// before other modules (like firebase.js) read process.env
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import session from "express-session";
import connectRedis from "connect-redis";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";

// Import the shared Redis client (relative path — no npm workspaces needed)
import redisClient from "../../shared/redis/redis.js";

const PORT = process.env.PORT || 8001;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────

// Request logging
app.use(morgan("dev"));

// Parse JSON request bodies
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// CORS — allow credentials (cookies) from the frontend origin
// Supports multiple origins via comma-separated FRONTEND_URL env var
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ─── Session (Redis-backed, 7-day fixed expiry) ─────────────────────

const RedisStore = connectRedis(session);

app.use(
  session({
    store: new RedisStore({
      client: redisClient,
      prefix: "sess:",
    }),
    secret: process.env.SESSION_SECRET || "fallback-dev-secret",
    resave: false,          // Don't re-save if nothing changed
    saveUninitialized: false, // Don't create empty sessions
    rolling: false,         // Fixed 7-day expiry from login, no auto-refresh
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SEVEN_DAYS_MS,
    },
  })
);

// ─── Routes ─────────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "auth", timestamp: new Date().toISOString() });
});

// Auth routes (POST /google, GET /me, POST /logout)
app.use("/", authRoutes);

// ─── Start Server ───────────────────────────────────────────────────

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Auth service running on port ${PORT}`);
  });
};

startServer();
