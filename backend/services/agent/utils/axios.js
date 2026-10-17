import axios from "axios";

/**
 * Pre-configured axios instance for calling the chat service's APIs.
 * Used to save user and assistant messages after graph execution.
 *
 * Note: This instance forwards the x-user-id header per-request
 * (set in the controller), since chat service's extractUser middleware
 * requires it for ownership validation.
 */
const chatApi = axios.create({
  baseURL: process.env.CHAT_SERVICE_URL || "http://localhost:8002",
  headers: {
    "Content-Type": "application/json",
  },
});

export default chatApi;
