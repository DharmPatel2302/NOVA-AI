import "dotenv/config";
import session from "express-session";
import connectRedis from "connect-redis";
import redisClient from "../../shared/redis/redis.js";

/**
 * verifySession middleware for the gateway.
 * Uses express-session + connect-redis to validate the session cookie.
 * If the session has a userId, populates req.userId for downstream use.
 * If not, returns 401.
 *
 * This middleware is mounted ONLY on routes that require authentication
 * (e.g. /api/chat/*), NOT on /api/auth/* which handles its own sessions.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const RedisStore = connectRedis(session);

// Create the session middleware instance (reusing the same Redis store + config as auth)
const sessionMiddleware = session({
  store: new RedisStore({
    client: redisClient,
    prefix: "sess:",
  }),
  secret: process.env.SESSION_SECRET || "fallback-dev-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SEVEN_DAYS_MS,
  },
});

export const verifySession = (req, res, next) => {
  // First, parse the session from the cookie via express-session
  sessionMiddleware(req, res, () => {
    if (!req.session || !req.session.userId) {
      console.log("🔒 [verifySession] Unauthorized request to:", req.originalUrl);
      console.log("   - Cookie header:", req.headers.cookie);
      console.log("   - Parsed cookies:", req.cookies);
      console.log("   - Session ID:", req.sessionID);
      console.log("   - Session content:", req.session);
      return res.status(401).json({
        authenticated: false,
        message: "Unauthorized — please sign in",
      });
    }

    // Populate req.userId for downstream proxy to forward
    req.userId = req.session.userId;
    next();
  });
};
