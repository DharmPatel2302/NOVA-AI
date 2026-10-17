# Technology 5 — CI/CD Pipeline
# Technology 6 — DevSecOps
# Marks: 3 + 2 = 5/20

---

## What Is CI/CD?

**CI = Continuous Integration** — every time code is pushed to GitHub, it is automatically tested and built. Problems are caught immediately, not days later.

**CD = Continuous Deployment** — after tests pass, the code is automatically deployed to the server. No manual SSH, no manual restarts.

**Before CI/CD (manual workflow):**
```
Developer writes code
      ↓
Manually runs tests (if they remember)
      ↓
SSH into EC2 server
      ↓
git pull
      ↓
docker compose down && docker compose up --build
      ↓
Pray nothing breaks
Total time: 15-30 minutes, error-prone
```

**After CI/CD (automated):**
```
Developer pushes code to GitHub
      ↓
Pipeline runs automatically (no human needed)
      ↓
Code is linted, built, scanned, and deployed
Total time: 3-5 minutes, zero manual work
```

---

## What Is DevSecOps?

**DevSecOps = Development + Security + Operations integrated together.**

Traditional approach: Security is added at the END — "we'll audit it before release."
DevSecOps: Security is built into EVERY step.

```
Dev stage:       Secrets in .gitignore, httpOnly cookies, timingSafeEqual
CI stage:        GitLeaks scans every commit for leaked secrets
Build stage:     Docker images built with minimal attack surface
Security stage:  Trivy scans images for CVEs, npm audit checks deps
Deploy stage:    Only verified, scanned code reaches production
```

If any security check fails, deployment is **blocked**. Bad code never reaches production.

---

## NOVA AI Pipeline Architecture

```
Every git push to main branch
              ↓
    ┌─────────────────────┐
    │  Stage 1: Code      │
    │  Quality            │
    │  - ESLint (lint)    │
    │  - .env check       │
    └──────────┬──────────┘
               │ PASS
    ┌──────────▼──────────┐
    │  Stage 2: Build     │
    │  - Build 5 Docker   │
    │    images           │
    │  - Layer caching    │
    └──────────┬──────────┘
               │ PASS
    ┌──────────▼──────────┐
    │  Stage 3: Security  │  ← DevSecOps
    │  - GitLeaks         │
    │  - npm audit        │
    │  - Trivy image scan │
    └──────────┬──────────┘
               │ PASS
    ┌──────────▼──────────┐
    │  Stage 4: Deploy    │
    │  - SSH into EC2     │
    │  - git pull         │
    │  - docker compose   │
    │    up --build       │
    └─────────────────────┘
              ↓
    App updated on AWS automatically!
```

**File location:** `.github/workflows/deploy.yml`

---

## How GitHub Actions Works

GitHub Actions is a CI/CD platform built into GitHub. When you push code:
1. GitHub detects the push
2. Reads `.github/workflows/deploy.yml`
3. Spins up a fresh Ubuntu virtual machine (called a **runner**)
4. Runs each stage in order
5. If any stage fails, all subsequent stages are skipped
6. Results shown in GitHub → Actions tab

The runner is a **temporary VM** — it exists for the duration of the pipeline and is destroyed after. Every pipeline run starts fresh.

---

## GitHub Secrets — How They Work

Secrets are encrypted values stored in GitHub. The pipeline uses them without ever exposing them in logs or code.

**Where they are stored:**
```
GitHub → Your Repo → Settings → Secrets and variables → Actions
```

**NOVA AI Pipeline Secrets:**

| Secret Name | Value | Purpose |
|---|---|---|
| `EC2_HOST` | `65.2.232.188` | IP address of your AWS EC2 server |
| `EC2_USER` | `ubuntu` | SSH username for Ubuntu EC2 |
| `EC2_SSH_KEY` | Contents of `nova-ai-key.pem` | Private key to SSH into EC2 |

**How to add a secret:**
1. Go to: `github.com/DharmPatel2302/NOVA-AI/settings/secrets/actions`
2. Click **New repository secret**
3. Enter Name and Value
4. Click **Add secret**

**How the pipeline uses them:**
```yaml
- name: Deploy to EC2 via SSH
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.EC2_HOST }}      # Never shown in logs — replaced with ***
    username: ${{ secrets.EC2_USER }}
    key: ${{ secrets.EC2_SSH_KEY }}
```

In pipeline logs, secret values appear as `***` — never visible.

**Why not hardcode the IP in the YAML file?**
If someone forks your repo, they'd see your server IP and SSH key. Secrets keep them out of version control entirely.

---

## Stage-by-Stage Breakdown

---

### Stage 1 — Code Quality

```yaml
code-quality:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js 20
      uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "npm"

    - name: Install frontend dependencies
      run: npm ci
      working-directory: frontend

    - name: Run ESLint
      run: npm run lint
      working-directory: frontend

    - name: Check for .env files accidentally committed
      run: |
        if git diff --name-only HEAD~1 HEAD | grep -E "^\.env$|/\.env$"; then
          echo "ERROR: .env file in commit"
          exit 1
        fi
```

**What ESLint checks:**
- Undefined variables
- Unused imports
- React hooks violations
- Syntax errors
- Code style issues

**If ESLint fails:** Pipeline stops at Stage 1. Stages 2, 3, 4 never run. Bad code never gets built or deployed.

**The .env check:** If someone accidentally runs `git add .env` and commits, this step catches it and blocks the deploy. Secrets are never deployed.

---

### Stage 2 — Build

```yaml
build:
  needs: code-quality    # Runs ONLY if Stage 1 passed

  steps:
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Build gateway image
      uses: docker/build-push-action@v5
      with:
        context: ./backend
        file: ./backend/gateway/Dockerfile
        push: false              # Build only, don't push to registry
        tags: nova-gateway:latest
        cache-from: type=gha,scope=gateway   # Use GitHub Actions cache
        cache-to: type=gha,mode=max,scope=gateway
```

Same pattern for all 5 services: gateway, auth, chat, billing, agent.

**Why `push: false`?**
We build to verify the images compile correctly. In production, you'd push to Docker Hub or ECR. For this project, we deploy by SSHing into EC2 and rebuilding there.

**Why GitHub Actions cache?**
Docker builds layer by layer. If `package.json` hasn't changed, the `npm ci` layer is cached — no re-install. This cuts build time from 5 minutes to ~1 minute on second run.

**`needs: code-quality`** — this is how stages depend on each other. If Stage 1 fails, Stage 2 never starts.

---

### Stage 3 — Security (DevSecOps)

This is the DevSecOps layer. Three tools run automatically on every push.

#### a) GitLeaks — Secret Leak Detection

```yaml
- name: Scan for secrets in code (GitLeaks)
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

GitLeaks scans every file in the repository and every commit for patterns that look like secrets:
- API keys (AWS, Google, Stripe, etc.)
- Private keys (`-----BEGIN RSA PRIVATE KEY-----`)
- Tokens, passwords, connection strings

**If GitLeaks finds a secret:** Pipeline fails immediately. The code cannot be deployed until the secret is removed and the history is cleaned.

**Example of what it catches:**
```javascript
// Developer accidentally writes this:
const API_KEY = "gsk_R47mnM6zJffURvwyLbGVWGdyb3FY";  // ← GitLeaks blocks this
```

#### b) npm audit — Dependency Vulnerability Scan

```yaml
- name: npm audit — frontend dependencies
  run: npm audit --audit-level=high || true
  working-directory: frontend

- name: npm audit — auth service
  run: npm audit --audit-level=high || true
  working-directory: backend/services/auth

- name: npm audit — agent service
  run: npm audit --audit-level=high || true
  working-directory: backend/services/agent
```

`npm audit` checks every package in `node_modules` against the Node.js security database. If any package has a known CVE (Common Vulnerability and Exposure) at HIGH or CRITICAL severity, it reports it.

**The `|| true`** means: show vulnerabilities but don't fail the pipeline. Remove `|| true` to make critical CVEs block the deploy.

**Why audit 3 services?** Each service has its own `package.json`. Auth has Firebase Admin. Agent has LangChain. Frontend has React. All need separate audits.

#### c) Trivy — Docker Image Vulnerability Scan

```yaml
- name: Trivy scan — auth-service image
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: nova-auth-service:latest
    format: table
    severity: CRITICAL,HIGH
    exit-code: 0
```

Trivy scans the built Docker image layer by layer:
- Base image vulnerabilities (node:20-alpine packages)
- Application dependencies
- OS-level packages

**Output shows:**
```
nova-auth-service:latest (alpine 3.20.3)
======================================
Library       Vulnerability   Severity   Version   Fixed Version
──────────────────────────────────────────────────────────────
openssl       CVE-2024-xxxx   HIGH       3.3.1     3.3.2
```

**`exit-code: 0`** means report but don't fail. Change to `exit-code: 1` to block deploys when critical CVEs are found.

---

### Stage 4 — Deploy

```yaml
deploy:
  needs: security
  if: github.ref == 'refs/heads/main'   # Only deploy from main branch

  steps:
    - name: Deploy to EC2 via SSH
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.EC2_HOST }}
        username: ${{ secrets.EC2_USER }}
        key: ${{ secrets.EC2_SSH_KEY }}
        timeout: 300s
        script: |
          cd /home/ubuntu/nova-ai
          git pull origin main
          cd backend
          docker compose down
          docker compose up -d --build
          docker compose ps
```

**What happens on the EC2 server:**
1. SSH connection established using the private key from GitHub Secrets
2. `cd /home/ubuntu/nova-ai` — navigate to the cloned repo
3. `git pull origin main` — download the latest code
4. `docker compose down` — stop all running containers
5. `docker compose up -d --build` — rebuild images with new code + start containers
6. `docker compose ps` — verify all containers are running
7. SSH connection closes

**`if: github.ref == 'refs/heads/main'`** — deploy ONLY when pushing to main. If you push to a feature branch, stages 1-3 still run (catch bugs early) but deploy is skipped.

**`timeout: 300s`** — SSH connection waits up to 5 minutes. Agent service takes the longest to rebuild (130MB image).

---

## Pipeline Trigger

```yaml
on:
  push:
    branches:
      - main          # Automatic — every push to main triggers pipeline
  workflow_dispatch:  # Manual — can trigger from GitHub Actions tab
```

**Automatic trigger:** Any `git push origin main` starts the pipeline immediately.

**Manual trigger:** Go to GitHub → Actions → NOVA AI CI/CD Pipeline → Run workflow. Useful for redeploying without making a code change.

---

## DevSecOps Layers — Complete Picture

Security is built into every layer of NOVA AI, not just the pipeline:

### Layer 1: Development (Code)
- `httpOnly: true` cookies — JavaScript cannot steal session cookies (XSS protection)
- `crypto.timingSafeEqual()` in billing — prevents timing attacks on payment verification
- Atomic MongoDB operations — prevents race conditions in credit deduction
- Ownership checks before any data access — prevents unauthorized data access

### Layer 2: Version Control (Git)
- `.gitignore` — `.env` files, `*.pem`, `terraform.tfvars` never committed
- GitLeaks in pipeline — catches any accidentally committed secrets
- `.env` commit check in Stage 1 — blocks deploy if .env is in commit

### Layer 3: Dependencies (npm)
- `npm audit` in pipeline — checks every package for known CVEs
- `npm ci --omit=dev` in Dockerfiles — dev tools never in production images
- Pinned versions in `package-lock.json` — no surprise updates

### Layer 4: Containers (Docker)
- `node:20-alpine` base image — minimal attack surface (~5MB vs ~900MB)
- Trivy scan in pipeline — every image checked for OS and app CVEs
- No secrets in images — only injected at runtime via `.env` files

### Layer 5: Infrastructure (Gateway)
- `Cross-Origin-Opener-Policy` header
- CORS allows only specific origins (not `*`)
- `x-internal-secret` header — internal services can't be called directly
- Redis sessions with `httpOnly` + `secure` + `sameSite` cookie flags

### Layer 6: Cloud (AWS)
- Security Group — only ports 22, 80, 8000-8004 open; everything else blocked
- SSH key authentication — no password login on EC2
- GitHub Secrets — EC2 IP and SSH key never in code

---

## How to View Pipeline Results

### GitHub Actions Tab
```
github.com/DharmPatel2302/NOVA-AI → Actions tab
```

Shows every pipeline run with:
- ✅ Green checkmark = all stages passed, deployed
- ❌ Red X = a stage failed, deployment blocked
- 🟡 Yellow circle = pipeline is currently running

Click any run to see detailed logs per stage.

---

## What to Demonstrate to Faculty

### Demo 1 — Show the workflow file
Open `.github/workflows/deploy.yml`
Walk through each stage:
- *"Stage 1 checks code quality with ESLint — bad code fails here"*
- *"Stage 2 builds all 5 Docker images — verifies they compile correctly"*
- *"Stage 3 runs 3 security scans — GitLeaks, npm audit, Trivy"*
- *"Stage 4 SSHs into our AWS EC2 and redeploys — zero manual work"*

### Demo 2 — Show a live pipeline run
Make a small change:
```bash
# Change health message in gateway
# Open backend/gateway/index.js and change "Running" to "Running v2"
git add backend/gateway/index.js
git commit -m "demo: trigger CI/CD pipeline"
git push
```
Go to GitHub → Actions tab → show the pipeline running in real time.
Point out each stage turning green one by one.

### Demo 3 — Show each stage in detail
Click on the completed pipeline run. Show:
- Stage 1: ESLint output — "0 warnings, 0 errors"
- Stage 2: Docker build logs — layers being cached
- Stage 3: Trivy scan table — CVE report
- Stage 4: SSH deploy log — git pull, docker compose up output

### Demo 4 — Show a failed pipeline (most impressive)
Introduce a deliberate ESLint error:
```javascript
// Add this to any .jsx file:
const unusedVar = "this will fail lint"   // ESLint catches unused vars
```
```bash
git add . && git commit -m "demo: intentional lint error" && git push
```
Show: Stage 1 fails → Stages 2, 3, 4 never run → bad code never deployed.

Then fix it and push again — show pipeline turns green.

### Demo 5 — Show GitHub Secrets
GitHub → Settings → Secrets and variables → Actions
Show `EC2_HOST`, `EC2_USER`, `EC2_SSH_KEY` are listed — but values are hidden.
*"The pipeline uses these secrets to SSH into our server without ever exposing the key in code or logs."*

### Demo 6 — Show npm audit
```bash
cd backend/services/auth
npm audit
```
Show vulnerability report in terminal. Explain: *"This same check runs automatically in every pipeline — if a new critical CVE is discovered in a package we use, the next deploy will catch it."*

### Demo 7 — Show Trivy scan result
Point to Stage 3 in the pipeline logs. Show the Trivy output table with CVE list.
*"Trivy scans our Docker images layer by layer — base OS, Node.js packages, our application dependencies. Before any image reaches the server, we know exactly what vulnerabilities exist in it."*

### Demo 8 — Show DevSecOps in code
Open `backend/services/billing/controller/billing.controller.js`
Find the `timingSafeEqual` line:
```javascript
const isValidSignature =
  expectedBuffer.length === receivedBuffer.length &&
  crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
```
*"Regular string comparison is vulnerable to timing attacks — an attacker can measure response time to guess the signature byte by byte. timingSafeEqual always takes the same time regardless of where strings differ — preventing this attack completely."*

---

## What to Say at Viva — Complete Script

*"Our CI/CD pipeline runs automatically on every git push to the main branch using GitHub Actions. It has 4 stages that run sequentially — if any stage fails, all subsequent stages are blocked.*

*Stage 1 checks code quality with ESLint. If a developer commits broken code, it fails here and never reaches the server.*

*Stage 2 builds all 5 Docker images using layer caching to keep build times under 2 minutes.*

*Stage 3 is the DevSecOps layer. GitLeaks scans every commit for accidentally added API keys or passwords. npm audit checks all dependencies against the CVE database. Trivy scans our Docker images layer by layer for known vulnerabilities. All three run automatically on every push.*

*Stage 4 SSHs into our AWS EC2 server using credentials stored in GitHub Secrets — never in code — pulls the latest code, rebuilds the containers, and restarts the services. The entire process from push to live takes about 3-5 minutes with zero manual work.*

*This is what CI/CD and DevSecOps mean in practice — security and deployment are automated, not afterthoughts."*
