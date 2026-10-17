# Technology 1 — Microservices Architecture
# Marks: 3/20

---

## What Is Microservices?

A monolithic application puts everything — authentication, chat, AI agents, billing — into a single codebase running as one process. If that process crashes, the entire application goes down.

Microservices splits the application into small, independent services where each service:
- Does exactly one job
- Runs in its own process on its own port
- Has its own database models and dependencies
- Can be deployed, restarted, and scaled independently
- Communicates with other services only over HTTP

---

## How NOVA AI Implements Microservices

NOVA AI is split into **5 completely independent services**:

```
React Frontend (port 5173)
        |
        v
API Gateway (port 8000)          ← Single entry point for ALL requests
        |
        |── /api/auth/*  ──────>  Auth Service    (port 8001)
        |── /api/chat/*  ──────>  Chat Service    (port 8002)
        |── /api/agent/* ──────>  Agent Service   (port 8003)
        └── /api/billing/* ────>  Billing Service (port 8004)

Shared Infrastructure:
        Redis  ← session store, shared by all services
        MongoDB Atlas ← each service has its own collections
```

---

## Each Service in Detail

### 1. API Gateway — `backend/gateway/` (port 8000)

**Single Responsibility:** Be the only door into the system.

**What it does:**
- Receives every request from the frontend
- Verifies the session cookie against Redis before forwarding
- Strips `/api/service-name` from the URL and proxies to the right service
- Injects `x-user-id` header so downstream services know who is making the request
- Handles CORS and `Cross-Origin-Opener-Policy` for Google OAuth popups

**Key file:** `gateway/index.js`
```javascript
// /api/auth/* → no session check (login handles its own auth)
app.use("/api/auth", proxy(AUTH_SERVICE, ...));

// /api/chat/* → session verified first, then proxy
app.use("/api/chat", verifySession, createProxyWithAuth(CHAT_SERVICE));

// /api/agent/* → session verified first, then proxy
app.use("/api/agent", verifySession, createProxyWithAuth(AGENT_SERVICE));
```

**Key file:** `gateway/middleware/verifySession.js`
```javascript
// Checks Redis for a valid session cookie
// If session.userId exists → attach to req and forward
// If not → return 401 Unauthorized immediately (never reaches downstream service)
```

**Key file:** `gateway/utils/proxyWithHeader.js`
```javascript
// Adds x-user-id header to every forwarded request
// parseReqBody: false → pipes raw bytes directly (critical for file uploads)
// 2-minute timeout for large file uploads and long LLM responses
```

---

### 2. Auth Service — `backend/services/auth/` (port 8001)

**Single Responsibility:** User identity, sessions, and credit balances.

**What it does:**
- Accepts Google ID tokens from the frontend (Firebase Auth)
- Creates/finds user in MongoDB, sets Redis-backed session cookie
- Exposes `/me` to return current user profile
- Exposes `/internal/deduct-credits` and `/internal/update-plan` for other services
- Manages credit balance per user

**Session flow:**
```
Frontend  →  POST /api/auth/google  { idToken }
Gateway   →  Forwards to Auth Service
Auth      →  Verifies with Firebase Admin SDK
Auth      →  Upserts user in MongoDB
Auth      →  Creates session in Redis (key: sess:SESSION_ID)
Auth      →  Sets httpOnly cookie on response
Frontend  →  Stores cookie automatically (browser handles it)
```

---

### 3. Chat Service — `backend/services/chat/` (port 8002)

**Single Responsibility:** Store and retrieve conversations and messages.

**What it does:**
- Creates, lists, renames, and deletes conversations
- Saves every AI message pair (user + assistant) to MongoDB
- Returns message history for a conversation
- All endpoints are internal (only called by Agent Service or Gateway)

**Models:**
- `Conversation` — `{ userId, title, agentType, createdAt }`
- `Message` — `{ conversationId, role, content, agentType, createdAt }`

---

### 4. Agent Service — `backend/services/agent/` (port 8003)

**Single Responsibility:** Run the AI agents via LangGraph state machine.

**What it does:**
- Receives user messages from the gateway
- Routes them through a LangGraph workflow to the right AI agent
- Runs 8 specialized AI agents
- Calls Chat Service to save messages
- Calls Auth Service to deduct credits

**8 agents:**

| Agent | What it does |
|---|---|
| `chatAgent` | General conversation via Groq LLM |
| `searchAgent` | Web search via Tavily API |
| `codingAgent` | Code generation and debugging |
| `pdfAgent` | Generates PDF documents |
| `pptAgent` | Generates PowerPoint presentations |
| `imageAgent` | Generates images via Pollinations API |
| `imageAnalyzerAgent` | Analyzes uploaded images via Gemini Vision |
| `pdfRagAgent` | RAG on uploaded PDFs using Qdrant vector DB |

**LangGraph flow:**
```
User message
     │
     ▼
  [router]           ← LLM classifies: which of 8 agents?
     │
     ▼
[creditCheck]        ← Does user have enough credits?
     │
     ├── No credits  → Return "upgrade plan" message
     │
     └── Has credits → Run selected agent → Return response
```

**Key file:** `agent/graph/graph.js`
```javascript
const workflow = new StateGraph(AgentState)
  .addNode("router", routerNode)
  .addNode("creditCheckNode", creditCheckNode)
  .addNode("chatAgent", chatAgent)
  // ... 7 more agents
  .addEdge("__start__", "router")
  .addEdge("router", "creditCheckNode")
  .addConditionalEdges("creditCheckNode", (state) => {
    if (state.creditCheckFailed) return "__end__";
    return state.selectedAgent; // routes to correct agent
  })
```

---

### 5. Billing Service — `backend/services/billing/` (port 8004)

**Single Responsibility:** Handle payment processing via Razorpay.

**What it does:**
- Returns available subscription plans
- Creates Razorpay payment orders
- Verifies payment signatures using `crypto.timingSafeEqual()` (prevents timing attacks)
- Calls Auth Service to update user's plan and credits after successful payment
- Ownership checks before processing any payment

---

## Inter-Service Communication

Services never call each other directly through the gateway. They use:

### 1. x-user-id Header (Gateway → Services)
```javascript
// Gateway adds this header on every authenticated request
proxyReqOpts.headers["x-user-id"] = srcReq.userId;

// Services read it via middleware
req.userId = req.headers["x-user-id"];
```

### 2. x-internal-secret Header (Service → Service)
```javascript
// When Agent calls Chat or Auth directly (not through Gateway),
// it includes the internal secret to prove it's a trusted service
headers: { "x-internal-secret": process.env.INTERNAL_SECRET }

// Receiving service validates:
if (req.headers["x-internal-secret"] !== process.env.INTERNAL_SECRET) {
  return res.status(403).json({ message: "Forbidden" });
}
```

This means: even if someone knows the internal service ports, they cannot call them directly without the shared secret.

---

## Independent Package Management

Each service has its own `package.json` — they have completely different dependencies:

| Service | Key Dependencies |
|---|---|
| Gateway | express, express-http-proxy, connect-redis |
| Auth | firebase-admin, mongoose, express-session |
| Chat | mongoose |
| Agent | @langchain/langgraph, @langchain/groq, @google/generative-ai, qdrant-client, multer |
| Billing | razorpay, mongoose |

Agent service has 20+ AI packages that no other service needs. With microservices, those heavy dependencies don't bloat the gateway or auth service.

---

## Key Design Decisions

### Why session check at Gateway only?
Auth happens once at the gateway. All downstream services trust the `x-user-id` header — they don't need their own session infrastructure. This avoids duplicating Redis session logic in 4 places.

### Why shared Redis?
All services share the same Redis instance. The gateway reads sessions set by the auth service. They use the same `sess:` prefix so session cookies work seamlessly across service boundaries.

### Why not call Auth Service from frontend directly?
All requests go through Gateway → Gateway adds authentication headers → Services receive verified identity. Frontend never knows the internal service URLs or ports.

---

## Fault Isolation Demonstration

This is the core benefit of microservices:

```bash
# Stop the agent service (AI is down)
docker compose stop agent-service

# Auth still works — users can still log in
# Chat still loads — conversation history still accessible
# Billing still works — users can still buy plans

# Restart just the agent service
docker compose start agent-service
# AI features are back — zero downtime for other features
```

In a monolith, one crash = total outage. In microservices, one crash = that feature is temporarily unavailable.

---

## What to Demonstrate to Faculty

### Demo 1 — Show all 5 services are independent
```bash
docker compose ps
```
Point out: each has its own container name, port, and process. They are physically separate.

### Demo 2 — Show independent package.json files
Open `backend/gateway/package.json` — minimal dependencies (proxy, redis, cors)
Open `backend/services/agent/package.json` — heavy AI dependencies (langchain, groq, gemini)
Explain: "If Agent service needs a new AI library, only agent rebuilds. Gateway is untouched."

### Demo 3 — Show request flow live
Send a message from the frontend. Then show logs:
```bash
docker compose logs -f gateway agent-service chat-service
```
You'll see:
- Gateway: `GET /api/agent/prompt`
- Gateway: session verified, forwarding with x-user-id
- Agent: received request, routing to chatAgent
- Agent: calling Chat Service to save message
- Chat: saved message to MongoDB

### Demo 4 — Fault isolation
```bash
docker compose stop agent-service
# Show auth still works, chat history loads
docker compose start agent-service
# AI features back immediately
```

### Demo 5 — Show inter-service security
Open `backend/services/auth/middlewares/internalAuth.middleware.js`
Show the `x-internal-secret` check — direct calls to internal endpoints without the secret get 403.

### What to Say at Viva
*"Instead of one large Express server handling everything, NOVA AI has 5 independent services. Each has its own codebase, dependencies, and database models. The Gateway is the only public-facing service — it verifies every session and adds the user identity header before routing requests to the correct service. Services communicate internally using a shared secret header that blocks unauthorized direct access. This means if the AI agent service goes down, users can still log in, view their chat history, and make payments — because those services are completely independent."*
