# NOVA AI — Complete Assignment Roadmap
# Total Marks: 20

---

## PROJECT OVERVIEW

**NOVA AI** is a production-grade, multi-agent AI platform built on a microservices architecture.
It features 8 specialized AI agents (Chat, Search, Coding, PDF, PPT, Image, Image Analyzer, PDF RAG)
orchestrated via a LangGraph state machine, with Firebase authentication, Redis-backed sessions,
MongoDB persistence, Qdrant vector database, Razorpay billing, and full Docker containerization.

This document maps every assignment technology to a specific, demonstrable use case in the project.

---

## TECHNOLOGY 1 — MICROSERVICES (3 Marks) ✅ COMPLETE

### What It Is
Microservices means splitting one large application into small, independent services that each do
one specific job and communicate over HTTP.

### How NOVA AI Uses It
Instead of one monolithic server, NOVA AI has 5 completely independent services:

```
┌─────────────────────────────────────────────────────────────┐
│                     NOVA AI Architecture                    │
│                                                             │
│  React Frontend (5173)                                      │
│         ↓                                                   │
│  API Gateway (8000)  ←── Single entry point                 │
│    ├── verifySession (Redis)                                │
│    └── routes to:                                           │
│         ├── Auth Service    (8001) → Firebase + MongoDB     │
│         ├── Chat Service    (8002) → MongoDB                │
│         ├── Agent Service   (8003) → LangGraph + AI APIs   │
│         └── Billing Service (8004) → Razorpay + MongoDB    │
│                                                             │
│  Shared: Redis (sessions + memory cache)                    │
└─────────────────────────────────────────────────────────────┘
```

### Each Service's Responsibility

| Service | Port | Responsibility |
|---|---|---|
| Gateway | 8000 | Session verify, CORS, proxy routing |
| Auth | 8001 | Firebase login, user profiles, credits |
| Chat | 8002 | Conversations, messages, history |
| Agent | 8003 | LangGraph, 8 AI agents, file handling |
| Billing | 8004 | Razorpay orders, payment verification |

### Inter-Service Communication
- Gateway → Auth: Proxied HTTP for login/me/logout
- Gateway → Chat/Agent/Billing: Adds `x-user-id` + `x-internal-secret` headers
- Agent → Chat: Saves messages to MongoDB via HTTP
- Agent → Auth: Checks/deducts credits via internal endpoints
- Billing → Auth: Updates plan and credits after payment

### Key Design Decisions
- **Internal Service Secret**: All inter-service calls carry `x-internal-secret` to prevent direct access
- **Session at Gateway**: Auth check happens once at gateway — services trust forwarded headers
- **Redis shared**: All services share same Redis instance for session consistency

### How to Demonstrate

**Demo 1 — Show all 5 services running:**
```bash
docker compose ps
```
Point out each service has its own container, port, codebase

**Demo 2 — Show independence (fault isolation):**
```bash
docker compose stop agent-service
# Chat still loads, auth still works
docker compose start agent-service
```

**Demo 3 — Show code structure:**
Open `backend/` folder — each service has its own:
- `package.json` (independent dependencies)
- `Dockerfile` (independent container)
- `index.js` (independent server)
- Own database models

**Demo 4 — Live request trace:**
Send a message → show in gateway logs → agent logs → chat logs
```bash
docker compose logs -f gateway agent-service chat-service
```

**Key talking point for viva:**
"If the Image Agent crashes, users can still chat, search, and make payments — 
because each service is completely isolated. This is the core benefit of microservices."

---

## TECHNOLOGY 2 — DOCKER (4 Marks) ✅ COMPLETE

### What It Is
Docker packages each service with ALL its dependencies into a container that runs identically
everywhere — your laptop, EC2, any server worldwide.

### How NOVA AI Uses It

**5 Dockerfiles (one per service):**
```
backend/
├── gateway/Dockerfile
├── services/auth/Dockerfile
├── services/chat/Dockerfile
├── services/agent/Dockerfile
└── services/billing/Dockerfile
```

**Shared build context pattern:**
Because services share `backend/shared/` (Redis client, Cloudinary utils), ALL Dockerfiles
are built from the `backend/` root — not from within each service folder.
```dockerfile
# Example from auth/Dockerfile:
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY services/auth/ ./services/auth/
COPY shared/ ./shared/      ← shared Redis client included
RUN npm install
```

**docker-compose.yml orchestrates all 6 containers:**
- Redis (alpine — lightweight)
- Gateway, Auth, Chat, Agent, Billing
- Container names, port mappings, env_file, depends_on, restart policies
- Internal Docker network (services talk via container name not IP)

**Makefile shortcuts:**
```bash
make up       # docker compose up -d
make down     # docker compose down
make build    # docker compose build
make logs     # docker compose logs -f
make ps       # docker compose ps
make restart  # down + up --build
make logs-agent   # logs for specific service
```

### How to Demonstrate

**Demo 1 — One command startup:**
```bash
cd backend
docker compose up --build
```
Show all 6 containers starting from scratch

**Demo 2 — Show Dockerfile:**
Open `services/agent/Dockerfile` — explain:
- `FROM node:20-alpine` → base image
- `WORKDIR /app` → working directory
- `COPY` → only what's needed
- `RUN npm install` → dependencies inside container
- `CMD` → start command

**Demo 3 — Show container isolation:**
```bash
docker compose exec agent-service sh
# Inside container — isolated filesystem
ls
exit
```

**Demo 4 — Show Makefile:**
```bash
make ps       # show running containers
make logs-gateway  # show gateway logs
make down     # stop everything
make up       # restart everything
```

**Demo 5 — Shared context build:**
Show that `backend/docker-compose.yml` uses `context: .` (root) not `context: ./services/auth`
Explain why: shared Redis module needs to be in the build context

**Key talking point for viva:**
"Without Docker, every developer needs to install Node 20, set up Redis, configure environment
variables manually. With Docker, one command gives everyone an identical, working environment."

---

## TECHNOLOGY 3 — IaC / TERRAFORM (2 Marks) 

### What It Is
Infrastructure as Code means writing files that CREATE cloud infrastructure automatically,
instead of clicking buttons in the AWS Console. Terraform reads `.tf` files and provisions
exact resources every time.

### ChatGPT Recommendation (Implemented)
Following the recommendation: Terraform provisions an AWS EC2 instance + VPC networking +
security groups. K3s (lightweight Kubernetes) installs on that EC2 via `user_data.sh`.
This gives both IaC and Kubernetes running on real cloud — stronger than either alone.

### How NOVA AI Uses Terraform

```
terraform apply
      ↓
Reads 6 .tf files
      ↓
Creates on AWS (ap-south-1 Mumbai):
├── VPC + Subnet + Internet Gateway (networking)
├── Security Group (firewall: ports 22, 80, 8000-8004)
├── EC2 t3.micro (free tier server)
├── S3 Bucket (frontend static hosting)
├── Elastic IP (fixed public IP)
└── user_data.sh runs on boot:
    ├── Installs Docker
    ├── Clones GitHub repo
    ├── Creates .env files
    └── Runs docker compose up
```

### Terraform File Structure
```
terraform/
├── main.tf           → AWS provider + credentials
├── variables.tf      → Configurable inputs (region, name, type)
├── outputs.tf        → Prints EC2 IP + URLs after deploy
├── ec2.tf            → EC2 instance + security group
├── s3.tf             → Frontend S3 bucket + static hosting
├── user_data.sh      → Boot script: Docker + app setup
└── terraform.tfvars  → Your actual values (gitignored)
```

### Key Terraform Commands
```bash
terraform init      # Download AWS provider plugin
terraform fmt       # Format .tf files
terraform validate  # Check syntax errors
terraform plan      # Preview what will be created (NO actual changes)
terraform apply     # Create everything on AWS
terraform destroy   # Tear everything down
```

### How to Demonstrate

**Demo 1 — Show terraform plan output:**
Run `terraform plan` — show the 7 resources it will create:
- `aws_instance.nova_ai`
- `aws_security_group.nova_ai_sg`
- `aws_s3_bucket.frontend`
- `aws_s3_bucket_policy.frontend`
- `aws_s3_bucket_website_configuration.frontend`
- `aws_s3_bucket_public_access_block.frontend`
- `random_id.bucket_suffix`

**Demo 2 — Show ec2.tf:**
Open file — explain each ingress rule (port 22 SSH, 8000 gateway, 8001-8004 services)

**Demo 3 — Show variables.tf:**
Explain configurable inputs — region, instance type, project name

**Demo 4 — Show user_data.sh:**
Explain: "This script runs automatically on EC2 boot — installs Docker, clones our repo from
GitHub, creates .env files, and runs docker compose up. The entire application auto-starts
without any manual SSH."

**Demo 5 — Show .gitignore:**
Point out `terraform.tfvars` and `*.pem` are gitignored — secrets never committed

**Key talking point for viva:**
"If our EC2 server crashes at 3am, we don't need to manually recreate everything.
One command — `terraform apply` — recreates the exact same server with identical
configuration in 2 minutes. That's the power of Infrastructure as Code."

**Why it's better than manual AWS Console:**
```
Manual approach:         Terraform approach:
1. Click EC2             1. terraform apply
2. Select AMI            → Everything created automatically
3. Choose instance type  → Same result every time
4. Configure networking  → Version controlled in Git
5. Set security group    → Anyone can recreate it
6. SSH and install       → No human error possible
7. Configure app
... 15+ manual steps
```

---

## TECHNOLOGY 4 — KUBERNETES (2 Marks) 

### What It Is
Kubernetes (K8s) manages containers at scale — auto-restarts crashed pods, load balances traffic,
auto-scales when demand increases. Docker Compose runs on 1 machine; Kubernetes runs on many.

### Plan: K3s on EC2 (Following ChatGPT Recommendation)
Run K3s (lightweight Kubernetes) on the Terraform-provisioned EC2 instance.
This demonstrates real cloud-based Kubernetes without the cost of managed EKS.

```
EC2 t3.micro (Terraform created)
└── K3s installed via user_data.sh
    └── kubectl apply -f k8s/
        ├── 5 Deployments (one per service)
        ├── 5 Services (stable internal DNS)
        ├── Redis StatefulSet
        └── Ingress (routes / to gateway)
```

### K8s Files to Build
```
k8s/
├── namespace.yaml      → nova-ai namespace (isolation)
├── secrets.yaml        → API keys stored as K8s Secrets
├── configmap.yaml      → Non-secret config values
├── redis.yaml          → Redis StatefulSet + Service
├── gateway.yaml        → Deployment + Service + resource limits
├── auth.yaml           → Deployment + Service
├── chat.yaml           → Deployment + Service
├── agent.yaml          → Deployment + Service (higher CPU limit)
├── billing.yaml        → Deployment + Service
└── ingress.yaml        → Routes external traffic to gateway
```

### Key K8s Concepts in Your Project

| K8s Object | Used For |
|---|---|
| Namespace | Isolate all NOVA AI resources |
| Deployment | Run and manage each service pod |
| Service | Give each service a stable internal URL |
| Secret | Store API keys (Groq, Gemini, etc.) securely |
| ConfigMap | Store non-sensitive env vars |
| Ingress | Single entry point → routes to gateway |
| ResourceLimits | CPU/memory limits per service |

### How to Demonstrate

**Demo 1 — Show all pods running:**
```bash
kubectl get pods -n nova-ai
kubectl get services -n nova-ai
```

**Demo 2 — Self-healing (most impressive demo):**
```bash
# Kill agent pod manually
kubectl delete pod -l app=agent-service -n nova-ai
# Watch it auto-restart
kubectl get pods -n nova-ai -w
```
Faculty sees: `Terminating` → `ContainerCreating` → `Running` in ~10 seconds

**Demo 3 — Scaling under load:**
```bash
# Scale agent service to 3 replicas
kubectl scale deployment agent-service --replicas=3 -n nova-ai
kubectl get pods -n nova-ai
# Shows 3 agent pods running — load balanced automatically
```

**Demo 4 — Show secrets:**
```bash
kubectl get secrets -n nova-ai
kubectl describe secret nova-ai-secrets -n nova-ai
# Keys shown but values are base64 encoded — never exposed
```

**Demo 5 — Resource limits:**
Open `k8s/agent.yaml` — show CPU/memory limits:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```
Explain: "Agent service gets more resources because it runs AI models"

**Key talking point for viva:**
"Docker Compose is like hiring one chef — if they get sick, kitchen stops.
Kubernetes is like having a restaurant manager who automatically replaces any
chef who gets sick, hires more chefs when it's busy, and fires extras when it's quiet."

---

## TECHNOLOGY 5 — CI/CD PIPELINE (3 Marks) 

### What It Is
Continuous Integration / Continuous Deployment — every `git push` automatically:
1. Tests the code
2. Builds Docker images
3. Scans for security issues
4. Deploys to the server
No manual work needed after pushing code.

### How NOVA AI Will Use It

```
Developer pushes code to GitHub (main branch)
              ↓
    GitHub Actions triggers pipeline
              ↓
    ┌─────────────────────────┐
    │   Stage 1: Code Quality │
    │   - Checkout code       │
    │   - Run ESLint          │
    │   - Check .env not leak │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │   Stage 2: Build        │
    │   - Build Docker images │
    │   - Tag with commit SHA │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │   Stage 3: Security     │
    │   - Trivy image scan    │
    │   - GitLeaks secret scan│
    │   - npm audit           │
    └────────────┬────────────┘
                 ↓
    ┌─────────────────────────┐
    │   Stage 4: Deploy       │
    │   - SSH into EC2        │
    │   - git pull            │
    │   - docker compose up   │
    └─────────────────────────┘
              ↓
    App updated on AWS automatically!
```

### File to Build
```
.github/
└── workflows/
    └── deploy.yml
```

### How to Demonstrate

**Demo 1 — Live pipeline run:**
Make a small change (e.g. change gateway health message to "NOVA AI Gateway v2"):
```bash
git add . && git commit -m "demo: update health message" && git push
```
Go to GitHub → Actions tab → show pipeline running in real time

**Demo 2 — Show each stage:**
Click on the running workflow — show:
- ✅ Code Quality (ESLint passed)
- ✅ Build (Docker images built)
- ✅ Security (Trivy scan clean)
- ✅ Deploy (SSH into EC2, redeployed)

**Demo 3 — Show the change is live:**
Visit `http://EC2-IP:8000` → shows updated health message
"From code push to live in under 3 minutes, zero manual work"

**Demo 4 — Show failed pipeline:**
Introduce a deliberate lint error → show pipeline fails at Stage 1
"Bad code never reaches production — pipeline blocks it"

**Key talking point for viva:**
"Before CI/CD, deploying meant: SSH into server, git pull, restart services, pray nothing breaks.
With CI/CD, every git push automatically tests, scans, and deploys. If anything fails,
deployment is blocked and the team gets notified immediately."

---

## TECHNOLOGY 6 — DEVSECOPS (2 Marks) 

### What It Is
DevSecOps = Development + Security + Operations integrated together.
Security is not added at the end — it is built into every step of development.

### How NOVA AI Will Implement It

#### Layer 1: Secret Protection ()
- `.env` files in `.gitignore` → API keys never committed
- `terraform.tfvars` gitignored → AWS credentials never committed
- `*.pem` gitignored → SSH keys never committed

#### Layer 2: Dependency Scanning
```bash
# Check for vulnerable npm packages
npm audit --audit-level=high
```
Runs in CI/CD pipeline — blocks deploy if critical CVE found

#### Layer 3: Docker Image Scanning (Trivy)
```yaml
# In GitHub Actions:
- name: Scan Docker image for vulnerabilities
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: nova-auth-service:latest
    severity: CRITICAL,HIGH
    exit-code: 1   # Fail pipeline if found
```
Scans every Docker image for known CVEs before deployment

#### Layer 4: Secret Leak Detection (GitLeaks)
```yaml
- name: Scan for secrets in code
  uses: gitleaks/gitleaks-action@v2
```
Scans every commit for accidentally added API keys, passwords, tokens

#### Layer 5: Security Headers in Gateway
```javascript
// Already in gateway — explain this to faculty:
res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
// CORS allows only specific origins
// httpOnly cookies prevent XSS
// internal service secret prevents direct service access
```

#### Layer 6: Secure Coding Patterns 
- `crypto.timingSafeEqual()` for payment signature verification (prevents timing attacks)
- Atomic MongoDB operations for credit deduction (prevents race conditions)
- `httpOnly: true` cookies (prevents JavaScript XSS theft)
- Input validation on all endpoints
- Ownership checks before data access

### How to Demonstrate

**Demo 1 — Show npm audit:**
```bash
cd backend/services/auth
npm audit
```
Show vulnerability report

**Demo 2 — Show Trivy scan in CI/CD:**
Go to GitHub Actions → show Security stage → show Trivy scan results

**Demo 3 — Show .gitignore protecting secrets:**
```bash
git status
# .env files never show as tracked
git log --all -- "**/.env"
# No commits with .env files
```

**Demo 4 — Show timingSafeEqual in billing:**
Open `billing/controller/billing.controller.js` → line with `crypto.timingSafeEqual`
Explain: "Regular string comparison leaks timing info. timingSafeEqual takes constant time
regardless of where strings differ — prevents timing-based attacks on payment verification."

**Demo 5 — Show httpOnly cookies:**
Open browser DevTools → Application → Cookies
Show `connect.sid` cookie has `HttpOnly` flag — JavaScript cannot read it

**Key talking point for viva:**
"Security is not something we added at the end. It is in every layer:
- Secrets never in Git
- Dependencies checked for CVEs automatically  
- Every Docker image scanned before deployment
- Cryptographic verification for payments
- Cookies protected from XSS
This is what DevSecOps means in practice."

---

## TECHNOLOGY 7 — CLOUD PROVIDER (2 Marks) 🔄 IN PROGRESS

### What It Is
Deploy the application on real cloud infrastructure accessible from anywhere in the world.

### How NOVA AI Uses AWS

```
AWS ap-south-1 (Mumbai — closest to India)
├── EC2 t3.micro           → Runs all 5 Docker containers
│   └── Security Group     → Firewall (ports 22,80,8000-8004)
├── S3 Bucket              → Frontend static hosting
├── Elastic IP             → Fixed public IP (doesn't change on restart)
└── VPC + Subnet           → Isolated network environment

External Services (Cloud):
├── MongoDB Atlas          → Cloud database (ap-south-1)
├── Qdrant Cloud           → Vector database (sa-east-1)
└── Redis (Docker)         → Runs on EC2
```

### Infrastructure Created by Terraform
All resources created via `terraform apply` — no manual clicking:
- EC2 instance ID: `i-05545f62376bd8319`
- Security Group: `sg-040dcf71fa311359b`
- S3 Bucket: `nova-ai-frontend-10a83092`
- Region: ap-south-1 (Mumbai)

### How to Demonstrate

**Demo 1 — Show live EC2 in AWS Console:**
AWS Console → EC2 → Instances → show `nova-ai-server` running
Point out: instance type, region, public IP, running state

**Demo 2 — Show services running on EC2:**
SSH into EC2:
```bash
ssh -i nova-ai-key.pem ubuntu@EC2-IP
sudo docker compose ps
```
Show all 6 containers running on a real cloud server

**Demo 3 — Show MongoDB Atlas cloud database:**
cloud.mongodb.com → Cluster0 → Browse Collections
Show real user data, conversations stored in cloud

**Demo 4 — Show Qdrant cloud vector DB:**
cloud.qdrant.io → show cluster running in cloud

**Demo 5 — Show cost efficiency:**
Open AWS Console → Billing → show $0 or minimal cost
"We're using free tier — EC2 t3.micro is free for 750 hrs/month for 12 months"

**Key talking point for viva:**
"The entire backend runs on a real AWS server in Mumbai.
MongoDB is on Atlas cloud. Vectors stored in Qdrant cloud.
Everything is distributed across multiple cloud providers —
this is a real production-grade cloud deployment, not just localhost."

---

## TECHNOLOGY 8 — PUBLICLY ACCESSIBLE LINK (2 Marks) 🔄 IN PROGRESS

### Target URLs
```
Frontend:  http://EC2-IP        (Nginx serves React app on port 80)
Backend:   http://EC2-IP:8000   (API Gateway)
```



### How to Get It Working
```bash
# On EC2:
sudo bash -c 'cat > /etc/nginx/sites-available/default << EOF
server {
    listen 80;
    root /var/www/html;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF'
sudo nginx -t && sudo systemctl reload nginx
```

### How to Demonstrate
Open `http://EC2-IP` in browser — show:
1. Landing page loads
2. Sign in with Google works
3. Send a message — AI responds
4. Show it works from mobile (different network)

**Key talking point for viva:**
"This URL works from any device, anywhere in the world.
It's not running on my laptop — it's running on AWS in Mumbai,
available 24/7 as long as the EC2 instance is running."

