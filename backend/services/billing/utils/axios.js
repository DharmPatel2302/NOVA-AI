import axios from "axios";

/**
 * Pre-configured axios instance for service-to-service calls to Auth Service.
 * Transmits the internal service secret for backend authentication.
 */
const authServiceApi = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || "http://localhost:8001",
  headers: {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.INTERNAL_SERVICE_SECRET,
  },
  timeout: 5000,
});

export default authServiceApi;
