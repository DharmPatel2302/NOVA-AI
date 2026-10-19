# NOVA AI — Faculty Presentation Report

**Student:** Dharm Patel (23BCE224) & Rohan Prajapati (23BCE263)  
**Assignment:** Production-Grade Multi-Agent AI Platform  
**Total Marks:** 20

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology 1 — Microservices (3 Marks)](#3-technology-1--microservices-3-marks)
4. [Technology 2 — Docker (4 Marks)](#4-technology-2--docker-4-marks)
5. [Technology 3 — Infrastructure as Code / Terraform (2 Marks)](#5-technology-3--infrastructure-as-code--terraform-2-marks)
6. [Technology 4 — Kubernetes (2 Marks)](#6-technology-4--kubernetes-2-marks)
7. [Technology 5 — CI/CD Pipeline (3 Marks)](#7-technology-5--cicd-pipeline-3-marks)
8. [Technology 6 — DevSecOps (2 Marks)](#8-technology-6--devsecops-2-marks)
9. [Technology 7 — Cloud Provider / AWS (2 Marks)](#9-technology-7--cloud-provider--aws-2-marks)
10. [Technology 8 — Publicly Accessible Link (2 Marks)](#10-technology-8--publicly-accessible-link-2-marks)
11. [What to Demonstrate — Quick Reference](#11-what-to-demonstrate--quick-reference)

---

## 1. Project Overview

**NOVA AI** is a full-stack, production-grade AI chatbot platform built on a microservices architecture. It is not a simple chatbot — it is a multi-agent AI workspace where 8 specialized AI agents collaborate under a central orchestrator to handle any type of user request: general conversation, live web search, interactive coding, document analysis, image generation, PDF synthesis, and presentation creation.

### What the Application Does

A user opens the web app, signs in with Google, and types a message. Based on what they ask, the system automatically routes the request to the correct AI specialist:

- Ask a general question → **Chat Agent** (Google Gemini / Groq)
- Ask for news or live data → **Search Agent** (Tavily Web Search API)
- Ask for code → **Coding Agent** (Groq + DeepSeek via OpenRouter, rendered in Monaco Editor)
- Ask for a report or document → **PDF Agent** (PDFKit — generates a downloadable PDF)
- Ask for a presentation → **PPT Agent** (pptxgenjs — generates a downloadable `.pptx`)
- Ask to create an image → **Image Agent** (Pollinations.ai)
- Upload an image → **Image Analyzer Agent** auto-triggers (Google Gemini Vision)
- Upload a PDF document → **PDF RAG Agent** auto-triggers (Qdrant Vector Search + Gemini)

Every action costs credits. The user can buy credits through **Razorpay** payment integration.

### Technology Summary

| Domain | Stack |
|---|---|
| Frontend | React (Vite), Redux Toolkit, Tailwind CSS, Monaco Editor |
| Backend | Node.js, Express.js — 5 independent microservices |
| AI & Orchestration | LangGraph, LangChain, Groq, Google Gemini, OpenRouter (DeepSeek), Tavily, Pollinations.ai |
| Databases | MongoDB (Mongoose), Redis (ioredis) |
| Vector Database | Qdrant Cloud |
| Payments | Razorpay Node SDK |
| Authentication | Firebase Google OAuth |
| Containerization | Docker, Docker Compose |
| Infrastructure | Terraform (AWS EC2, S3, ASG, CloudWatch) |
| Orchestration | Kubernetes (K8s) with HPA |
| CI/CD | GitHub Actions |
| Security | Trivy, GitLeaks, npm audit, httpOnly cookies, timingSafeEqual |

---

## 2. System Architecture

### High-Level Architecture

```
                          ┌─────────────────────────┐
                          │     React Frontend       │
                          │  (Vite + Redux + Tailwind)│
                          └────────────┬────────────┘
                                       │  HTTPS / Cookies
                                       ▼
                          ┌─────────────────────────┐
                          │      API Gateway         │
                          │       (Port 8000)        │
                          │  ┌───────────────────┐   │
                          │  │  verifySession()  │   │  ← Redis session check
                          │  └───────────────────┘   │
                          └──┬──────┬────────┬───────┘
                             │      │        │
               ┌─────────────┘      │        └──────────────┐
               ▼                    ▼                        ▼
   ┌──────────────────┐  ┌──────────────────┐   ┌──────────────────┐
   │   Auth Service   │  │   Chat Service   │   │ Billing Service  │
   │   (Port 8001)    │  │   (Port 8002)    │   │   (Port 8004)    │
   │  Firebase Auth   │  │  Conversation    │   │   Razorpay +     │
   │  User Profiles   │  │  History +       │   │  Credit Manager  │
   │  Credit Balance  │  │  Thread Mgmt     │   │                  │
   └────────┬─────────┘  └────────┬─────────┘   └────────┬─────────┘
            │                     │                       │
            ▼                     ▼                       ▼
       [MongoDB]              [MongoDB]               [MongoDB]
       [Redis]                [Redis]                [Razorpay]
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │      Agent Service       │
                  │       (Port 8003)        │
                  │  ┌────────────────────┐  │
                  │  │  LangGraph Router  │  │
                  │  └────────┬───────────┘  │
                  └───────────┼──────────────┘
                              │
       ┌──────────┬───────────┼────────────┬───────────┐
       ▼          ▼           ▼            ▼           ▼
  [Chat Agent] [Search]  [Coding]  [PDF / PPT]  [Image Gen]
  Groq/Gemini  Tavily   Groq+Deep  PDFKit /    Pollinations
                         Seek      pptxgenjs       .ai
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
            [Image Analyzer]      [PDF RAG Agent]
            Gemini Vision         Qdrant Vector DB
           (auto-triggered)      (auto-triggered)
```

### Request Lifecycle (Step by Step)

1. **Frontend** sends request with HTTP-only session cookie to the **API Gateway** on port 8000.
2. **Gateway** calls `verifySession()` — checks the session ID against **Redis**. If invalid, returns 401.
3. If valid, Gateway injects `x-user-id` and `x-internal-secret` headers and proxies the request to the correct microservice.
4. **Agent Service** receives the request, loads chat history from MongoDB, and runs the **LangGraph graph**.
5. **Router Node** (LLM-powered) classifies the intent and selects one of 8 agents.
6. **Credit Check Node** validates and deducts credits atomically from MongoDB.
7. The **selected agent** runs — calls LLMs, searches the web, generates files, etc.
8. Response is saved back to **MongoDB** via the Chat Service and returned to the frontend.

### Why This Architecture?

Each service is independently deployable. If the Agent Service crashes during a complex AI operation, the Auth Service, Chat Service, and Billing Service continue working normally. Users can still log in, view their history, and check their balance — they just cannot run new AI queries until the agent is back.

---

## 3. Technology 1 — Microservices (3 Marks)

### What Is It?

Microservices means splitting one large server application into small, independent services. Each service does one specific job, runs as its own process, has its own database models, and communicates with other services over HTTP.

The alternative is a **monolith** — one giant server that handles everything. In a monolith, if one feature breaks, the whole application goes down. In microservices, failures are isolated.

### What I Built

NOVA AI has **5 independent backend services**:

| Service | Port | Responsibility | Database |
|---|---|---|---|
| API Gateway | 8000 | Entry point, session auth, reverse proxy | Redis |
| Auth Service | 8001 | Firebase login, user profiles, credit balance | MongoDB + Firebase |
| Chat Service | 8002 | Conversation creation, message history, thread deletion | MongoDB |
| Agent Service | 8003 | LangGraph orchestration, all 8 AI agents, file processing | Redis + Qdrant |
| Billing Service | 8004 | Razorpay orders, payment verification, credit top-ups | MongoDB + Razorpay |

### How They Communicate

Services communicate over HTTP using a shared **internal service secret**. When the Gateway forwards a request, it adds two headers:

```
x-user-id: "user_abc123"              ← verified user identity
x-internal-secret: "your_secret"     ← proves the request came from Gateway, not the internet
```

Every internal service endpoint checks for `x-internal-secret` before processing. A request coming directly to port 8001 from the internet without this header is rejected with 401. This prevents external attackers from bypassing the Gateway.

### Key Design Decisions

**Session verification at Gateway, not at each service.** The Gateway is the only entry point for all external traffic. It verifies the Redis session once and injects the user ID. Downstream services trust the injected header. This means:
- Authentication logic lives in one place
- Adding a new service doesn't require re-implementing auth
- A compromised service cannot forge a different user's identity (the Gateway controls the header)

**Each service has its own `package.json` and `Dockerfile`.** They share no code except a common Redis client module (`backend/shared/redis/`). This means:
- Auth can be upgraded to a new Firebase SDK without touching the Agent service
- Agent can add new AI libraries (LangChain, Qdrant) without bloating Auth's Docker image
- Each service can be scaled independently (2 Agent replicas, 1 Auth replica)

### What to Show Faculty

```bash
# Show all 5 services + Redis running
docker compose ps

# Show they are independent — stop one service, others keep working
docker compose stop agent-service
# Frontend still loads, auth still works, billing still works

docker compose start agent-service
# Agent comes back — other services never restarted

# Show inter-service communication in logs
docker compose logs -f gateway agent-service chat-service
# Send a message → see logs flowing gateway → agent → chat
```

Open the `backend/` folder and show each service has:
- Its own `package.json` (independent Node.js application)
- Its own `Dockerfile` (independent container image)
- Its own `index.js` (independent Express server)
- Its own database models

**Viva point:** "If the Image Agent crashes at 3am, users can still chat, search, and make payments. That is the core benefit of microservices — fault isolation."

---

## 4. Technology 2 — Docker (4 Marks)

### What Is It?

Docker packages an application and all its dependencies (Node.js version, npm packages, OS tools) into a **container** — a self-contained unit that runs identically on any machine. No more "it works on my laptop but not on the server."

### What I Built

**5 Dockerfiles — one per service:**

```
backend/
├── gateway/Dockerfile
├── services/auth/Dockerfile
├── services/chat/Dockerfile
├── services/agent/Dockerfile
└── services/billing/Dockerfile
```

**Each Dockerfile follows this pattern:**

```dockerfile
FROM node:20-alpine           # Minimal Alpine Linux base — ~5MB vs ~900MB full Ubuntu

WORKDIR /app

# Copy only what's needed (not the entire repo)
COPY package*.json ./
COPY services/auth/ ./services/auth/
COPY shared/ ./shared/         # Shared Redis client module

# Install only production dependencies — no test tools in the image
RUN npm ci --omit=dev

WORKDIR /app/services/auth
CMD ["node", "index.js"]
```

**Why `node:20-alpine` instead of `node:20`?**
Alpine Linux is a minimal OS — the image is ~50MB instead of ~950MB. Smaller images = faster CI/CD builds, faster deployments, and a smaller attack surface for security vulnerabilities.

**The Shared Build Context Problem (and How It's Solved):**

Services share `backend/shared/` (Redis client). If you tried to build from inside `services/auth/`, the COPY for `shared/` would fail — it's outside that directory. All Dockerfiles are built from the `backend/` root directory:

```bash
cd backend
docker build -t nova-auth -f services/auth/Dockerfile .
#                                                      ^ context is backend/, not services/auth/
```

The `docker-compose.yml` sets `context: .` (root of backend/) for all services, so this works automatically.

**`docker-compose.yml` — Orchestrating All 6 Containers:**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  gateway:
    build:
      context: .
      dockerfile: gateway/Dockerfile
    ports: ["8000:8000"]
    depends_on: [redis]
    env_file: ./gateway/.env
    restart: unless-stopped

  auth-service:
    build:
      context: .
      dockerfile: services/auth/Dockerfile
    ports: ["8001:8001"]
    depends_on: [redis]
    env_file: ./services/auth/.env
    restart: unless-stopped
  # ... same pattern for chat, agent, billing
```

`depends_on: [redis]` ensures Redis starts before services that need it.  
`restart: unless-stopped` auto-restarts any container that crashes.

**Makefile Shortcuts:**

```bash
make up           # docker compose up -d
make down         # docker compose down
make build        # docker compose build
make logs         # docker compose logs -f
make ps           # docker compose ps
make restart      # down + up --build (full rebuild)
make logs-agent   # logs for agent service only
```

### What to Show Faculty

```bash
# One command starts everything
cd backend
docker compose up --build

# Show all containers
docker compose ps
# NAME                   STATUS         PORTS
# nova-gateway           Up (healthy)   0.0.0.0:8000->8000/tcp
# nova-auth-service      Up (healthy)   0.0.0.0:8001->8001/tcp
# nova-chat-service      Up (healthy)   0.0.0.0:8002->8002/tcp
# nova-agent-service     Up (healthy)   0.0.0.0:8003->8003/tcp
# nova-billing-service   Up (healthy)   0.0.0.0:8004->8004/tcp
# multiagent-redis       Up (healthy)   0.0.0.0:6379->6379/tcp

# Enter a running container and explore it
docker compose exec agent-service sh
ls         # isolated filesystem
node --version   # Node 20 inside the container
exit

# Show shared context build
# Open backend/docker-compose.yml → point at "context: ."
# Open backend/services/auth/Dockerfile → point at "COPY shared/ ./shared/"
# Explain: if we built from auth/ folder, this COPY would fail
```

Open any `Dockerfile` and explain each line:
- `FROM node:20-alpine` → base image
- `WORKDIR /app` → working directory inside container
- `COPY package*.json ./` → only manifest first (Docker layer caching)
- `RUN npm ci --omit=dev` → install inside container, not on host
- `CMD ["node", "index.js"]` → startup command

**Viva point:** "Without Docker, every developer needs to install the correct Node.js version, set up Redis, configure environment variables, and make sure all system dependencies match. With Docker, one command gives everyone an identical, working environment regardless of what OS they use."

---

## 5. Technology 3 — Infrastructure as Code / Terraform (2 Marks)

### What Is It?

Infrastructure as Code means writing files that **create cloud infrastructure automatically** instead of clicking through the AWS Console. Terraform reads `.tf` files and provisions the exact resources every time — reproducibly, version-controlled in Git.

Without IaC: 15+ manual steps in AWS Console. Error-prone. Takes 30 minutes. Cannot be repeated exactly.  
With Terraform: one command — `terraform apply` — provisions everything in ~3 minutes, identically, every time.

### What I Built

Running `terraform apply` creates **14 AWS resources** in Mumbai (ap-south-1):

```
terraform/
├── main.tf         → AWS provider declaration + region
├── variables.tf    → Configurable inputs (region, AMI, instance type)
├── outputs.tf      → Prints EC2 IP, SSH command, and URLs after apply
├── ec2.tf          → Security Group + EC2 instance + Elastic IP
├── s3.tf           → S3 bucket + static website hosting
├── asg.tf          → Auto Scaling Group + CloudWatch alarms
└── user_data.sh    → Boot script: auto-installs Docker and starts the app
```

**What Terraform Creates:**

| Resource | Name | Purpose |
|---|---|---|
| EC2 t3.micro | `nova-ai-server` | Runs all 6 Docker containers |
| Elastic IP | `65.2.232.188` | Fixed public IP (never changes on restart) |
| Security Group | `nova-ai-sg` | Firewall — allows ports 22, 80, 8000-8004 only |
| S3 Bucket | `nova-ai-frontend-19d45e08` | Frontend static website hosting |
| Launch Template | `nova-ai-lt-xxx` | Blueprint for ASG-created EC2s |
| Auto Scaling Group | `nova-ai-asg` | Min: 1, Max: 2 instances |
| CloudWatch Alarm | `nova-ai-cpu-high` | CPU > 70% for 2 min → trigger scale-out |
| CloudWatch Alarm | `nova-ai-cpu-low` | CPU < 30% for 10 min → trigger scale-in |

**The `user_data.sh` Boot Script (self-configuring server):**

This script runs automatically on EC2's first boot — zero manual SSH required:

```bash
#!/bin/bash
apt-get update -y
# Install Docker from official repo
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | ...
apt-get install -y docker-ce docker-compose-plugin

# Clone repo
git clone https://github.com/DharmPatel2302/NOVA-AI.git /home/ubuntu/nova-ai

# Start all 6 Docker containers
cd /home/ubuntu/nova-ai/backend
docker compose up -d --build
```

A fresh Ubuntu EC2 goes from bare OS to running 6 containers with the full NOVA AI stack — automatically, without anyone touching it.

**Terraform Commands:**

```bash
terraform init      # Download AWS provider plugin (one time)
terraform fmt       # Auto-format .tf files
terraform validate  # Check syntax before touching AWS
terraform plan      # Preview: show exactly what will be created (no actual changes)
terraform apply     # Create everything on AWS
terraform destroy   # Tear everything down
terraform output    # Print EC2 IP and URLs
```

**The golden rule:** Always `terraform plan` before `terraform apply` — see exactly what changes with zero risk.

### What to Show Faculty

**Show `terraform plan` output:** Point out the list of resources with `+` (will be created), `~` (will be updated), `-` (will be destroyed). Emphasize: "Nothing has been touched yet — this is only a preview."

**Open `ec2.tf`:** Walk through each ingress rule on the security group:
- Port 22: SSH access for manual debugging and CI/CD deployment
- Port 80: Nginx serving the React frontend
- Port 8000: API Gateway — single entry point
- Port 8001-8004: Individual microservices (debugging)

**Open `user_data.sh`:** Explain: "This script runs automatically on EC2 boot — installs Docker, clones our GitHub repo, and runs `docker compose up`. The entire application auto-starts without any manual SSH."

**Show `asg.tf`:** Point at:

```hcl
resource "aws_autoscaling_group" "nova_ai_asg" {
  min_size         = 1    # Always at least 1 running
  max_size         = 2    # Never more than 2 (free tier safe)
  desired_capacity = 1
}

resource "aws_cloudwatch_metric_alarm" "cpu_high" {
  threshold          = 70    # CPU > 70%
  evaluation_periods = 2     # for 2 consecutive minutes
  alarm_actions      = [aws_autoscaling_policy.scale_out.arn]
}
```

**Show `.gitignore`:** Demonstrate that `terraform.tfvars` and `*.pem` are never committed — AWS credentials and SSH keys are protected.

**Viva point:** "If our EC2 server crashes at 3am, we don't need to manually recreate anything. One command — `terraform apply` — recreates the exact same server with identical configuration in 3 minutes. That is what Infrastructure as Code means."

---

## 6. Technology 4 — Kubernetes (2 Marks)

### What Is It?

Docker Compose runs containers on **one machine**. If that machine crashes, everything stops. If traffic spikes, you cannot add more containers automatically. If a container crashes, it stays down until someone manually restarts it.

Kubernetes (K8s) is a **container orchestration system** that manages containers automatically:
- **Self-healing**: detects crashed pods and restarts them in ~10 seconds, automatically
- **Autoscaling (HPA)**: adds more pods when CPU is high, removes them when traffic drops
- **Load balancing**: distributes traffic evenly across pod replicas
- **Secret management**: API keys stored securely, never in plain text files
- **Resource limits**: prevents one service from consuming all CPU/memory and crashing others

### What I Built

**Cluster:** Docker Desktop Kubernetes (local) with K3s on EC2 (cloud)  
**Namespace:** `nova-ai` — all resources isolated here

```
k8s/
├── namespace.yaml   → Isolates all NOVA AI K8s resources
├── configmap.yaml   → Non-sensitive env vars (service URLs, ports)
├── secrets.yaml     → API keys (Groq, Gemini, MongoDB URI, etc.) — base64 encoded
├── redis.yaml       → Redis StatefulSet + PersistentVolumeClaim
├── auth.yaml        → Auth Deployment + ClusterIP Service
├── chat.yaml        → Chat Deployment + ClusterIP Service
├── agent.yaml       → Agent Deployment + ClusterIP Service
├── billing.yaml     → Billing Deployment + ClusterIP Service
├── gateway.yaml     → Gateway Deployment + NodePort Service (port 30000)
├── ingress.yaml     → Nginx Ingress routing all traffic to gateway
└── hpa.yaml         → HPA for agent (1-5 pods), gateway (1-3), chat (1-3)
```

**Verified Live State:**

```
NAME                               READY   STATUS    RESTARTS
agent-service-c88698894-gs68w      1/1     Running   0
auth-service-7b4b49f565-jk95g      1/1     Running   0
billing-service-7c8846c5d7-9m47k   1/1     Running   0
chat-service-df7cc6c77-gfjws       1/1     Running   0
gateway-8dd87fb7d-f69t4            1/1     Running   0
redis-0                            1/1     Running   0

NAME          TARGETS       MINPODS   MAXPODS   REPLICAS
agent-hpa     cpu: 0%/70%   1         5         1
chat-hpa      cpu: 4%/70%   1         3         1
gateway-hpa   cpu: 2%/70%   1         3         1
```

### Key Kubernetes Objects Explained

**Deployment** — maintains desired replica count. If a pod crashes, K8s creates a replacement:

```yaml
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: agent-service
          resources:
            requests: { memory: "256Mi", cpu: "250m" }
            limits:   { memory: "512Mi", cpu: "500m" }
          livenessProbe:   # "Is it alive? Restart if not."
            httpGet: { path: /health, port: 8003 }
          readinessProbe:  # "Is it ready for traffic?"
            httpGet: { path: /health, port: 8003 }
```

**Service** — gives each pod a stable DNS name. Pod IPs change on restart; Service DNS never changes. Inside the cluster, `http://auth-service:8001` always resolves to the healthy auth pod.

**Secret** — stores API keys securely:

```yaml
kind: Secret
data:
  GROQ_API_KEY: Z3NrX1I0N21uTTZ6SmZm...    # base64 encoded
  MONGODB_URI: bW9uZ29kYitzcnY6Ly8...       # base64 encoded
```

`kubectl describe secret nova-ai-secrets` shows key names and sizes but never the values.

**HPA — Horizontal Pod Autoscaler** — the most powerful feature:

```yaml
spec:
  scaleTargetRef:
    name: agent-service
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          averageUtilization: 70   # Scale up when avg CPU > 70%
```

The math:
```
currentReplicas = 1, currentCPU = 140%, targetCPU = 70%
desiredReplicas = ceil(1 × 140/70) = ceil(2.0) = 2 pods → K8s adds 1 pod automatically
```

**Why agent gets more resources than others:**

| Service | Memory Limit | CPU Limit | Reason |
|---|---|---|---|
| Gateway | 256Mi | 200m | HTTP proxy only |
| Auth | 256Mi | 200m | Simple CRUD |
| Chat | 256Mi | 200m | Simple CRUD |
| Billing | 256Mi | 200m | Payment processing |
| **Agent** | **512Mi** | **500m** | LLM inference + vector search + file processing |
| Redis | 128Mi | 100m | In-memory cache |

### What to Show Faculty

**Demo 1 — Show all pods:**
```bash
kubectl get pods -n nova-ai
kubectl get all -n nova-ai
```

**Demo 2 — Self-Healing (most impressive — 2 minutes):**
```bash
# Kill the agent pod — simulates a crash
kubectl delete pod -l app=agent-service -n nova-ai

# Watch K8s react in real time
kubectl get pods -n nova-ai -w
```
Faculty sees: `Terminating → ContainerCreating → Running` in ~10 seconds. Zero manual action.

**Demo 3 — HPA Live Autoscaling (5 minutes):**
```bash
# Start a load generator inside the cluster
kubectl run load-generator --image=busybox:1.36 --restart=Never -n nova-ai \
  -- sh -c "while true; do wget -q -O- http://gateway-service:8000/health & sleep 0.1; done"

# Watch HPA scale up
kubectl get hpa -n nova-ai
# gateway-hpa: cpu: 163%/70% → REPLICAS: 1 → 3
```

```bash
# Stop the load generator
kubectl delete pod load-generator -n nova-ai

# CPU drops → HPA scales back down after 5-min stabilization window
kubectl get hpa -n nova-ai
```

**Demo 4 — Secrets protection:**
```bash
kubectl describe secret nova-ai-secrets -n nova-ai
# Data
# ====
# GROQ_API_KEY:     44 bytes   ← value never shown
# MONGODB_URI:      147 bytes  ← value never shown
```

**Viva point:** "Docker Compose is like hiring one chef. If the chef gets sick, the kitchen stops. Kubernetes is like hiring a restaurant manager who automatically replaces any sick chef, hires more during rush hour, and fires extras when it's quiet — all without you doing anything."

---

## 7. Technology 5 — CI/CD Pipeline (3 Marks)

### What Is It?

CI/CD — Continuous Integration / Continuous Deployment. Every `git push` automatically triggers a pipeline that tests the code, builds Docker images, scans for security issues, and deploys to the live server. Zero manual work after pushing.

### What I Built

**File:** `.github/workflows/deploy.yml`  
**Platform:** GitHub Actions  
**Status:** Confirmed working — Pipeline run #19 all 4 stages green, deployed to AWS EC2.

### The Pipeline — 4 Stages

```
git push origin main
        ↓
  GitHub Actions triggers
        ↓
┌─────────────────────────┐
│  Stage 1: Code Quality  │
│  · ESLint on frontend   │
│  · .env commit check    │
└────────────┬────────────┘
             │ PASS ✅
┌────────────▼────────────┐
│  Stage 2: Build         │
│  · Build 5 Docker images│
│  · Layer caching (fast) │
└────────────┬────────────┘
             │ PASS ✅
┌────────────▼────────────┐
│  Stage 3: Security      │  ← This is the DevSecOps layer
│  · GitLeaks scan        │
│  · npm audit (3 svcs)   │
│  · Trivy image scan     │
└────────────┬────────────┘
             │ PASS ✅
┌────────────▼────────────────────────────┐
│  Stage 4: Deploy                        │
│  · npm run build (React, .env.prod)     │
│  · scp dist/* → EC2 /var/www/nova-ai/  │
│  · scp nginx/nova-ai.conf → EC2        │
│  · SSH: install + reload Nginx config  │
│  · SSH: git pull + docker compose up   │
└─────────────────────────────────────────┘
             ↓
  Live on AWS — http://65.2.232.188.nip.io
```

**Stages only run if the previous stage passes.** Bad code is blocked at Stage 1 and never reaches the server.

### Stage Details

**Stage 1 — Code Quality:**
- ESLint runs on the entire frontend codebase. Undefined variables, unused imports, React hooks violations — any lint error blocks the pipeline.
- `.env` commit check: if any `.env` file was accidentally committed, the pipeline fails immediately. API keys cannot reach GitHub.

**Stage 2 — Build:**
- All 5 Docker images are built using GitHub Actions layer cache. If `package.json` hasn't changed, `npm ci` layer is cached. Build time: ~1 minute (vs 5 minutes cold).
- `push: false` — images are built to verify they compile, but not pushed to a registry. Deployment pulls from GitHub directly.

**Stage 3 — Security (DevSecOps):**
- **GitLeaks**: scans every file and every commit for leaked secrets (API keys, private keys, tokens, passwords)
- **npm audit**: checks all npm packages against the Node.js CVE database for HIGH/CRITICAL vulnerabilities (runs on frontend, auth service, agent service separately)
- **Trivy**: scans Docker images layer by layer — OS packages, Node.js packages, and application code — for known CVEs

**Stage 4 — Deploy to EC2:**

The pipeline now does 5 things in sequence:

```bash
# 1. Build React frontend (VITE_SERVER_URL baked in from .env.production)
npm run build   # output: frontend/dist/

# 2. Create web root on EC2 with correct ownership
ssh: sudo mkdir -p /var/www/nova-ai && sudo chown -R ubuntu:ubuntu /var/www/nova-ai

# 3. Upload built frontend to EC2 Nginx web root
scp -r frontend/dist/* ubuntu@65.2.232.188:/var/www/nova-ai/

# 4. Upload + install Nginx proxy config
scp nginx/nova-ai.conf → /tmp/ on EC2
ssh: sudo cp /tmp/nova-ai.conf /etc/nginx/sites-available/
     sudo ln -sf ... /etc/nginx/sites-enabled/
     sudo nginx -t && sudo systemctl reload nginx

# 5. Pull latest code + rebuild Docker containers
ssh: git pull origin main
     docker compose down && docker compose up -d --build
```

The SSH key is stored as a GitHub Secret — base64 encoded, encrypted. Never appears in any log or code file.

### GitHub Secrets Used

| Secret | Purpose |
|---|---|
| `EC2_HOST` | `65.2.232.188` — server IP |
| `EC2_USER` | `ubuntu` — SSH username |
| `EC2_SSH_KEY` | base64-encoded private key |
| `GH_PAT` | Personal Access Token for `git pull` on EC2 |
| `VITE_FIREBASE_API_KEY` | Firebase client key — injected at build time (not in repo) |

### What to Show Faculty

**Demo 1 — Trigger a live pipeline run:**
```bash
# Make a small change (e.g. update health message)
# In backend/gateway/index.js, change "Running v3" to "Running v4"
git add backend/gateway/index.js
git commit -m "demo: trigger CI/CD pipeline for faculty"
git push
```
Open GitHub → Actions tab. Watch each stage turn green in real time.  
Then open `http://65.2.232.188.nip.io` → show the updated app is live.  
"From code push to live on AWS — under 8 minutes, zero manual work."

**Demo 2 — Show a FAILED pipeline:**
Add a deliberate lint error in any `.jsx` file:
```javascript
const unusedVariable = "this will fail ESLint"
```
Push it. Show:
- Stage 1 fails with a red ❌
- Stages 2, 3, 4 are automatically skipped
- The pipeline log shows exactly which file and line failed

"Bad code is caught at Stage 1. It never gets built, never gets scanned, never reaches the server."

**Demo 3 — Show Stage 3 security scan results:**
Click any successful run → Stage 3 → expand each step:
- GitLeaks: "No leaks found"
- npm audit: shows vulnerability count per package
- Trivy: shows CVE scan results per image layer

**Viva point:** "Before CI/CD, deploying meant: SSH into the server, git pull, restart services, hope nothing breaks. With CI/CD, every git push automatically tests, scans, and deploys. If anything fails, deployment is blocked. The team gets notified. Bad code never reaches production."

---

## 8. Technology 6 — DevSecOps (2 Marks)

### What Is It?

DevSecOps = **Dev**elopment + **Sec**urity + **Op**erations integrated together. Security is not bolted on at the end — it is built into every layer of development, from the code you write to how containers are built to what reaches the cloud server.

If any security check fails at any layer, the code does not ship.

### What I Built — 6 Security Layers

#### Layer 1: Secret Protection (Git)

`.gitignore` blocks these from ever being tracked by Git:
```
.env / .env.*               → API keys (Groq, Gemini, MongoDB URI, etc.)
*.pem                       → SSH private keys
terraform.tfvars            → AWS credentials
terraform.tfstate           → Infrastructure state with resource IDs
```

**Exception:** `frontend/.env.production` is committed — it contains only `VITE_SERVER_URL` and public Firebase config (project ID, app ID). No secrets.

**Firebase API key** (`VITE_FIREBASE_API_KEY`) is stored as a GitHub Secret and injected at build time — never committed. GitLeaks flags the `AIzaSy` prefix as a GCP API key pattern. Storing it as a secret prevents false-positive pipeline failures.

**`.gitleaks.toml` allowlist** — a configuration file tells GitLeaks which patterns are intentional false positives:
```toml
[allowlist]
# Firebase client keys are designed to be public — security is via Firebase Rules
regexes = ["AIzaSyArUf3uzinLv3Iwjp3nUGKpU5g1YwkpQeA"]
paths   = ["frontend/.env.production", "frontend/src/utils/firebase.js"]
```

A second check in CI/CD Stage 1 catches it if someone accidentally runs `git add .env`.

#### Layer 2: Dependency Scanning (CI Pipeline)

`npm audit --audit-level=high` runs in Stage 3 on three separate services (frontend, auth, agent). Checks every npm package against the public Node.js security advisory database (NVD). Reports CVEs at HIGH and CRITICAL severity.

#### Layer 3: Docker Image Scanning — Trivy (CI Pipeline)

Trivy scans Docker images **layer by layer** in Stage 3:
- The base `node:20-alpine` OS packages
- All npm packages in `node_modules`
- Any OS tools installed in the Dockerfile

```
nova-auth-service:latest (alpine 3.20.3)
Library    CVE            Severity  Version  Fixed Version
openssl    CVE-2024-xxx   HIGH      3.3.1    3.3.2
```

Every image is scanned before it reaches the production server.

#### Layer 4: Secret Leak Detection — GitLeaks (CI Pipeline)

GitLeaks scans every file in the repository and every git commit for patterns that look like secrets:
- API keys (AWS, Google, Groq, Razorpay key formats)
- Private keys (`-----BEGIN RSA PRIVATE KEY-----`)
- JWT secrets, database connection strings with passwords

A developer who accidentally hardcodes `const GROQ_KEY = "gsk_R47mnM6z..."` will have their deployment blocked immediately.

#### Layer 5: Gateway Security (Application Code)

```javascript
// backend/gateway/index.js

// CORS — accepts multiple origins via comma-separated FRONTEND_URL env var
// Never uses wildcard "*" — credentials (cookies) require exact origin
const allowedOrigins = process.env.FRONTEND_URL.split(",").map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);           // server-to-server calls
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,   // required to send/receive session cookies
}));

// COOP header — allows Google OAuth popup without loosening security
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  next();
});
```

The `verifySession` middleware runs on every request to `/api/chat`, `/api/agent`, and `/api/billing`. The `x-user-id` header is only injected after session verification — an unauthenticated request can never reach these services with a forged user ID.

#### Layer 6: Secure Coding Patterns (Application Code)

**httpOnly Session Cookies (XSS prevention):**
```javascript
// backend/services/auth/index.js
cookie: {
  httpOnly: true,                                    // JS cannot read this cookie
  secure: process.env.NODE_ENV === "production",     // HTTPS only in production
  sameSite: "lax",                                   // CSRF protection
  maxAge: SEVEN_DAYS_MS,
}
```
`httpOnly: true` means JavaScript running in the browser — including malicious injected scripts — cannot read the session cookie. XSS attacks that steal session tokens are blocked at the cookie level.

**Timing-Safe Payment Verification:**
```javascript
// backend/services/billing/controller/billing.controller.js
const expectedSignature = crypto
  .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
  .update(`${razorpay_order_id}|${razorpay_payment_id}`)
  .digest("hex");

const isValidSignature =
  expectedBuffer.length === receivedBuffer.length &&
  crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
```
Regular `===` string comparison leaks timing information — an attacker can send thousands of requests and measure tiny response-time differences to guess the correct Razorpay signature one byte at a time. `crypto.timingSafeEqual()` always takes exactly the same amount of time regardless of where strings differ, making timing-based attacks impossible.

**Atomic Credit Deduction (race condition prevention):**
```javascript
// backend/services/auth/controllers/auth.controller.js
const updatedUser = await User.findOneAndUpdate(
  { _id: userId, credits: { $gte: cost } },   // Condition: must have enough credits
  { $inc: { credits: -cost } },               // Update: deduct
  { new: true }
);
```
If a user sends two AI requests at the exact same millisecond, MongoDB guarantees only one can succeed — the condition check and the decrement happen as a single atomic operation. The second request finds the credits already deducted and is rejected. This prevents a user from spending more credits than they have through race conditions.

**Internal Service Secret:**
Every inter-service HTTP call carries `x-internal-secret`. Internal endpoints (`/internal/deduct-credits`, `/internal/session`) check for this header and reject requests without it with 401. Prevents external attackers from calling internal business logic directly, even if they somehow reach the internal network.

### What to Show Faculty

**Show httpOnly cookie in browser:**
1. Open the app, sign in
2. DevTools → Application → Cookies
3. Find `connect.sid` → HttpOnly column is ✅ checked
"JavaScript cannot read this cookie. Even if an attacker injects malicious code into the page, they cannot steal the session."

**Show `timingSafeEqual` in billing code:**
Open `backend/services/billing/controller/billing.controller.js`. Point at `crypto.timingSafeEqual`.
"Regular string comparison is vulnerable to timing attacks. This cryptographic function prevents it."

**Show atomic credit deduction:**
Open `backend/services/auth/controllers/auth.controller.js`. Point at `findOneAndUpdate` with `{ $gte: cost }` condition.
"One database operation checks the balance AND deducts it. MongoDB guarantees only one concurrent request can win. Race conditions are impossible."

**Show GitLeaks and Trivy in pipeline logs:**
GitHub Actions → any successful run → Stage 3 → expand each scan step.

**Viva point:** "DevSecOps means security is in every layer — secrets never in Git, dependencies checked for CVEs automatically, every Docker image scanned before deployment, payment verification is cryptographically safe, cookies are protected from XSS, and atomic database operations prevent race conditions. Security is not added at the end — it is built into every decision from the start."

---

## 9. Technology 7 — Cloud Provider / AWS (2 Marks)

### What I Deployed

```
┌──────────────────────────────────────────────────────────────┐
│               AWS ap-south-1 (Mumbai)                        │
│                                                              │
│  EC2 t3.micro — 65.2.232.188 (Elastic IP)                   │
│  ├── Nginx (port 80)     → serves React frontend            │
│  ├── Gateway             → Docker container (port 8000)      │
│  ├── Auth Service        → Docker container (port 8001)      │
│  ├── Chat Service        → Docker container (port 8002)      │
│  ├── Agent Service       → Docker container (port 8003)      │
│  ├── Billing Service     → Docker container (port 8004)      │
│  └── Redis               → Docker container (port 6379)      │
│                                                              │
│  S3 Bucket — nova-ai-frontend-19d45e08                       │
│  └── React build files (static website hosting)              │
│                                                              │
│  Auto Scaling Group — nova-ai-asg                            │
│  ├── Min: 1, Max: 2 instances                                │
│  ├── CloudWatch CPU-High alarm (>70% for 2 min → +1 EC2)    │
│  └── CloudWatch CPU-Low alarm (<30% for 10 min → -1 EC2)    │
└──────────────────────────────────────────────────────────────┘

External Cloud Services:
  MongoDB Atlas (ap-south-1 Mumbai)   → User data, chat history
  Qdrant Cloud (sa-east-1 São Paulo)  → PDF vector embeddings
```

### Two Levels of Auto Scaling

NOVA AI has two independent auto-scaling systems that work in sequence:

| Level | What Scales | Trigger | Speed | Cost |
|---|---|---|---|---|
| K8s HPA | Pods inside one EC2 | CPU > 70% | ~20 seconds | Free |
| AWS ASG | Entire EC2 instances | EC2 CPU > 70% for 2 min | 3-5 minutes | Extra EC2 charges |

HPA triggers first and handles most traffic spikes. ASG is the last resort for sustained extreme load that even maximum pods cannot handle.

**How ASG works:**
1. EC2 overall CPU crosses 70% and stays there for 2 consecutive minutes
2. CloudWatch alarm `nova-ai-cpu-high` fires
3. Scale-out policy runs: ASG launches a **new EC2** using the Launch Template
4. New EC2 boots → `user_data.sh` runs automatically → Docker installs → `docker compose up` → full NOVA AI stack running on the second server
5. When CPU drops below 30% for 10 minutes, the extra EC2 is terminated automatically

### Live Infrastructure IDs

```
EC2 Instance ID:    i-062dea98040e78dde
Elastic IP:         65.2.232.188
S3 Bucket:          nova-ai-frontend-19d45e08
ASG Name:           nova-ai-asg
CloudWatch Alarms:  nova-ai-cpu-high / nova-ai-cpu-low
Region:             ap-south-1 (Mumbai)
```

Everything was created with one command: `terraform apply`. Nothing was manually clicked in the AWS Console.

### What to Show Faculty

**Demo 1 — Live EC2 in AWS Console:**
AWS Console → EC2 → Instances → `nova-ai-server`  
Point out: instance type (t3.micro), region (ap-south-1), public IP (65.2.232.188), state (Running).

**Demo 2 — All containers running on cloud:**
```bash
ssh -i nova-ai-key3.pem ubuntu@65.2.232.188
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
Show 6 containers, all healthy, on a real AWS server in Mumbai.

**Demo 3 — S3 Static Hosting:**
AWS Console → S3 → `nova-ai-frontend-19d45e08` → Properties → Static website hosting  
Open the endpoint URL in browser — same React app served from S3 infrastructure.

**Demo 4 — Auto Scaling Demo (most impressive, 5 minutes):**

Open 3 AWS Console tabs: CloudWatch Alarms, ASG Activity, EC2 Instances.

Trigger scale-out:
```bash
aws cloudwatch set-alarm-state \
  --alarm-name "nova-ai-cpu-high" \
  --state-value ALARM \
  --state-reason "Demo: simulating high CPU"
```
Watch: `nova-ai-cpu-high` → In Alarm → ASG Activity shows "Launching new EC2" → Instances: 1 → 2.

Trigger scale-in:
```bash
aws cloudwatch set-alarm-state \
  --alarm-name "nova-ai-cpu-low" \
  --state-value ALARM \
  --state-reason "Demo: simulating low CPU"
```
Watch: Instances: 2 → 1 → the extra EC2 terminates automatically.

**Demo 5 — MongoDB Atlas cloud database:**
`cloud.mongodb.com` → Cluster0 → Browse Collections → show live user and conversation data stored in the cloud database.

**Viva point:** "The entire backend runs on a real AWS server in Mumbai. MongoDB is on Atlas cloud. Vector embeddings are on Qdrant cloud. The application is distributed across multiple cloud providers — this is a real production-grade cloud deployment, not localhost."

---

## 10. Technology 8 — Publicly Accessible Link (2 Marks)

### Live URLs

| What | URL | Status |
|---|---|---|
| **Primary App (fully working)** | `http://65.2.232.188.nip.io` | ✅ Live |
| API Gateway Health | `http://65.2.232.188.nip.io/api/health` | ✅ Live |
| Raw EC2 IP (same server) | `http://65.2.232.188` | ✅ Live |
| S3 Static Frontend (UI only) | `http://nova-ai-frontend-19d45e08.s3-website.ap-south-1.amazonaws.com` | ✅ Live |

### Why `65.2.232.188.nip.io` Instead of Raw IP

`nip.io` is a free wildcard DNS service — no signup, no configuration. It embeds the IP inside the domain name and automatically resolves it:

```
65.2.232.188.nip.io  →  DNS resolves to  →  65.2.232.188
```

This gives a clean, professional domain URL instead of a raw IP address. Zero cost, works globally, no DNS record setup needed.

### How the Frontend Is Served — Nginx Proxy Architecture

```
User opens http://65.2.232.188.nip.io
        ↓
Nginx on EC2 (port 80) — nginx/nova-ai.conf
        │
        ├── /api/* requests → proxy_pass http://localhost:8000 (Gateway)
        │       ↓
        │   Gateway verifies session cookie → routes to microservice
        │
        └── /* requests → /var/www/nova-ai/index.html (React SPA)
                ↓
            React app boots in browser
            All API calls go to http://65.2.232.188.nip.io/api/...
            Same origin (port 80) → session cookie is sent ✅
```

**Why Nginx proxies `/api/*` to port 8000:**

The session cookie uses `SameSite=Lax`. Browsers only send this cookie when the request origin matches the page origin. If the frontend is on port 80 and the API is on port 8000, they are different origins — the cookie is blocked and every API call returns 401.

By routing `/api/*` through Nginx on port 80, the browser sees everything as the same origin. Nginx forwards the request internally to port 8000 with the cookie intact.

```nginx
# nginx/nova-ai.conf
location /api/ {
    proxy_pass         http://localhost:8000;   # forward to Gateway
    proxy_set_header   Cookie  $http_cookie;    # forward session cookie
    proxy_read_timeout 300s;                    # support long AI requests
    proxy_buffering    off;                     # no buffering for streaming
}

location / {
    try_files $uri $uri/ /index.html;           # React SPA — all routes serve index.html
}
```

### What the S3 URL Does

The S3 URL (`http://nova-ai-frontend-19d45e08.s3-website.ap-south-1.amazonaws.com`) serves the same React HTML/JS/CSS files. The UI loads and looks correct. However it cannot handle the full app because:

- API calls from the S3 domain go to `65.2.232.188.nip.io/api/` — a different origin
- The session cookie (SameSite=Lax) is blocked cross-domain over HTTP
- S3 has no server-side proxy capability — it only serves static files

**The S3 URL demonstrates AWS S3 static website hosting as an infrastructure feature** — not as the primary deployment. Show faculty: bucket → files → static hosting enabled → UI loads. That is sufficient to demonstrate S3.

### How to Show Faculty

**Step 1:** Open `http://65.2.232.188.nip.io` — the app loads.
**Step 2:** Sign in with Google — Firebase OAuth works.
**Step 3:** Send a message — AI responds (session cookie works, same origin).
**Step 4:** Open billing — plans load, credits show.
**Step 5:** Open on mobile data (not WiFi) — proves it is truly public, running on AWS Mumbai.
**Step 6:** Show `http://65.2.232.188.nip.io/api/health` in browser — gateway responds from cloud.

**Viva point:** "The app is live at `http://65.2.232.188.nip.io` — this resolves to our EC2 Elastic IP in Mumbai. Nginx receives all requests on port 80, serves the React frontend, and proxies all `/api/*` calls to the Gateway container on port 8000. This same-origin architecture is why session cookies work correctly without HTTPS."

---

## 11. What to Demonstrate — Quick Reference

### Pre-Viva Checklist

```bash
# 1. Verify all containers on EC2 are healthy
ssh -i nova-ai-key3.pem ubuntu@65.2.232.188 "docker ps --format 'table {{.Names}}\t{{.Status}}'"

# 2. Verify Nginx proxy is running
curl http://65.2.232.188.nip.io/api/health

# 3. Verify frontend loads on nip.io domain
# Open http://65.2.232.188.nip.io in browser — sign in + send a message

# 4. Local K8s working
kubectl get pods -n nova-ai
kubectl get hpa -n nova-ai

# 5. Recent successful CI/CD run
# github.com/DharmPatel2302/NOVA-AI → Actions → latest run is green (all 4 stages)
```

### Demo Map by Technology

| Technology | Primary Demo | Time |
|---|---|---|
| Microservices | `docker compose ps` + stop one service + show others still work | 3 min |
| Docker | `docker compose up --build` + exec into container + explain Dockerfile | 5 min |
| Terraform | `terraform plan` output + open ec2.tf + show asg.tf + AWS Console resources | 5 min |
| Kubernetes | `kubectl get all -n nova-ai` + delete pod (self-healing) + HPA load test | 8 min |
| CI/CD | Push a change → GitHub Actions → watch 4 stages run live | 8 min |
| DevSecOps | httpOnly cookie in DevTools + timingSafeEqual in code + Stage 3 scan logs | 5 min |
| Cloud (AWS) | EC2 Console + docker ps on server + ASG scale demo via CloudWatch | 5 min |
| Public Link | Open `http://65.2.232.188.nip.io` + sign in + send a message | 2 min |

### Architecture Summary (One Sentence Per Technology)

| # | Technology | What I Did |
|---|---|---|
| 1 | Microservices | Split NOVA AI into 5 independent services (Gateway, Auth, Chat, Agent, Billing) that communicate over HTTP with internal secrets |
| 2 | Docker | Containerized all 5 services using multi-stage Dockerfiles with shared build context; orchestrated with Docker Compose |
| 3 | Terraform | Provisioned all AWS infrastructure (EC2, S3, ASG, CloudWatch alarms) as code — `terraform apply` creates everything in 3 minutes |
| 4 | Kubernetes | Deployed all services as pods with self-healing Deployments, secure Secrets, and HPA that auto-scales agent to 5 pods under load |
| 5 | CI/CD | 4-stage GitHub Actions pipeline: ESLint → Docker build → security scan → build frontend + Nginx deploy + docker compose on EC2 |
| 6 | DevSecOps | Security in 6 layers: .gitignore + GitLeaks allowlist + npm audit + Trivy + httpOnly cookies + timingSafeEqual + atomic MongoDB ops |
| 7 | AWS Cloud | EC2 t3.micro in Mumbai runs all containers; S3 hosts static frontend; ASG auto-scales EC2 instances via CloudWatch CPU alarms |
| 8 | Public Link | `http://65.2.232.188.nip.io` — Nginx on EC2 proxies `/api/*` to Gateway, serves React SPA — same-origin so session cookies work |

