/**
 * Middleware that restricts access to internal microservice endpoints.
 * Validates that `x-internal-secret` matches `process.env.INTERNAL_SERVICE_SECRET`.
 */
export const internalAuth = (req, res, next) => {
  const secret = req.headers["x-internal-secret"];
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(401).json({ message: "Unauthorized: Invalid internal service secret" });
  }

  next();
};
