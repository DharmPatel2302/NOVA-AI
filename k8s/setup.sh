#!/bin/bash
# ============================================================
#  NOVA AI — Kubernetes Full Setup Script
#  Run this once to get everything running from scratch.
#
#  What this does:
#  1. Checks prerequisites (docker, kubectl, K8s cluster)
#  2. Starts a local Docker registry on localhost:5000
#  3. Builds all 5 service Docker images
#  4. Tags and pushes images to localhost:5000
#  5. Installs metrics-server (required for HPA)
#  6. Applies all K8s manifests in correct order
#  7. Waits for pods to be ready
#  8. Prints live status
#
#  Usage:
#    chmod +x k8s/setup.sh
#    ./k8s/setup.sh
#
#  Teardown:
#    kubectl delete namespace nova-ai
#    docker stop nova-registry && docker rm nova-registry
# ============================================================

set -e   # Exit on any error

# ── Colors ───────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

log()  { echo -e "${GREEN}[✓]${RESET} $1"; }
info() { echo -e "${CYAN}[→]${RESET} $1"; }
warn() { echo -e "${YELLOW}[!]${RESET} $1"; }
fail() { echo -e "${RED}[✗]${RESET} $1"; exit 1; }

echo ""
echo -e "${CYAN}============================================${RESET}"
echo -e "${CYAN}   NOVA AI — Kubernetes Setup              ${RESET}"
echo -e "${CYAN}============================================${RESET}"
echo ""

# ── Step 0: Check prerequisites ──────────────────────────────
info "Checking prerequisites..."

command -v docker   &>/dev/null || fail "Docker is not installed. Install Docker Desktop first."
command -v kubectl  &>/dev/null || fail "kubectl is not installed. Enable Kubernetes in Docker Desktop."

# Check Kubernetes cluster is running
kubectl cluster-info &>/dev/null || fail "Kubernetes cluster is not running. Enable it in Docker Desktop → Settings → Kubernetes → Enable Kubernetes."

CONTEXT=$(kubectl config current-context)
log "Kubernetes cluster running — context: ${CONTEXT}"

# ── Step 1: Start local Docker registry ──────────────────────
info "Starting local Docker registry on localhost:5000..."

# Check if registry is already running
if docker ps --format '{{.Names}}' | grep -q "^nova-registry$"; then
    log "Registry already running — skipping"
else
    # Remove stopped registry container if it exists
    docker rm -f nova-registry 2>/dev/null || true

    docker run -d \
        --name nova-registry \
        --restart always \
        -p 5000:5000 \
        registry:2

    sleep 2
    log "Local registry started at localhost:5000"
fi

# ── Step 2: Build Docker images from backend/ ────────────────
info "Building Docker images (this takes 3-5 minutes first time, cached after)..."

cd "$(dirname "$0")/../backend"

docker build -t nova-gateway:latest        -f gateway/Dockerfile        . 
log "Built nova-gateway"

docker build -t nova-auth-service:latest   -f services/auth/Dockerfile   .
log "Built nova-auth-service"

docker build -t nova-chat-service:latest   -f services/chat/Dockerfile   .
log "Built nova-chat-service"

docker build -t nova-agent-service:latest  -f services/agent/Dockerfile  .
log "Built nova-agent-service"

docker build -t nova-billing-service:latest -f services/billing/Dockerfile .
log "Built nova-billing-service"

cd - > /dev/null

# ── Step 3: Tag and push images to local registry ─────────────
info "Pushing images to local registry (localhost:5000)..."

for SERVICE in gateway auth-service chat-service agent-service billing-service; do
    docker tag  nova-${SERVICE}:latest localhost:5000/nova-${SERVICE}:latest
    docker push localhost:5000/nova-${SERVICE}:latest
    log "Pushed localhost:5000/nova-${SERVICE}:latest"
done

# ── Step 4: Install metrics-server (required for HPA) ────────
info "Installing metrics-server (required for HPA CPU metrics)..."

# Check if metrics-server already exists
if kubectl get deployment metrics-server -n kube-system &>/dev/null; then
    log "metrics-server already installed — skipping"
else
    # Install metrics-server with --kubelet-insecure-tls for Docker Desktop
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

    # Patch to add --kubelet-insecure-tls flag (required for Docker Desktop)
    kubectl patch deployment metrics-server \
        -n kube-system \
        --type=json \
        -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

    log "metrics-server installed and patched for Docker Desktop"
fi

# ── Step 5: Apply K8s manifests in correct order ──────────────
info "Applying Kubernetes manifests..."

cd "$(dirname "$0")/.."

# 1. Namespace first — everything else goes inside it
kubectl apply -f k8s/namespace.yaml
log "Applied namespace"

# 2. Config and secrets — workloads read these on startup
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
log "Applied configmap + secrets"

# 3. Redis — other services depend on it for sessions
kubectl apply -f k8s/redis.yaml
log "Applied redis StatefulSet"

# 4. Core services
kubectl apply -f k8s/auth.yaml
kubectl apply -f k8s/chat.yaml
kubectl apply -f k8s/billing.yaml
kubectl apply -f k8s/agent.yaml
kubectl apply -f k8s/gateway.yaml
log "Applied all 5 service deployments"

# 5. Ingress and HPA last
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
log "Applied ingress + HPA"

# ── Step 6: Wait for pods to be ready ─────────────────────────
info "Waiting for all pods to be ready (up to 3 minutes)..."

# Wait for each deployment
for DEPLOY in auth-service chat-service billing-service agent-service gateway; do
    kubectl rollout status deployment/${DEPLOY} -n nova-ai --timeout=180s
    log "${DEPLOY} is ready"
done

# Wait for Redis StatefulSet
kubectl rollout status statefulset/redis -n nova-ai --timeout=60s
log "redis is ready"

# ── Step 7: Print final status ────────────────────────────────
echo ""
echo -e "${GREEN}============================================${RESET}"
echo -e "${GREEN}   NOVA AI — All Systems Running ✅         ${RESET}"
echo -e "${GREEN}============================================${RESET}"
echo ""

echo -e "${CYAN}Pods:${RESET}"
kubectl get pods -n nova-ai

echo ""
echo -e "${CYAN}Services:${RESET}"
kubectl get services -n nova-ai

echo ""
echo -e "${CYAN}HPA (may show <unknown> until metrics-server warms up ~2 min):${RESET}"
kubectl get hpa -n nova-ai

echo ""
echo -e "${GREEN}Access the app:${RESET}"
echo -e "  Gateway (NodePort):  ${CYAN}http://localhost:30000${RESET}"
echo -e "  Health check:        ${CYAN}http://localhost:30000/health${RESET}"
echo ""
echo -e "${YELLOW}Note: HPA targets show <unknown> for ~2 minutes after startup"
echo -e "      while metrics-server collects initial CPU data.${RESET}"
echo ""
echo -e "Run ${CYAN}kubectl get hpa -n nova-ai${RESET} again in 2 minutes to see live CPU%."
echo ""
