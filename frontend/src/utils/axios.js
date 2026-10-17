import axios from "axios";

// Pre-configured axios instance for all API calls
// withCredentials: true is required so the browser sends/receives session cookies
//
// NOTE: Do NOT set a default Content-Type header here.
// Axios automatically sets Content-Type: application/json for plain object bodies
// and Content-Type: multipart/form-data (with correct boundary) for FormData bodies.
// A hardcoded default would override FormData's auto-detection and break file uploads.
const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || "http://localhost:8000",
  withCredentials: true,
});

export default api;

