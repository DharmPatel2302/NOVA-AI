import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import proxy from "express-http-proxy";
import { verifySession } from "./middleware/verifySession.js";
import { createProxyWithAuth } from "./utils/proxyWithHeader.js";

const PORT = process.env.PORT || 8000;

const app = express();

// ─── Middleware ──────────────────────────────────────────────────────

// Request logging
app.use(morgan("dev"));

// Parse cookies (needed to forward session cookies to auth service)
app.use(cookieParser());

// CORS — credentials: true required for session cookies,
// must use exact origin (not wildcard "*")
// Supports multiple origins via comma-separated FRONTEND_URL env var
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Cross-Origin-Opener-Policy header allowing OAuth popups
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});

// ─── Proxy Routes ───────────────────────────────────────────────────

// Forward /api/auth/* → auth service (no session check needed — auth handles its own)
app.use(
  "/api/auth",
  proxy(process.env.AUTH_SERVICE || "http://localhost:8001", {
    proxyReqPathResolver: (req) => {
      // /api/auth/google → /google
      // /api/auth/me     → /me
      // /api/auth/logout  → /logout
      return req.url;
    },
    // Preserve cookies and headers
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.headers.cookie) {
        proxyReqOpts.headers["cookie"] = srcReq.headers.cookie;
      }
      return proxyReqOpts;
    },
    // Forward Set-Cookie headers from auth service back to client
    userResHeaderDecorator: (headers) => {
      return headers;
    },
  })
);

// Forward /api/chat/* → chat service (requires authenticated session)
app.use(
  "/api/chat",
  verifySession,
  createProxyWithAuth(process.env.CHAT_SERVICE || "http://localhost:8002")
);

// Forward /api/agent/* → agent service (requires authenticated session)
app.use(
  "/api/agent",
  verifySession,
  createProxyWithAuth(process.env.AGENT_SERVICE || "http://localhost:8003")
);

// Public: /api/billing/plans doesn't require session check
app.use(
  "/api/billing/plans",
  createProxyWithAuth(process.env.BILLING_SERVICE || "http://localhost:8004")
);

// Forward protected /api/billing/* → billing service (requires authenticated session)
app.use(
  "/api/billing",
  verifySession,
  createProxyWithAuth(process.env.BILLING_SERVICE || "http://localhost:8004")
);
// ─── Health Check Routes ───────────────────────────────────────────

app.get("/", (req, res) => {
  res.status(200).json({
    service: "Gateway",
    status: "Running v3",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy till now !!",
    service: "gateway",
    timestamp: new Date().toISOString(),
  });
});
// ─── Start Server ───────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Gateway running on port ${PORT}`);
});
