/**
 * requireAuth middleware
 * Checks if the request has a valid session (req.session.userId).
 * Blocks unauthenticated requests with a 401 response.
 *
 * Usage: import and apply to any route that needs protection.
 *   import { requireAuth } from "../middlewares/requireAuth.js";
 *   router.get("/protected", requireAuth, handler);
 */
export const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      authenticated: false,
      message: "Unauthorized — please sign in",
    });
  }

  next();
};
