import proxy from "express-http-proxy";

/**
 * createProxyWithAuth(targetServiceUrl)
 *
 * Returns an express-http-proxy middleware that:
 * 1. Assumes verifySession has already run (req.userId is set)
 * 2. Rewrites path (/api/agent/prompt -> /prompt)
 * 3. Forwards the request to the target microservice with x-user-id header
 * 4. Disables body parsing (parseReqBody: false) so raw binary streams (file uploads)
 *    and JSON payloads pass through directly without stream corruption or truncation.
 */
export const createProxyWithAuth = (targetServiceUrl) => {
  return proxy(targetServiceUrl, {
    parseReqBody: false, // CRITICAL: Never buffer or re-parse body in gateway — pipe raw bytes directly
    proxyReqPathResolver: (req) => {
      // /api/agent/prompt -> /prompt
      // /api/chat/message -> /message
      return req.originalUrl.replace(/^\/api\/[^/]+/, "");
    },
    proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
      if (srcReq.userId) {
        proxyReqOpts.headers["x-user-id"] = srcReq.userId;
      }
      return proxyReqOpts;
    },
    timeout: 120000, // 2 minutes timeout for file uploads and long LLM responses
  });
};
