/**
 * extractUser middleware (mirrors chat service's pattern)
 * Reads the x-user-id header set by the gateway and populates req.userId.
 * Agent service NEVER reads cookies/sessions directly — it trusts the
 * gateway's forwarded header as the single source of truth for identity.
 */
export const extractUser = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized — missing user identity" });
  }

  req.userId = userId;
  next();
};
