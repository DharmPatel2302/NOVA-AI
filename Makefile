# ============================================================
#  NOVA AI — Makefile
#  Usage: make <command>
# ============================================================

# ── Variables ────────────────────────────────────────────────
COMPOSE_FILE = backend/docker-compose.yml
FRONTEND_DIR = frontend

# ── Colors for output ────────────────────────────────────────
GREEN  = \033[0;32m
YELLOW = \033[0;33m
RESET  = \033[0m

.PHONY: help up down restart build logs ps clean frontend install

# ── Default: show help ───────────────────────────────────────
help:
	@echo ""
	@echo "  NOVA AI — Available Commands"
	@echo "  ─────────────────────────────────────────────"
	@echo "  Docker Compose:"
	@echo "  make up            Start all backend services"
	@echo "  make down          Stop all backend services"
	@echo "  make restart       Stop, rebuild and start again"
	@echo "  make build         Rebuild all Docker images"
	@echo "  make logs          View live logs from all services"
	@echo "  make ps            Show running containers"
	@echo "  make clean         Remove containers, images & volumes"
	@echo "  make frontend      Install and start the frontend"
	@echo "  make install       Install all npm dependencies locally"
	@echo "  ─────────────────────────────────────────────"
	@echo "  Kubernetes:"
	@echo "  make k8s-setup     Full setup: registry+build+push+apply"
	@echo "  make k8s-up        Apply all manifests (images must exist)"
	@echo "  make k8s-down      Delete entire nova-ai namespace"
	@echo "  make k8s-status    Show pods, services, deployments, HPA"
	@echo "  make k8s-pods      Watch pods live"
	@echo "  make k8s-hpa       Show HPA live CPU%"
	@echo "  make k8s-rebuild   Rebuild images + push + restart pods"
	@echo "  make k8s-loadtest  Start load generator (triggers HPA)"
	@echo "  make k8s-stopload  Stop load generator"
	@echo "  make k8s-demo-heal Delete agent pod (self-healing demo)"
	@echo "  make k8s-top       Live CPU/memory per pod"
	@echo "  make k8s-logs SVC=agent-service   Stream logs"
	@echo "  make k8s-shell SVC=gateway        Shell into pod"
	@echo "  ─────────────────────────────────────────────"
	@echo ""

# ── Start all backend services ───────────────────────────────
up:
	@echo "Starting NOVA AI backend services..."
	docker compose -f $(COMPOSE_FILE) up -d
	@echo "All services are up!"
	@echo "Gateway   → http://localhost:8000"
	@echo "Auth      → http://localhost:8001"
	@echo "Chat      → http://localhost:8002"
	@echo "Agent     → http://localhost:8003"
	@echo "Billing   → http://localhost:8004"

# ── Stop all services ────────────────────────────────────────
down:
	@echo "Stopping all services..."
	docker compose -f $(COMPOSE_FILE) down
	@echo "All services stopped."

# ── Rebuild and restart ──────────────────────────────────────
restart:
	@echo "Restarting all services..."
	docker compose -f $(COMPOSE_FILE) down
	docker compose -f $(COMPOSE_FILE) up -d --build
	@echo "All services restarted!"

# ── Build images without starting ────────────────────────────
build:
	@echo "Building all Docker images..."
	docker compose -f $(COMPOSE_FILE) build
	@echo "Build complete."

# ── Live logs from all services ──────────────────────────────
logs:
	docker compose -f $(COMPOSE_FILE) logs -f

# ── Logs for a specific service: make logs-auth ──────────────
logs-gateway:
	docker compose -f $(COMPOSE_FILE) logs -f gateway

logs-auth:
	docker compose -f $(COMPOSE_FILE) logs -f auth-service

logs-chat:
	docker compose -f $(COMPOSE_FILE) logs -f chat-service

logs-agent:
	docker compose -f $(COMPOSE_FILE) logs -f agent-service

logs-billing:
	docker compose -f $(COMPOSE_FILE) logs -f billing-service

# ── Show running containers ──────────────────────────────────
ps:
	docker compose -f $(COMPOSE_FILE) ps

# ── Remove everything (containers + volumes + images) ────────
clean:
	@echo "WARNING: This will remove all containers, volumes and built images."
	docker compose -f $(COMPOSE_FILE) down -v --rmi local
	@echo "Clean complete."

# ── Start frontend dev server ────────────────────────────────
frontend:
	@echo "Starting frontend..."
	cd $(FRONTEND_DIR) && npm install && npm run dev

# ── Install all dependencies locally (without Docker) ────────
install:
	@echo "Installing all service dependencies..."
	cd backend/gateway && npm install
	cd backend/services/auth && npm install
	cd backend/services/chat && npm install
	cd backend/services/agent && npm install
	cd backend/services/billing && npm install
	cd frontend && npm install
	@echo "All dependencies installed!"

# ── Kubernetes targets ───────────────────────────────────────

# Full setup: registry + build + push + metrics-server + apply manifests
k8s-setup:
	@echo "Running full Kubernetes setup..."
	chmod +x k8s/setup.sh && bash k8s/setup.sh

# Apply all manifests (assumes images already in registry)
k8s-up:
	@echo "Applying all K8s manifests..."
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/configmap.yaml
	kubectl apply -f k8s/secrets.yaml
	kubectl apply -f k8s/redis.yaml
	kubectl apply -f k8s/auth.yaml
	kubectl apply -f k8s/chat.yaml
	kubectl apply -f k8s/billing.yaml
	kubectl apply -f k8s/agent.yaml
	kubectl apply -f k8s/gateway.yaml
	kubectl apply -f k8s/ingress.yaml
	kubectl apply -f k8s/hpa.yaml
	@echo "All manifests applied!"
	@echo "Gateway → http://localhost:30000"

# Tear down everything in the namespace
k8s-down:
	@echo "Deleting nova-ai namespace (removes all K8s resources)..."
	kubectl delete namespace nova-ai --ignore-not-found
	@echo "All K8s resources removed."

# Show pods + services + HPA + deployments
k8s-status:
	@echo ""
	@echo "=== Pods ==="
	kubectl get pods -n nova-ai
	@echo ""
	@echo "=== Services ==="
	kubectl get services -n nova-ai
	@echo ""
	@echo "=== Deployments ==="
	kubectl get deployments -n nova-ai
	@echo ""
	@echo "=== HPA (live CPU%) ==="
	kubectl get hpa -n nova-ai

# Just pods
k8s-pods:
	kubectl get pods -n nova-ai -w

# Just HPA — live CPU vs target
k8s-hpa:
	kubectl get hpa -n nova-ai

# Logs for a specific service: make k8s-logs SVC=agent-service
k8s-logs:
	kubectl logs -n nova-ai deployment/$(SVC) -f

# Shell inside a running pod: make k8s-shell SVC=gateway
k8s-shell:
	kubectl exec -it -n nova-ai deployment/$(SVC) -- sh

# Rebuild images + push to local registry (run after code changes)
k8s-rebuild:
	@echo "Rebuilding and pushing all images to localhost:5000..."
	cd backend && \
	docker build -t nova-gateway:latest         -f gateway/Dockerfile        . && \
	docker build -t nova-auth-service:latest    -f services/auth/Dockerfile  . && \
	docker build -t nova-chat-service:latest    -f services/chat/Dockerfile  . && \
	docker build -t nova-agent-service:latest   -f services/agent/Dockerfile . && \
	docker build -t nova-billing-service:latest -f services/billing/Dockerfile .
	for svc in gateway auth-service chat-service agent-service billing-service; do \
		docker tag  nova-$$svc:latest localhost:5000/nova-$$svc:latest && \
		docker push localhost:5000/nova-$$svc:latest; \
	done
	@echo "Restarting deployments to pull new images..."
	kubectl rollout restart deployment -n nova-ai
	kubectl rollout status  deployment -n nova-ai --timeout=120s
	@echo "Done! All pods running new images."

# Run HPA load test — hammers gateway to trigger autoscaling
k8s-loadtest:
	@echo "Starting load generator — watch HPA with: make k8s-hpa"
	kubectl run load-generator --image=busybox:1.36 --restart=Never -n nova-ai \
		-- sh -c "while true; do \
			wget -q -O- http://gateway-service:8000/health & \
			wget -q -O- http://gateway-service:8000/health & \
			wget -q -O- http://gateway-service:8000/health & \
			sleep 0.1; done"
	@echo "Load generator running. Watch CPU: kubectl get hpa -n nova-ai"
	@echo "Stop with: make k8s-stopload"

# Stop the load test
k8s-stopload:
	kubectl delete pod load-generator -n nova-ai --ignore-not-found
	@echo "Load generator stopped."

# Self-healing demo — deletes agent pod, K8s restarts it automatically
k8s-demo-heal:
	@echo "Deleting agent pod to simulate crash..."
	kubectl delete pod -l app=agent-service -n nova-ai
	@echo "Watch K8s restart it automatically:"
	kubectl get pods -n nova-ai -w

# Show resource usage per pod (requires metrics-server)
k8s-top:
	kubectl top pods -n nova-ai --sort-by=cpu
