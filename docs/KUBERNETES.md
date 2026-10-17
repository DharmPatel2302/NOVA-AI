# Technology 4 — Kubernetes (K8s)
# Marks: 2/20

---

## What Is Kubernetes?

Docker Compose runs containers on **one machine**. If that machine dies, everything dies. If traffic spikes, you cannot scale automatically. If a container crashes, it stays down until you manually restart it.

Kubernetes (K8s) is a **container orchestration system** that manages containers automatically. It:
- **Auto-restarts** crashed containers (self-healing) — no human needed
- **Load balances** traffic across multiple replicas automatically
- **Auto-scales** pods up and down based on CPU usage (HPA)
- **Rolls out updates** with zero downtime
- **Manages secrets** — API keys never visible in plain text
- **Enforces resource limits** — one service cannot starve others

The analogy: Docker Compose is hiring one chef. If the chef gets sick, the kitchen stops. Kubernetes is hiring a restaurant manager who automatically replaces sick chefs, hires more during rush hour, and fires extras when it's quiet — all without you doing anything.

---

## Why We Use Kubernetes in NOVA AI

NOVA AI has 5 microservices + Redis. Without Kubernetes:

| Problem | Without K8s | With K8s |
|---|---|---|
| Agent service crashes at 3am | App is down until someone manually restarts | K8s detects crash in seconds, restarts automatically |
| 100 users send AI requests simultaneously | 1 agent pod handles all — overloads, slows down | HPA spins up more agent pods, load balanced |
| Deploy new version | Downtime during restart | Rolling update — zero downtime |
| API key in .env file | Anyone with server access can read it | Stored in K8s Secret — access controlled |
| One service uses 4GB RAM and crashes server | Everything dies | Resource limits cap it, only that pod restarts |

---

## NOVA AI Kubernetes Setup

**Cluster:** Docker Desktop Kubernetes (local — `docker-desktop` context)
**Namespace:** `nova-ai` — isolates all NOVA AI resources
**Local Registry:** `localhost:5000` — serves built Docker images to K8s

### Verified Live State
```
NAME                               READY   STATUS    RESTARTS   AGE
agent-service-c88698894-gs68w      1/1     Running   0          89s
auth-service-7b4b49f565-jk95g      1/1     Running   0          91s
billing-service-7c8846c5d7-9m47k   1/1     Running   0          90s
chat-service-df7cc6c77-gfjws       1/1     Running   0          90s
gateway-8dd87fb7d-f69t4            1/1     Running   0          89s
redis-0                            1/1     Running   0          14m

NAME          TARGETS       MINPODS   MAXPODS   REPLICAS
agent-hpa     cpu: 0%/70%   1         5         1
chat-hpa      cpu: 4%/70%   1         3         1
gateway-hpa   cpu: 2%/70%   1         3         1
```

All 6 pods running. 3 HPAs actively monitoring CPU. ✅

---

## Complete File Structure

```
k8s/
├── namespace.yaml    → Creates nova-ai namespace (isolation)
├── configmap.yaml    → Non-sensitive env vars (URLs, ports)
├── secrets.yaml      → Sensitive values (API keys, base64 encoded)
├── redis.yaml        → Redis StatefulSet + ClusterIP Service + PVC
├── auth.yaml         → Auth Deployment + ClusterIP Service
├── chat.yaml         → Chat Deployment + ClusterIP Service
├── agent.yaml        → Agent Deployment + ClusterIP Service (higher resources)
├── billing.yaml      → Billing Deployment + ClusterIP Service
├── gateway.yaml      → Gateway Deployment + NodePort Service (port 30000)
├── ingress.yaml      → Nginx Ingress routing all traffic to gateway
└── hpa.yaml          → HPA for agent (1-5 pods), gateway (1-3), chat (1-3)
```

---

## Every Kubernetes Object Explained

---

### 1. Namespace

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nova-ai
```

**What it is:** A virtual cluster inside a cluster. Like a folder that separates your project from everything else running on K8s.

**Why we use it:** Without a namespace, NOVA AI resources mix with system resources (`kube-system`) and any other app. With `nova-ai` namespace:
- `kubectl get pods -n nova-ai` shows ONLY your pods
- Resources are isolated — another app can have a service named `gateway` without conflict
- You can delete everything at once: `kubectl delete namespace nova-ai`

**In every other YAML file:**
```yaml
metadata:
  namespace: nova-ai   # Every resource goes into this namespace
```

---

### 2. ConfigMap — Non-Sensitive Configuration

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nova-ai-config
  namespace: nova-ai
data:
  REDIS_URL: "redis://redis-service:6379"
  AUTH_SERVICE: "http://auth-service:8001"
  CHAT_SERVICE: "http://chat-service:8002"
  AGENT_SERVICE: "http://agent-service:8003"
  BILLING_SERVICE: "http://billing-service:8004"
  QDRANT_ENDPOINT: "https://422f6759-dd2a-451f..."
```

**What it is:** Key-value store for non-sensitive configuration. Safe to commit to Git.

**Why we use it instead of hardcoding:** If you hardcode `http://auth-service:8001` inside your Docker image and later the URL changes, you need to rebuild the image. With ConfigMap, you update one YAML file and redeploy — no image rebuild.

**How services use it:**
```yaml
# In any Deployment:
env:
  - name: REDIS_URL
    valueFrom:
      configMapKeyRef:
        name: nova-ai-config
        key: REDIS_URL
# Pod gets REDIS_URL=redis://redis-service:6379 as environment variable
```

**K8s DNS — why service names work as URLs:**
Inside K8s, every Service gets a DNS entry: `<service-name>.<namespace>.svc.cluster.local`. Within the same namespace, the shortform works: `http://auth-service:8001`. K8s automatically resolves `auth-service` to whatever IP the auth pod is currently running on. This is why pod IP changes don't matter.

---

### 3. Secret — Sensitive Values

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nova-ai-secrets
  namespace: nova-ai
type: Opaque
data:
  GROQ_API_KEY: Z3NrX1I0N21uTTZ6SmZm...       # base64 encoded
  MONGODB_URI: bW9uZ29kYitzcnY6Ly8...           # base64 encoded
  FIREBASE_PRIVATE_KEY: LS0tLS1CRUdJTi...       # base64 encoded
  RAZORPAY_KEY_SECRET: UUtvWTVsaFd2cDk...       # base64 encoded
  SESSION_SECRET: bm92YS1haS1zdXBlci...         # base64 encoded
  # ... 15 total secrets
```

**What it is:** Like ConfigMap but for sensitive data. Values are base64 encoded.

**Important:** Base64 is NOT encryption — it's encoding. Anyone who can run `kubectl get secret nova-ai-secrets -o yaml` can decode the values. The protection comes from **Kubernetes RBAC** (Role-Based Access Control) — only authorized users and pods can read secrets.

**Why base64?** K8s stores secrets as binary-safe data. Base64 allows any value (including multi-line Firebase private keys) to be stored as a single string.

**How to encode a value:**
```bash
echo -n "your-api-key" | base64
# Output: eW91ci1hcGkta2V5
```

**How services use it:**
```yaml
env:
  - name: GROQ_API_KEY
    valueFrom:
      secretKeyRef:
        name: nova-ai-secrets
        key: GROQ_API_KEY
# Pod gets GROQ_API_KEY injected as env var — never in plain text in YAML
```

**What kubectl shows:**
```bash
kubectl describe secret nova-ai-secrets -n nova-ai
# Data
# ====
# GROQ_API_KEY:          44 bytes    ← key name visible, value hidden
# MONGODB_URI:           147 bytes   ← value hidden
# FIREBASE_PRIVATE_KEY:  1765 bytes  ← value hidden
```

Values are **never** shown in `kubectl describe` output.

---

### 4. Deployment — Running and Managing Pods

A Deployment tells Kubernetes: *"Keep exactly N copies of this container running. If one crashes, restart it. If I update the image, do it without downtime."*

**Full example — Agent Service (most complex):**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-service
  namespace: nova-ai
spec:
  replicas: 1                          # Keep 1 pod running at all times
  selector:
    matchLabels:
      app: agent-service               # Manages pods with this label
  template:
    metadata:
      labels:
        app: agent-service
    spec:
      containers:
        - name: agent-service
          image: localhost:5000/nova-agent-service:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8003
          env:
            # Non-sensitive from ConfigMap
            - name: REDIS_URL
              valueFrom:
                configMapKeyRef:
                  name: nova-ai-config
                  key: REDIS_URL
            # Sensitive from Secret
            - name: GROQ_API_KEY
              valueFrom:
                secretKeyRef:
                  name: nova-ai-secrets
                  key: GROQ_API_KEY
          resources:
            requests:
              memory: "256Mi"   # Guaranteed minimum
              cpu: "250m"       # 250 millicores = 0.25 CPU
            limits:
              memory: "512Mi"   # Hard maximum — never exceed this
              cpu: "500m"       # Hard maximum
          livenessProbe:        # "Is the pod alive? Restart if not."
            httpGet:
              path: /health
              port: 8003
            initialDelaySeconds: 30   # Wait 30s before first check
            periodSeconds: 15         # Check every 15s
          readinessProbe:       # "Is the pod ready for traffic?"
            httpGet:
              path: /health
              port: 8003
            initialDelaySeconds: 20
            periodSeconds: 10
```

**Resource Limits — Why Agent Gets More:**

Agent service does LLM inference, processes PDFs/images, and runs vector searches — it needs more resources than a simple CRUD service.

```
Service      Memory Request/Limit    CPU Request/Limit
──────────────────────────────────────────────────────
Gateway      128Mi / 256Mi           100m / 200m
Auth         128Mi / 256Mi           100m / 200m
Chat         128Mi / 256Mi           100m / 200m
Billing      128Mi / 256Mi           100m / 200m
Agent        256Mi / 512Mi           250m / 500m   ← 2x everything
Redis         64Mi / 128Mi            50m / 100m
```

**Liveness vs Readiness Probes:**

| Probe | Purpose | Failure Action |
|---|---|---|
| `livenessProbe` | Is the container still alive? | K8s kills + restarts the pod |
| `readinessProbe` | Is the container ready to receive traffic? | K8s stops sending traffic to it |

Example: Agent service starts up but takes 20 seconds to connect to all AI APIs. During those 20 seconds, `readinessProbe` fails — K8s keeps sending traffic to other pods instead. Once ready, traffic flows. Without readiness probes, K8s might send requests to a pod that isn't fully initialized yet.

---

### 5. Service — Stable Network Identity

Pods get random IPs that change every restart. A Service gives a **stable DNS name** that always resolves to healthy pods.

**ClusterIP Service (internal — used by auth, chat, agent, billing, redis):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: nova-ai
spec:
  selector:
    app: auth-service     # Routes to ALL pods with this label
  ports:
    - port: 8001
      targetPort: 8001
  type: ClusterIP          # Not accessible from outside the cluster
```

Now any pod can call `http://auth-service:8001` — K8s resolves this to the correct pod IP automatically. If the pod restarts with a new IP, the Service still works — DNS is updated automatically.

**NodePort Service (external — used by gateway only):**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: gateway-service
  namespace: nova-ai
spec:
  selector:
    app: gateway
  ports:
    - port: 8000
      targetPort: 8000
      nodePort: 30000      # Exposed on host at localhost:30000
  type: NodePort
```

Gateway is the only service accessible from outside the cluster. `localhost:30000` → gateway pod port 8000. This is how the frontend and browser reach the backend.

---

### 6. StatefulSet — Redis with Persistent Storage

Redis uses a **StatefulSet** instead of a Deployment. The difference:

| Feature | Deployment | StatefulSet |
|---|---|---|
| Pod naming | Random (redis-abc123) | Stable (redis-0, redis-1) |
| Storage | Shared or none | Each pod gets its own PVC |
| Use case | Stateless apps | Databases, caches |

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: nova-ai
spec:
  serviceName: redis-service
  replicas: 1
  template:
    spec:
      containers:
        - name: redis
          image: redis:7-alpine
          command: ["redis-server", "--appendonly", "yes"]
          volumeMounts:
            - name: redis-data
              mountPath: /data        # Redis persists data here
  volumeClaimTemplates:               # Auto-creates a PVC per replica
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi             # 1GB persistent disk
```

**Why persistence matters:** Without `volumeClaimTemplates`, if the Redis pod crashes, all session data is lost — every user gets logged out. With the PVC, data survives pod restarts.

---

### 7. Ingress — External Traffic Routing

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nova-ai-ingress
  namespace: nova-ai
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"   # Allow 50MB file uploads
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
spec:
  ingressClassName: nginx
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: gateway-service
                port:
                  number: 8000
```

**What it is:** A smart HTTP router that sits in front of all services. In production (on EC2 with K3s), Ingress handles:
- SSL/TLS termination (HTTPS)
- Path-based routing (`/api → backend`, `/ → frontend`)
- Rate limiting
- Large file upload support (the 50MB annotation)

For local demo, we use NodePort directly. On cloud, Ingress is the proper way.

---

### 8. HPA — Horizontal Pod Autoscaler

**This is the most impressive feature for the viva.**

HPA watches CPU (and/or memory) usage of a Deployment. When usage exceeds a threshold, it automatically adds more pods. When it drops, it removes them. Zero human involvement.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-hpa
  namespace: nova-ai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-service        # Watch this deployment
  minReplicas: 1               # Never go below 1 pod
  maxReplicas: 5               # Never go above 5 pods
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70   # Scale up when avg CPU > 70%
```

**How the scaling math works:**

K8s checks every 15 seconds:
```
desiredReplicas = ceil(currentReplicas × (currentCPU / targetCPU))

Example:
currentReplicas = 1
currentCPU = 140%  (very busy)
targetCPU = 70%

desiredReplicas = ceil(1 × 140/70) = ceil(2.0) = 2 pods

Next check: currentCPU = 105%, 2 pods running
desiredReplicas = ceil(2 × 105/70) = ceil(3.0) = 3 pods
```

**Three HPAs in NOVA AI: Horizontal Pod Autoscaler (HPA)**

| HPA | Service | Min | Max | Reason |
|---|---|---|---|---|
| `agent-hpa` | Agent | 1 | 5 | LLM inference is CPU-heavy — most likely to spike |
| `chat-hpa` | Chat | 1 | 3 | Stateless CRUD — safe to scale horizontally |
| `gateway-hpa` | Gateway | 1 | 3 | Handles all traffic — can bottleneck under load |

**Why not HPA on Auth and Billing?**
Auth is called once per login — very low traffic. Billing processes payments which are infrequent. They don't need autoscaling.

**Why not HPA on Redis?**
Redis is a StatefulSet. Scaling Redis horizontally requires cluster configuration (Redis Cluster) which is complex. Instead, Redis gets resource limits and we'd upgrade the instance size if needed.

**Requires Metrics Server:**
HPA needs real-time CPU data. Metrics Server collects this from every node and pod. We installed it with:
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```
With `--kubelet-insecure-tls` flag for Docker Desktop compatibility.

---

## How to Apply All Manifests

**Order matters** — namespace before resources, config before workloads:

```bash
# 1. Namespace first
kubectl apply -f k8s/namespace.yaml

# 2. Config and secrets (workloads need these)
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# 3. Database (other services connect to Redis on startup)
kubectl apply -f k8s/redis.yaml

# 4. Application services
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/chat.yaml
kubectl apply -f k8s/billing.yaml
kubectl apply -f k8s/agent.yaml
kubectl apply -f k8s/gateway.yaml

# 5. Ingress and HPA last
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml

# Or apply entire folder at once (K8s handles order internally):
kubectl apply -f k8s/
```

---

## Complete kubectl Command Reference

```bash
# ── Pods ─────────────────────────────────────────────────────
kubectl get pods -n nova-ai                          # List all pods
kubectl get pods -n nova-ai -w                       # Watch pods live (Ctrl+C to stop)
kubectl describe pod <pod-name> -n nova-ai           # Detailed pod info
kubectl logs -n nova-ai deployment/agent-service     # View logs
kubectl logs -n nova-ai deployment/agent-service -f  # Follow live logs
kubectl exec -it -n nova-ai deployment/gateway -- sh # Shell inside pod

# ── Deployments ──────────────────────────────────────────────
kubectl get deployments -n nova-ai
kubectl rollout restart deployment/agent-service -n nova-ai  # Force redeploy
kubectl scale deployment agent-service --replicas=3 -n nova-ai  # Manual scale

# ── Services ─────────────────────────────────────────────────
kubectl get services -n nova-ai
kubectl describe service gateway-service -n nova-ai

# ── HPA ──────────────────────────────────────────────────────
kubectl get hpa -n nova-ai                           # Shows live CPU% vs target
kubectl describe hpa agent-hpa -n nova-ai            # Full HPA details + history

# ── Secrets / ConfigMap ──────────────────────────────────────
kubectl get secrets -n nova-ai
kubectl describe secret nova-ai-secrets -n nova-ai   # Keys shown, values hidden
kubectl describe configmap nova-ai-config -n nova-ai

# ── Everything at once ───────────────────────────────────────
kubectl get all -n nova-ai

# ── Metrics ──────────────────────────────────────────────────
kubectl top nodes                                    # Node CPU/memory
kubectl top pods -n nova-ai                          # Per-pod CPU/memory

# ── Cleanup ──────────────────────────────────────────────────
kubectl delete namespace nova-ai                     # Delete everything
kubectl apply -f k8s/                                # Re-create everything
```

---

## Demonstration Guide for Faculty

### Demo 1 — Show all pods running (30 seconds)
```bash
kubectl get pods -n nova-ai
```
Point out:
- 6 pods, all `1/1 Running`
- Each corresponds to a microservice
- `redis-0` uses StatefulSet naming (stable), others use random suffixes

---

### Demo 2 — Show all K8s objects (1 minute)
```bash
kubectl get all -n nova-ai
```
Walk through each section:
- **Pods** — the actual running containers
- **Services** — note ClusterIP (internal) vs NodePort (gateway at 30000)
- **Deployments** — `1/1` means desired=1, available=1
- **StatefulSet** — Redis with stable storage

---

### Demo 3 — Self-Healing: THE most impressive demo (2 minutes)

```bash
# Step 1: Show current state
kubectl get pods -n nova-ai

# Step 2: Kill the agent pod (simulate a crash)
kubectl delete pod -l app=agent-service -n nova-ai

# Step 3: Immediately run this — watch K8s react
kubectl get pods -n nova-ai -w
```

Faculty sees this sequence in about 10 seconds:
```
agent-service-c88698894-gs68w   1/1   Running    ← original pod
agent-service-c88698894-gs68w   1/1   Terminating ← you deleted it
agent-service-c88698894-nxk9p   0/1   Pending     ← K8s detected it's gone
agent-service-c88698894-nxk9p   0/1   ContainerCreating
agent-service-c88698894-nxk9p   1/1   Running     ← back up in ~10 seconds
```

**What to say:** *"I deleted the agent pod — that simulates a crash. Kubernetes detected it immediately and created a replacement automatically. The whole process took 10 seconds. Users never see downtime. This is called self-healing."*

---

### Demo 4 — HPA: LIVE Autoscaling Under Real Load (5 minutes)

This is the most powerful demo. You will actually push CPU above 70% in front of faculty and watch K8s scale pods automatically in real time.

#### Step 1 — Show baseline (idle state)
```bash
kubectl get hpa -n nova-ai
```
Expected output:
```
NAME          REFERENCE                  TARGETS       MINPODS   MAXPODS   REPLICAS
agent-hpa     Deployment/agent-service   cpu: 0%/70%   1         5         1
chat-hpa      Deployment/chat-service    cpu: 4%/70%   1         3         1
gateway-hpa   Deployment/gateway         cpu: 2%/70%   1         3         1
```
Point out: `TARGETS` column shows live CPU. Currently idle — 1 replica each.

---

#### Step 2 — Start a load generator (simulate traffic spike)

Run a pod inside the cluster that hammers the gateway with 5 parallel requests every 0.1 seconds:

```bash
kubectl run load-generator --image=busybox:1.36 --restart=Never -n nova-ai \
  -- sh -c "while true; do \
    wget -q -O- http://gateway-service:8000/health & \
    wget -q -O- http://gateway-service:8000/health & \
    wget -q -O- http://gateway-service:8000/health & \
    wget -q -O- http://gateway-service:8000/health & \
    wget -q -O- http://gateway-service:8000/health & \
    sleep 0.1; done"
```

Wait 30 seconds, then check:

```bash
kubectl get hpa -n nova-ai
kubectl top pods -n nova-ai --sort-by=cpu
```

---

#### Step 3 — Watch HPA react (this is what faculty will see)

After ~30 seconds of load, output will look like this:
```
NAME          REFERENCE           TARGETS          MINPODS   MAXPODS   REPLICAS
gateway-hpa   Deployment/gateway  cpu: 163%/70%    1         3         3
```

And pods:
```
NAME                      CPU(cores)   MEMORY
gateway-8dd87fb7d-f69t4   184m         23Mi    ← original pod
gateway-8dd87fb7d-pz6s4   160m         24Mi    ← HPA added this
gateway-8dd87fb7d-rnvmz   145m         23Mi    ← HPA added this
load-generator            965m         5Mi     ← our stress pod
```

**What happened:**
- CPU hit 163% (above 70% threshold)
- HPA calculated: `ceil(1 × 163/70)` = 3 replicas needed
- K8s spun up 2 new gateway pods in ~20 seconds
- Load is now shared across 3 pods (163m + 160m + 145m each instead of 489m on one)

---

#### Step 4 — Stop load and watch scale-down
```bash
# Delete the load generator
kubectl delete pod load-generator -n nova-ai

# Watch CPU drop
kubectl get hpa -n nova-ai
```

Output after ~30 seconds:
```
gateway-hpa   Deployment/gateway  cpu: 17%/70%   1   3   3
```

CPU dropped to 17% but still 3 replicas — K8s waits **5 minutes** before scaling down. This is intentional — it's called the **stabilization window**. It prevents "flapping" (rapidly scaling up and down if traffic is spiky).

After 5 minutes:
```
gateway-hpa   Deployment/gateway  cpu: 2%/70%    1   3   1
```
Back to 1 replica.

---

#### What to say during this demo:
*"I'm going to create a load generator that simulates hundreds of users hitting our gateway simultaneously. Watch the TARGETS column — it shows live CPU percentage versus our 70% threshold.*

*[start load generator]*

*CPU just hit 163% — more than double our threshold. Watch the REPLICAS column...*

*[wait 20-30 seconds]*

*Kubernetes automatically scaled from 1 to 3 gateway pods. The load is now distributed across all 3 — each is handling about 55% of CPU instead of one pod handling 163%. I didn't do anything — HPA detected the spike and responded automatically.*

*[stop load generator]*

*Now I've stopped the traffic. CPU dropped to 17%. The pods are still at 3 — Kubernetes waits 5 minutes before scaling down to avoid flapping. After that window, it'll scale back to 1 pod automatically.*

*This is what production autoscaling looks like."*

---

#### Scaling math for viva explanation:
```
Current:  1 replica,  CPU = 163%,  Target = 70%
Formula:  ceil(1 × 163/70) = ceil(2.33) = 3 replicas

Next check (3 replicas running):
          CPU per pod ≈ 54%,  Target = 70%
Formula:  ceil(3 × 54/70) = ceil(2.31) = 3 replicas  (stable — no change)

After load stops:
          CPU per pod ≈ 2%,  Target = 70%
Formula:  ceil(3 × 2/70) = ceil(0.09) = 1 replica (after stabilization window)
```

---

### Demo 5 — Manual Scale (1 minute)

```bash
# Manually scale to 3 replicas
kubectl scale deployment agent-service --replicas=3 -n nova-ai

# Show 3 pods
kubectl get pods -n nova-ai

# HPA will override this back to 1 if CPU stays low
kubectl get hpa -n nova-ai

# Scale back to 1
kubectl scale deployment agent-service --replicas=1 -n nova-ai
```

**What to say:** *"I can also scale manually with one command. 3 agent pods running, load balanced automatically. When I scale back down, the extra pods are terminated gracefully — in-flight requests are completed first."*

---

### Demo 6 — Secrets are protected (1 minute)

```bash
kubectl describe secret nova-ai-secrets -n nova-ai
```

Output:
```
Data
====
FIREBASE_PRIVATE_KEY:    1765 bytes   ← value never shown
GROQ_API_KEY:            44 bytes
MONGODB_URI:             147 bytes
RAZORPAY_KEY_SECRET:     24 bytes
SESSION_SECRET:          38 bytes
```

**What to say:** *"15 API keys stored in Kubernetes Secrets. I can see the key names and sizes but never the values. Compare this to a .env file where everything is visible in plain text. In K8s, access to secrets is controlled by RBAC — only pods that explicitly reference a secret can use it."*

---

### Demo 7 — Resource limits (1 minute)

Open `k8s/agent.yaml`:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

```bash
# Show live resource usage per pod
kubectl top pods -n nova-ai
```

**What to say:** *"Every service has CPU and memory limits. Agent gets 512MB max because it runs LLM inference and file processing. If agent tries to use more than 512MB, K8s kills and restarts just that pod — the auth, chat, and billing services keep running normally. Resource limits prevent one misbehaving service from crashing the entire system."*

---

### Demo 8 — Show K8s vs Docker Compose (30 seconds)

Open two files side by side:
- `backend/docker-compose.yml`
- `k8s/agent.yaml`

Point out what K8s adds on top of Docker Compose:
- `replicas` — desired state management
- `livenessProbe` + `readinessProbe` — health management
- `resources` limits — prevents resource starvation
- `secretKeyRef` — secure secret injection
- HPA — automatic scaling

---

## K8s vs Docker Compose — Full Comparison

| Feature | Docker Compose | Kubernetes |
|---|---|---|
| Runs on | 1 machine | Multiple machines |
| Self-healing | No — manual restart | Yes — automatic |
| Scaling | Manual `--scale` | `kubectl scale` or HPA (auto) |
| Load balancing | No | Built-in via Services |
| Secret management | `.env` files (plain text) | K8s Secrets (access controlled) |
| Health checks | Basic | Liveness + Readiness probes |
| Rolling updates | Downtime | Zero-downtime rollouts |
| Resource limits | No | CPU + memory limits per pod |
| Persistent storage | Docker volumes | PersistentVolumeClaims |
| Auto-scaling | No | HPA — CPU/memory triggered |
| Multi-machine | No | Yes — pods run on any node |

---

## What to Say at Viva — Complete Script

*"We use Kubernetes to run all 6 NOVA AI services as pods inside a dedicated namespace called nova-ai. Each service has a Deployment that maintains the desired replica count — if any pod crashes, Kubernetes detects it within seconds and creates a replacement automatically. This is called self-healing and it means zero downtime even when containers crash.*

*Services communicate using Kubernetes DNS — each service gets a stable name like auth-service:8001 that always resolves to healthy pods regardless of which IP they're running on.*

*Sensitive values like API keys, the MongoDB URI, and Firebase private keys are stored in Kubernetes Secrets. They're base64 encoded and never visible in plain text — even kubectl describe doesn't show the values.*

*We use a StatefulSet for Redis with a PersistentVolumeClaim because Redis holds session data. If the Redis pod crashes, the PVC preserves the data so users don't get logged out.*

*The most powerful feature is the Horizontal Pod Autoscaler. We have HPAs on the agent, gateway, and chat services. When CPU usage crosses 70%, K8s automatically adds more pods up to a maximum of 5 for agent and 3 for the others. When traffic drops, it scales back down to 1. This happens completely automatically with no human intervention — that's what makes Kubernetes production-grade."*
