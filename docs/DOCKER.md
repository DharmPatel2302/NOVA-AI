# Technology 2 — Docker & Containerization
# Marks: 4/20

---

## What Is Docker?

When you run code on your laptop it works — but when someone else runs it, it breaks. Wrong Node version, missing environment variable, different OS. Docker solves this by packaging your application with everything it needs (runtime, dependencies, config) into a single portable unit called a **container**.

A container is like a sealed box. Inside the box: your code, Node 20, all npm packages, and startup instructions. The box runs identically on your Windows laptop, a Linux EC2 server, or any colleague's Mac.

---

## How NOVA AI Uses Docker

### 5 Dockerfiles — One Per Service

Every service has its own `Dockerfile` that defines exactly how to build and run it:

```
backend/
├── gateway/Dockerfile
├── services/auth/Dockerfile
├── services/chat/Dockerfile
├── services/agent/Dockerfile
└── services/billing/Dockerfile
```

### The Shared Context Problem (And How We Solved It)

All services share common code in `backend/shared/` (Redis client, Cloudinary utils). In a normal setup you'd build each Dockerfile from inside the service folder — but then the `shared/` directory would be outside the Docker build context and unavailable.

**Our solution:** All Dockerfiles are built from the `backend/` root as the build context. This lets every service copy `shared/` into its container.

**Every Dockerfile follows this pattern:**
```dockerfile
FROM node:20-alpine                    # Lightweight Linux with Node 20

WORKDIR /app

# Step 1: Install ROOT dependencies (needed by shared/)
COPY package*.json ./
RUN npm ci --omit=dev

# Step 2: Install THIS service's dependencies
COPY services/auth/package*.json ./services/auth/
WORKDIR /app/services/auth
RUN npm ci --omit=dev

# Step 3: Copy source code + shared modules
WORKDIR /app
COPY services/auth/ ./services/auth/
COPY shared/ ./shared/          ← This is why we build from root

# Step 4: Start the service
WORKDIR /app/services/auth
EXPOSE 8001
CMD ["node", "index.js"]
```

**Why `node:20-alpine` and not `node:20`?**
Alpine Linux is a minimal Linux distro (~5MB vs ~900MB). The resulting Docker image is much smaller, faster to pull, and has a smaller attack surface.

**Why `npm ci` instead of `npm install`?**
`npm ci` installs exactly the versions in `package-lock.json` — deterministic, reproducible, no surprise updates.

**Why `--omit=dev`?**
Development tools (ESLint, Jest, etc.) are not needed at runtime. Excluding them keeps images smaller and more secure.

---

## docker-compose.yml — Orchestrating All 6 Containers

`docker-compose.yml` defines all 6 containers and how they work together as a system.

**Location:** `backend/docker-compose.yml`

### 6 Containers

| Container Name | Image | Port | Role |
|---|---|---|---|
| `multiagent-redis` | `redis:7-alpine` | 6379 | Session store, LangGraph memory |
| `nova-auth-service` | Built from auth/Dockerfile | 8001 | Firebase auth + MongoDB |
| `nova-chat-service` | Built from chat/Dockerfile | 8002 | Conversation storage |
| `nova-agent-service` | Built from agent/Dockerfile | 8003 | LangGraph + 8 AI agents |
| `nova-billing-service` | Built from billing/Dockerfile | 8004 | Razorpay payments |
| `nova-gateway` | Built from gateway/Dockerfile | 8000 | Single entry point |

### Health Checks — Smart Startup Order

Every service has a health check. Docker waits for a service to be healthy before starting services that depend on it:

```yaml
auth-service:
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8001/health"]
    interval: 15s
    timeout: 5s
    retries: 5
    start_period: 20s

gateway:
  depends_on:
    redis:
      condition: service_healthy      # Redis must be ready
    auth-service:
      condition: service_healthy      # Auth must be ready
    chat-service:
      condition: service_healthy      # Chat must be ready
    agent-service:
      condition: service_started      # Agent just needs to have started
    billing-service:
      condition: service_healthy      # Billing must be ready
```

**Why this matters:** Without health checks, the gateway might start before Redis is ready, causing connection errors. Health checks ensure startup order is correct every time.

### Internal Docker Network

Containers talk to each other using container names — not localhost or IP addresses:

```yaml
environment:
  - AUTH_SERVICE=http://auth-service:8001    # Container name, not localhost
  - CHAT_SERVICE=http://chat-service:8002
  - AGENT_SERVICE=http://agent-service:8003
```

Docker creates an internal network. `auth-service` resolves to the auth container's internal IP automatically. External traffic cannot reach these internal URLs.

### Persistent Volume for Redis

```yaml
volumes:
  redis-data:

redis:
  volumes:
    - redis-data:/data
```

Redis data survives container restarts. Without this, every `docker compose down` would wipe all sessions and memory.

---

## Makefile — One Command Operations

`Makefile` at the project root provides shortcuts so you never need to remember long docker compose commands:

```bash
make up          # docker compose up -d (start everything in background)
make down        # docker compose down (stop everything)
make restart     # down + up --build (rebuild and restart)
make build       # docker compose build (rebuild images only)
make logs        # docker compose logs -f (live logs from all services)
make ps          # docker compose ps (show running containers)
make clean       # remove containers + volumes + images

# Per-service logs
make logs-gateway
make logs-auth
make logs-chat
make logs-agent
make logs-billing
```

---

## .dockerignore — What NOT to Copy Into Containers

`backend/.dockerignore` prevents unnecessary files from entering the build context — making builds faster and images smaller:

```
node_modules/      # Never copy local node_modules — install fresh inside container
.env               # Never copy secrets into images
.git/              # Git history not needed at runtime
*.log              # Log files not needed
```

Without `.dockerignore`, a `COPY . .` instruction would copy your `node_modules` (hundreds of MB) into the container, overriding the fresh install.

---

## Why Docker for NOVA AI Specifically

### Problem 1: 5 Different Services, 5 Different Dependency Trees
Without Docker, you'd need to manually install and manage npm packages for 5 services on every machine. One `npm install` in the wrong directory breaks everything. With Docker, each service has its packages baked into its image — isolated, reproducible.

### Problem 2: Node Version Consistency
Agent service uses LangGraph which requires Node 20+. If a developer has Node 18, it fails. `FROM node:20-alpine` guarantees every container always uses Node 20, everywhere.

### Problem 3: Redis, MongoDB, External Services
Local development needs Redis running. Docker Compose starts Redis as a container alongside the services — no manual installation, no version conflicts.

### Problem 4: EC2 Deployment
The `user_data.sh` script on EC2 installs Docker and runs `docker compose up --build`. One command deploys all 6 services to the cloud server. No manual SSH configuration, no "it works on my machine" problems.

---

## Container Isolation — What It Means in Practice

Each container has:
- Its own filesystem (changes inside don't affect the host)
- Its own network namespace (containers can't see each other unless Docker links them)
- Its own process space (container processes are isolated from host processes)
- Its own environment variables (each service only sees its own `.env`)

This means the agent service's `GROQ_API_KEY` is not visible to the billing service, even though they run on the same machine.

---

## What to Demonstrate to Faculty

### Demo 1 — One Command Startup
```bash
cd backend
docker compose up --build
```
Show all 6 containers building and starting from scratch. Point out the dependency order — Redis starts first, then auth, chat, billing, then agent, then gateway last.

### Demo 2 — Show a Dockerfile
Open `backend/services/agent/Dockerfile`. Walk through each instruction:
- `FROM node:20-alpine` → base image (Alpine = minimal Linux)
- `WORKDIR /app` → working directory inside the container
- `COPY package*.json ./` → copy just package files first (layer caching)
- `RUN npm ci --omit=dev` → install dependencies (this layer is cached if packages haven't changed)
- `COPY services/agent/ ./services/agent/` → copy actual code
- `COPY shared/ ./shared/` → copy shared Redis/Cloudinary modules
- `CMD ["node", "index.js"]` → start command

### Demo 3 — Show docker-compose.yml
Point out:
- `context: .` → why we build from root (shared/ directory access)
- `depends_on` with `condition: service_healthy` → smart startup ordering
- `env_file` → secrets loaded from `.env` files (not baked into image)
- `restart: unless-stopped` → containers auto-restart on crash

### Demo 4 — Container Isolation
```bash
docker compose exec agent-service sh
# You are now inside the agent container
ls /app
cat /app/services/agent/package.json
exit
```
Show the isolated filesystem inside the container.

### Demo 5 — Show Makefile
```bash
make ps          # Shows all 6 running containers with ports and status
make logs-agent  # Tail live logs just from agent service
make down        # Stop everything with one command
make up          # Restart everything with one command
```

### Demo 6 — Fault Isolation + Auto-Restart
```bash
# Simulate a crash by killing the agent container
docker compose kill agent-service

make ps   # Shows agent-service as "exited"

# Docker auto-restarts it (restart: unless-stopped policy)
# Wait 5 seconds and check again
make ps   # Shows agent-service running again
```

### What to Say at Viva
*"Without Docker, every developer and every server needs to manually install the right version of Node, set up Redis, configure environment variables, and install npm packages for 5 different services. With Docker, each service is packaged with everything it needs — the runtime, dependencies, and startup command. One `docker compose up` command starts all 6 containers in the correct order with health checks. The same command that works on my Windows laptop works identically on the AWS EC2 server in Mumbai. That's the power of containerization — eliminate the 'it works on my machine' problem completely."*
