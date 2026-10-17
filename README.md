# Nova AI — Multi-Agent AI Chatbot Platform

> An enterprise-grade, microservices-powered AI workspace featuring dynamic multi-agent orchestration, live code execution, real-time web intelligence, multimodal vision analysis, and vector-backed document RAG.

Nova AI is a full-stack, distributed conversational intelligence platform engineered with the MERN stack and LangGraph. Designed to handle diverse generative AI workloads, Nova AI intelligently classifies and routes user queries across 8 specialized agents — spanning live web research, interactive coding, document synthesis, multi-modal image analysis, and vector-embedded PDF search. Built with microservice isolation, credit-based usage governance, and stateful session caching, Nova AI bridges high-performance AI orchestration with a responsive, developer-centric user experience.

---

> [!NOTE]
> **Active Infrastructure & Storage Migration Notice**  
> This project is under active migration — infrastructure was recently moved off AWS (ECS, ECR, ElastiCache, S3, NAT Gateway, load balancers were fully torn down and the account closed) and is being redeployed on alternative platforms. The object storage layer is actively transitioning from AWS S3 to an alternative provider (Cloudflare R2 or Cloudinary — final platform decision in progress). While all core agent logic and conversational features are fully built and operational locally, features that depend on persistent file storage (historical generated images, PDFs, and slide decks referencing the decommissioned S3 bucket) may be temporarily degraded during this transition.

---

## ✨ Features

### 🔐 Authentication & Session Management

- **Firebase Google Sign-In**: Streamlined authentication flow with Google OAuth via Firebase Authentication.
- **Redis-Backed 7-Day Sessions**: High-speed, stateful session verification at the API Gateway level with automatic expiration.
- **Secure Microservice Propagation**: Gateway enforces authentication and injects verified user identity and internal service secrets (`x-internal-secret`) into downstream service calls, preventing direct unauthorized access.

### 🤖 Multi-Agent AI System (8 Specialized Agents)

Orchestrated via a centralized LangGraph state machine with intelligent intent classification:

#### Visible User-Selectable Agents:

- **Chat Agent**: Conversational general assistant powered by Groq and Google Gemini with Redis-cached short-term memory and MongoDB conversation persistence.
- **Search Agent**: Real-time web intelligence powered by the Tavily Search API, delivering synthesized answers complete with inline source citations and related imagery.
- **Coding Agent**: Generates production-ready HTML, CSS, and JavaScript solutions powered by Groq and OpenRouter (DeepSeek), rendered immediately in a live-preview Monaco Editor sandbox.
- **PDF Generation Agent**: Synthesizes structured, styled PDF documents and reports on demand using PDFKit.
- **Presentation (PPT) Agent**: Automatically designs and generates downloadable PowerPoint presentations (`.pptx`) using `pptxgenjs`.
- **Image Generation Agent**: High-resolution image synthesis using Pollinations.ai with automated prompt enhancement.

#### Hidden Auto-Routed Agents:

- **Image Analyzer Agent**: Triggered automatically when an image is uploaded; performs multi-modal scene analysis, text extraction (OCR), and visual comprehension via Google Gemini Vision.
- **PDF RAG Agent**: Triggered automatically upon document attachment; chunks text, generates vector embeddings, and performs similarity searches against Qdrant Vector DB to answer queries grounded strictly in document context.

### 💳 Credit & Billing Governance

- **Razorpay Payment Integration**: Integrated checkout for purchasing credit packs with webhook/signature verification.
- **Atomic Credit Deduction**: Balances are validated and atomically decremented per query before executing compute-heavy agent workflows.
- **Transaction History**: Audit logs for purchases and credit usage tracked in MongoDB.

### 📁 Document Handling & Vector RAG

- **Vector Embedding Pipeline**: Chunks uploaded documents and indexes embeddings in Qdrant for semantic search and retrieval-augmented generation.
- **Storage Layer (In Migration)**: Architecture designed for presigned URL asset delivery and isolated file processing (migrating from AWS S3 to Cloudflare R2 or Cloudinary).
- **Cascading Cleanup**: Complete conversation deletion cascades across MongoDB chat collections, Redis memory keys, and Qdrant vector points.

### 🎨 Frontend UX & Workspace

- **Interactive Split-Screen**: Dual-pane workspace featuring chat on the left and a live-preview code artifact panel (powered by Monaco Editor) on the right.
- **Theme Engine**: Seamless dark and light themes with automatic system preference detection.
- **Hands-Free Voice Input**: Speech-to-text integration using the native browser Web Speech API.
- **Fluid & Responsive Design**: Crafted with React, Redux Toolkit, and Tailwind CSS for mobile, tablet, and desktop layouts.

---

## 🛠️ Tech Stack

| Domain                              | Technologies                                                                                                                                                             |
| :---------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**                        | React (Vite), Redux Toolkit, Tailwind CSS, Monaco Editor, Lucide Icons, Web Speech API                                                                                   |
| **Backend Framework**               | Node.js, Express.js (Microservices Architecture)                                                                                                                         |
| **AI & Agent Orchestration**        | LangGraph, LangChain, Groq, Google Gemini (Flash & Vision), OpenRouter (DeepSeek), Tavily API, Pollinations.ai                                                           |
| **Vector Database**                 | Qdrant Cloud Vector DB                                                                                                                                                   |
| **Databases & Caching**             | MongoDB (Mongoose), Redis (ioredis)                                                                                                                                      |
| **Payments**                        | Razorpay Node SDK                                                                                                                                                        |
| **Object Storage** _(Migrating)_    | **In active transition**: Migrating off decommissioned AWS S3 to Cloudflare R2 or Cloudinary (evaluation in progress)                                                    |
| **DevOps & Containers**             | Docker (5 service Dockerfiles built with shared root context), Docker Compose                                                                                            |
| **Deployment Platform** _(Pending)_ | **Undecided / Under evaluation**: Prior AWS deployment (ECS, ECR, ElastiCache, NAT Gateway) fully decommissioned; alternative hosting platform currently being finalized |

---

## 🏗️ Architecture Overview

Nova AI employs an isolated microservices architecture fronted by a reverse-proxy API Gateway. Client requests undergo Redis session authentication at the gateway before being routed via secure internal headers to specialized downstream services.

```
                                    +-----------------------+
                                    |     React Frontend    |
                                    +-----------+-----------+
                                                |
                                                v
                                    +-----------------------+
                                    |      API Gateway      |
                                    |    (verifySession)    |
                                    +----+-----+-----+------+
                                         |     |     |
               +-------------------------+     |     +-------------------------+
               |                               |                               |
               v                               v                               v
    +--------------------+           +--------------------+          +--------------------+
    |    Auth Service    |           |    Chat Service    |          |   Billing Service  |
    |      (:8001)       |           |      (:8002)       |          |      (:8004)       |
    +----------+---------+           +----------+---------+          +----------+---------+
               |                                |                               |
               v                                v                               v
     [MongoDB / Firebase]              [MongoDB / Redis]               [MongoDB / Razorpay]
                                                |
                                                v
                                     +--------------------+
                                     |   Agent Service    |
                                     |      (:8003)       |
                                     +---------+----------+
                                               |
                                               v
                                 +----------------------------+
                                 |   LangGraph Router Node    |
                                 +--------------+-------------+
                                                |
         +------------------+-------------------+--------------------+------------------+
         |                  |                   |                    |                  |
         v                  v                   v                    v                  v
   [Chat Agent]       [Search Agent]      [Coding Agent]      [PDF/PPT Agents]   [Image Agent]
   (Groq/Gemini)         (Tavily)      (Groq / DeepSeek)     (PDFKit/pptxgenjs)  (Pollinations)
                                                |
                                                +--------------------+
                                                |                    |
                                                v                    v
                                        [Image Analyzer]       [PDF RAG Agent]
                                         (Gemini Vision)       (Qdrant Vector)
```

### Request Lifecycle

1. **Client Request**: Frontend issues API requests with HTTP-only credentials to the **API Gateway** (`:8000`).
2. **Session Verification**: Gateway executes `verifySession` against **Redis**, injecting sanitized user headers and an internal shared secret.
3. **Microservice Routing**:
   - `/api/auth` $\rightarrow$ **Auth Service** (`:8001`): Validates Firebase ID tokens, manages user profiles and session stores.
   - `/api/chat` $\rightarrow$ **Chat Service** (`:8002`): Manages thread persistence, conversation histories, and cascading thread deletions.
   - `/api/agent` $\rightarrow$ **Agent Service** (`:8003`): Runs LangGraph stateful graph execution, coordinating LLM invocations, tool execution, and vector search.
   - `/api/billing` $\rightarrow$ **Billing Service** (`:8004`): Handles Razorpay orders, payment signatures, and atomic credit balance updates.

---

## ⚙️ Getting Started / Local Setup

### Prerequisites

- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For local Redis and container builds
- **MongoDB**: Local MongoDB instance or MongoDB Atlas connection URI

### 1. Clone the Repository

```bash
git clone https://github.com/rohanPrajapati45/NOVA-Ai.git
cd NOVA-Ai
```

### 2. Environment Variables Configuration

Create a `.env` file in each respective directory based on the variable templates below (names only):

#### `backend/gateway/.env`

```env
PORT=8000
AUTH_SERVICE=http://localhost:8001
CHAT_SERVICE=http://localhost:8002
AGENT_SERVICE=http://localhost:8003
BILLING_SERVICE=http://localhost:8004
FRONTEND_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_session_secret_key
```

#### `backend/services/auth/.env`

```env
PORT=8001
MONGODB_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5173
SESSION_SECRET=your_session_secret_key
REDIS_URL=redis://localhost:6379
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
INTERNAL_SERVICE_SECRET=your_internal_service_secret
```

#### `backend/services/chat/.env`

```env
PORT=8002
MONGODB_URI=your_mongodb_connection_string

# Storage-related variables (subject to change during active storage migration)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name
```

#### `backend/services/agent/.env`

```env
PORT=8003
REDIS_URL=redis://localhost:6379
INTERNAL_SERVICE_SECRET=your_internal_service_secret
AUTH_SERVICE_URL=http://localhost:8001
CHAT_SERVICE_URL=http://localhost:8002

# AI Model & Search Providers
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_key
TAVILY_API_KEY=your_tavily_api_key
POLLINATIONS_API_KEY=your_pollinations_key

# Vector Database (PDF RAG)
QDRANT_ENDPOINT=your_qdrant_endpoint
QDRANT_API_KEY=your_qdrant_api_key

# Storage-related variables (subject to change during active storage migration)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name
```

#### `backend/services/billing/.env`

```env
PORT=8004
MONGODB_URI=your_mongodb_connection_string
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
AUTH_SERVICE_URL=http://localhost:8001
INTERNAL_SERVICE_SECRET=your_internal_service_secret
```

#### `frontend/.env`

```env
VITE_SERVER_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

> **Note on Storage Configuration:** The `AWS_*` variables referenced above reflect the original S3 configuration and are actively subject to change as the storage adapter migration to Cloudflare R2 or Cloudinary is finalized.

---

### 3. Running the Project Locally

#### Option A: Running Services Manually

1. **Spin up Redis** via Docker Compose:

   ```bash
   cd backend
   docker-compose up -d redis
   ```

2. **Start Backend Microservices** (run `npm install` and `npm run dev` in separate terminals):

   ```bash
   # Terminal 1: API Gateway
   cd backend/gateway && npm install && npm run dev

   # Terminal 2: Auth Service
   cd backend/services/auth && npm install && npm run dev

   # Terminal 3: Chat Service
   cd backend/services/chat && npm install && npm run dev

   # Terminal 4: Agent Service
   cd backend/services/agent && npm install && npm run dev

   # Terminal 5: Billing Service
   cd backend/services/billing && npm install && npm run dev
   ```

3. **Start Frontend Client**:
   ```bash
   # Terminal 6: Frontend App
   cd frontend && npm install && npm run dev
   ```

#### Option B: Building Docker Containers

Each service includes a dedicated `Dockerfile`. Because services share common utilities (`backend/shared/`), Docker images must be built from the root `backend/` directory context:

```bash
cd backend

# Build Docker images using backend root context
docker build -t nova-gateway -f gateway/Dockerfile .
docker build -t nova-auth -f services/auth/Dockerfile .
docker build -t nova-chat -f services/chat/Dockerfile .
docker build -t nova-agent -f services/agent/Dockerfile .
docker build -t nova-billing -f services/billing/Dockerfile .
```

---

## 📈 Project Status & Roadmap

The development of Nova AI spans ~33 structured implementation phases, delivering a fully operational local microservices system.

### ✅ Completed Milestones

- **Microservices Core**: API Gateway with secure reverse-proxying, session validation, and internal service secret authentication.
- **Authentication System**: Google Sign-In via Firebase Auth with Redis-backed 7-day session lifetimes.
- **LangGraph Multi-Agent Architecture**: Intelligent router coordinating 6 user-facing agents (Chat, Tavily Web Search, Monaco Coding, PDFKit, pptxgenjs, Pollinations.ai Image Generation).
- **Multimodal & RAG Capabilities**: Automated attachment detection routing to Gemini Vision (Image Analyzer) and Qdrant vector retrieval (PDF RAG).
- **Billing Engine**: Razorpay checkout integration with atomic credit verification and usage accounting.
- **Frontend Workspace**: Split-screen desktop experience with Monaco Code Editor live preview, voice-to-text input via Web Speech API, dark/light theme switching with OS detection, and cascading thread deletion.
- **Containerization**: Standalone Dockerfiles for all 5 backend microservices with shared-root dependency resolution.

### 🚧 In Progress

- **Storage Layer Migration**: Replacing decommissioned AWS S3 with an alternative object storage solution (Cloudflare R2 or Cloudinary — adapter selection in progress).
- **Cloud Redeployment**: Finalizing hosting platform selection and deployment configuration for backend microservices and frontend client following the teardown of the initial AWS environment.

---

## 📁 Project Structure

```
nova-ai/
├── backend/
│   ├── gateway/                 # API Gateway & verifySession middleware
│   ├── services/
│   │   ├── agent/               # LangGraph multi-agent engine & tool definitions
│   │   ├── auth/                # Firebase Auth & user profile handlers
│   │   ├── billing/             # Razorpay integration & credit manager
│   │   └── chat/                # Conversation persistence & history management
│   ├── shared/
│   │   ├── redis/               # Shared Redis client connection module
│   │   └── s3/                  # Shared storage helper (active migration target)
│   ├── docker-compose.yml       # Local Redis container configuration
│   └── package.json             # Root backend dependencies for Docker builds
├── frontend/
│   ├── src/
│   │   ├── components/          # UI components (Artifacts, Monaco Editor, Chat)
│   │   ├── services/            # API client integration modules
│   │   ├── store/               # Redux Toolkit state slices
│   │   └── App.jsx              # Main dashboard view
│   └── package.json
└── README.md
```

---

## 💡 Development Approach

Nova AI was developed using an iterative, prompt-driven engineering methodology paired with an AI coding assistant. The project progressed across **~33 sequential, well-scoped development phases** — starting with foundational gateway routing and session infrastructure, progressing through isolated microservice implementations, multi-agent state machines, and vector RAG pipelines, and culminating in full containerization and cloud migration planning. This approach highlights deliberate system design, modular code organization, and disciplined architectural iteration.

---

## 👤 Author & Contact

- **Author**: Rohan Prajapati
- **GitHub**: [@rohanPrajapati45](https://github.com/rohanPrajapati45)
- **LinkedIn**: [Rohan Prajapati](https://www.linkedin.com/in/rohanprajapati45/)

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
