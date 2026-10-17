# Technology 4 — Kubernetes (K8s)
# Marks: 2/20

---

## What Is Kubernetes?

Docker Compose runs containers on **one machine**. If that machine dies, everything dies. If traffic spikes, you can't scale automatically.

Kubernetes (K8s) is a **container orchestration system** that manages containers across one or many machines. It:
- **Auto-restarts** crashed containers (self-healing)
- **Load balances** traffic across multiple replicas
- **Auto-scales** when demand increases
- **Rolls out updates** with zero downtime
- **Manages secrets** and configuration separately from code

The analogy: Docker Compose is hiring one chef. Kubernetes is hiring a restaurant manager who automatically replaces sick chefs, hires more during rush hour, and fires extras when it's quiet.

---

## NOVA AI Kubernetes Setup

**Cluster:** Docker Desktop (local Kubernetes — `docker-desktop` context)
**Namespace:** `nova-ai` (isolates all resources)
**Local Registry:** `localhost:5000` (serves images to K8s containerd runtime)

### Verified Running State
```
kubectl get pods -n nova-ai

NAME                               READY   STATUS    RESTARTS   AGE
agent-service-c88698894-gs68w      1/1     Running   0          89s
auth-service-7b4b49f565-jk95g      1/1     Running   0          91s
billing-service-7c8846c5d7-9m47k   1/1     Running   0          90s
chat-service-df7cc6c77-gfjws       1/1     Running   0          90s
gateway-8dd87fb7d-f69t4            1/1     Running   0          89s
redis-0                            1/1     Running   0          14m
```

All 6 pods: **1/1 Running** ✅

---

## File Structure

```
k8s/
├── namespace.yaml    → Creates nova-ai namespace
├── configmap.yaml    → Non-sensitive env vars (ports, URLs)
├── secrets.yaml      → Sensitive values (API keys, base64 encoded)
├── redis.yaml        → Redis StatefulSet + ClusterIP Service
├── auth.yaml         → Auth Deployment + ClusterIP Service
├── chat.yaml         → Chat Deployment + ClusterIP Service
├── agent.yaml        → Agent Deployment + ClusterIP Service (higher resources)
├── billing.yaml      → Billing Deployment + ClusterIP Service
├── gateway.yaml      → Gateway Deployment + NodePort Service (port 30000)
└── ingress.yaml      → Nginx Ingress routing all traffic to gateway
```

---

## Core Kubernetes Concepts Used

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: nova-ai
```
A Namespace is a virtual cluster inside a cluster. All NOVA AI resources live in `nova-ai` — isolated from any other apps running on the same K8s cluster. Like a folder that separates your project from others.

---

### ConfigMap — Non-Sensitive Config
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
```
Non-sensitive environment variables stored in K8s. Services reference these by name — no hardcoding URLs inside container images. Change the ConfigMap and redeploy — no image rebuild needed.

**Key difference from Docker Compose:** In docker-compose, you hardcode `AUTH_SERVICE=http://auth-service:8001`. In K8s, this value comes from ConfigMap, making it easy to change per environment (dev/staging/prod).

---

### Secret — Sensitive Values
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: nova-ai-secrets
  namespace: nova-ai
type: Opaque
data:
  GROQ_API_KEY: Z3NrX1I0N21uTTZ6SmZm...   # base64 encoded
  MONGODB_URI: bW9uZ29kYitzcnY6Ly8...       # base64 encoded
  RAZORPAY_KEY_SECRET: UUtvWTVsaFd2cDk...   # base64 encoded
```
API keys and passwords stored as K8s Secrets. They are base64 encoded (not encrypted by default, but access-controlled by K8s RBAC). Values are **never visible in plain text** in `kubectl describe`.

```bash
kubectl get secrets -n nova-ai
# Shows secret names but NOT values

kubectl describe secret nova-ai-secrets -n nova-ai
# Shows keys but values are hidden: GROQ_API_KEY: <set to the key ... of a Secret>
```

---

### Deployment — Running and Managing Pods

A Deployment tells K8s: "Keep exactly N copies of this container running. If one dies, restart it."

**Example — Auth Service:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: nova-ai
spec:
  replicas: 1                     # Keep 1 pod running at all times
  selector:
    matchLabels:
      app: auth-service
  template:
    spec:
      containers:
        - name: auth-service
          image: localhost:5000/nova-auth-service:latest
          env:
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:     # Pull from Secret (not hardcoded)
                  name: nova-ai-secrets
                  key: MONGODB_URI
            - name: REDIS_URL
              valueFrom:
                configMapKeyRef:  # Pull from ConfigMap
                  name: nova-ai-config
                  key: REDIS_URL
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"         # 100 millicores = 0.1 CPU
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:          # K8s restarts pod if this fails
            httpGet:
              path: /health
              port: 8001
          readinessProbe:         # K8s sends traffic only when this passes
            httpGet:
              path: /health
              port: 8001
```

**Resource Limits — Why Agent Gets More:**
```
Service      Requests         Limits
─────────────────────────────────────────
Gateway      128Mi / 100m     256Mi / 200m
Auth         128Mi / 100m     256Mi / 200m
Chat         128Mi / 100m     256Mi / 200m
Billing      128Mi / 100m     256Mi / 200m
Agent        256Mi / 250m     512Mi / 500m   ← 2x — runs LLMs + file processing
Redis         64Mi /  50m     128Mi / 100m   ← lightweight
```
Agent service handles LangGraph execution, LLM API calls, file uploads, and vector search — it needs more resources than a simple CRUD service.

---

### Service — Stable Network Identity

Pods get random IPs that change every restart. A Service gives a stable DNS name and IP that never changes.

**ClusterIP** (internal-only — used by auth, chat, agent, billing, redis):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: nova-ai
spec:
  selector:
    app: auth-service       # Routes to pods with this label
  ports:
    - port: 8001
      targetPort: 8001
  type: ClusterIP           # Only reachable inside the cluster
```
Now any pod can reach auth at `http://auth-service:8001` — regardless of which physical pod is running or what IP it has.

**NodePort** (external access — used by gateway only):
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
      nodePort: 30000       # Exposed on host machine at localhost:30000
  type: NodePort
```
Gateway is the only service accessible from outside. The frontend talks to `http://localhost:30000` (maps to port 8000 inside the cluster).

---

### StatefulSet — Redis with Persistent Storage

Redis uses a StatefulSet instead of a Deployment because:
1. **Stable network identity** — always reachable at `redis-0` not a random pod name
2. **Persistent storage** — data survives pod restarts via PersistentVolumeClaim

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: nova-ai
spec:
  replicas: 1
  volumeClaimTemplates:           # Creates a PVC automatically
    - metadata:
        name: redis-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 1Gi          # 1GB persistent disk for session data
```

If Redis pod crashes and restarts, all session data is still there — users don't get logged out.

---

### Ingress — Single Entry Point

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: nova-ai-ingress
  namespace: nova-ai
  annotations:
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"   # Allow file uploads up to 50MB
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
Ingress sits in front of everything and routes traffic to the gateway. In production (on EC2 with K3s), this replaces Nginx — Ingress handles SSL termination, path routing, and load balancing.

---

## How to Apply All Manifests

Apply in this order (namespace and config before workloads):

```bash
# 1. Create namespace first
kubectl apply -f k8s/namespace.yaml

# 2. Config and secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml

# 3. Database first (other services depend on Redis)
kubectl apply -f k8s/redis.yaml

# 4. Application services
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/chat.yaml
kubectl apply -f k8s/billing.yaml
kubectl apply -f k8s/agent.yaml
kubectl apply -f k8s/gateway.yaml

# 5. Ingress last
kubectl apply -f k8s/ingress.yaml

# Or apply entire folder at once:
kubectl apply -f k8s/
```

---

## Key kubectl Commands

```bash
# Show all pods in nova-ai namespace
kubectl get pods -n nova-ai

# Show all resources (pods, services, deployments, statefulsets)
kubectl get all -n nova-ai

# Show services with cluster IPs and ports
kubectl get services -n nova-ai

# Watch pods in real time (Ctrl+C to stop)
kubectl get pods -n nova-ai -w

# Show secrets (keys visible, values hidden)
kubectl get secrets -n nova-ai
kubectl describe secret nova-ai-secrets -n nova-ai

# Show ConfigMap values
kubectl describe configmap nova-ai-config -n nova-ai

# View logs from a pod
kubectl logs -n nova-ai deployment/auth-service
kubectl logs -n nova-ai deployment/agent-service -f   # follow live logs

# Execute command inside a running pod
kubectl exec -it -n nova-ai deployment/gateway -- sh

# Scale a deployment
kubectl scale deployment agent-service --replicas=3 -n nova-ai

# Delete and re-apply everything
kubectl delete namespace nova-ai
kubectl apply -f k8s/
```

---

## Self-Healing Demo (Most Impressive)

This is the #1 demo to show faculty — Kubernetes automatically restarts a crashed pod:

```bash
# Step 1: Show all pods running
kubectl get pods -n nova-ai

# Step 2: Delete the agent pod (simulate a crash)
kubectl delete pod -l app=agent-service -n nova-ai

# Step 3: Watch K8s immediately create a new one
kubectl get pods -n nova-ai -w
```

You'll see the sequence in about 10 seconds:
```
agent-service-c88698894-gs68w   1/1   Running     → Terminating
agent-service-c88698894-nxk9p   0/1   Pending     → ContainerCreating → Running
```

**What to say:** *"I deleted the pod — that simulates the process crashing. Kubernetes detected it immediately and created a replacement. The whole thing took 10 seconds. Users experienced no downtime. This is self-healing."*

---

## Scaling Demo

```bash
# Scale agent service to 3 replicas
kubectl scale deployment agent-service --replicas=3 -n nova-ai

# Show 3 pods running
kubectl get pods -n nova-ai
# agent-service-xxx   1/1   Running
# agent-service-yyy   1/1   Running
# agent-service-zzz   1/1   Running

# K8s automatically load balances across all 3
# Scale back down
kubectl scale deployment agent-service --replicas=1 -n nova-ai
```

**What to say:** *"When the AI agent gets heavy traffic, I scale from 1 to 3 replicas with one command. Kubernetes automatically load balances requests across all 3 pods. With Docker Compose, this is impossible — you'd need to manually configure a load balancer."*

---

## Secrets Demo

```bash
kubectl get secrets -n nova-ai
# NAME               TYPE     DATA   AGE
# nova-ai-secrets    Opaque   15     10m

kubectl describe secret nova-ai-secrets -n nova-ai
# Data
# ====
# GROQ_API_KEY:          44 bytes
# MONGODB_URI:           147 bytes
# RAZORPAY_KEY_SECRET:   24 bytes
# (values never shown in plain text)
```

**What to say:** *"API keys are stored as Kubernetes Secrets. When I describe the secret, Kubernetes shows the key names but never the values. A developer can see that GROQ_API_KEY exists and has 44 bytes, but cannot read the actual key. This is access-controlled by Kubernetes RBAC."*

---

## K8s vs Docker Compose — Side by Side

| Feature | Docker Compose | Kubernetes |
|---|---|---|
| Runs on | 1 machine | Multiple machines |
| Self-healing | No (manual restart) | Yes (automatic) |
| Scaling | Manual (`--scale`) | `kubectl scale` or auto |
| Load balancing | No | Built-in |
| Secret management | `.env` files | K8s Secrets (access-controlled) |
| Health checks | Basic | Liveness + Readiness probes |
| Rolling updates | No | Zero-downtime rollouts |
| Resource limits | No | CPU + memory limits per pod |
| Persistent storage | Docker volumes | PersistentVolumeClaims |

---

## What to Demonstrate to Faculty

### Demo 1 — Show all pods running
```bash
kubectl get pods -n nova-ai
```
Point out: all 6 pods show `1/1 Running`. Each is a container managed by K8s.

### Demo 2 — Show all K8s objects
```bash
kubectl get all -n nova-ai
```
Walk through: Pods, Services (ClusterIP vs NodePort), Deployments, StatefulSet for Redis.

### Demo 3 — Self-healing (kill a pod, watch it restart)
```bash
kubectl delete pod -l app=agent-service -n nova-ai
kubectl get pods -n nova-ai -w
```
Show the pod going `Terminating → ContainerCreating → Running` in ~10 seconds.

### Demo 4 — Scale up
```bash
kubectl scale deployment agent-service --replicas=3 -n nova-ai
kubectl get pods -n nova-ai
```
Show 3 agent pods running. Scale back to 1 after.

### Demo 5 — Show secrets are protected
```bash
kubectl describe secret nova-ai-secrets -n nova-ai
```
Show keys are listed but values are hidden. Compare to `.env` file where everything is visible.

### Demo 6 — Show resource limits
Open `k8s/agent.yaml` — point out:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```
*"Agent service gets double the resources of other services because it runs LLM inference. K8s guarantees it always has at least 256MB of memory and will never use more than 512MB — preventing one service from starving others."*

### Demo 7 — Show ConfigMap
```bash
kubectl describe configmap nova-ai-config -n nova-ai
```
Show all the inter-service URLs stored in ConfigMap, not hardcoded in images.

### What to Say at Viva
*"We use Kubernetes to run all 6 NOVA AI services as pods inside a dedicated namespace called nova-ai. Each service has a Deployment that ensures the correct number of replicas are always running — if a pod crashes, K8s creates a replacement automatically. Services communicate using stable DNS names provided by ClusterIP Services. The gateway is exposed externally via NodePort. Sensitive values like API keys are stored in Kubernetes Secrets and injected as environment variables — they're never visible in plain text. Redis uses a StatefulSet with a PersistentVolumeClaim so session data survives pod restarts. The agent service gets higher CPU and memory limits than other services because it handles LLM inference and file processing. The key advantage over Docker Compose is self-healing — Kubernetes monitors every pod and automatically restarts anything that crashes, giving us production-grade reliability."*
