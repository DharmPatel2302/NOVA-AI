/**
 * Middleware that extracts user identification from gateway headers.
 * The Gateway validates the session cookie and sets `x-user-id` header
 * before forwarding requests to microservices.
 */
export const extractUser = (req, res, next) => {
  const userId = req.headers["x-user-id"];

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: Missing user context" });
  }

  req.userId = userId;
  next();
};
